const {
  GetCommand,
  UpdateCommand,
  PutCommand,
  TransactWriteCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
const { doc } = require("./db");

// DynamoDB storage for accountApi.js. One table, three item kinds:
//   pk "LOGIN#<loginId>", sk "PROFILE"  user profile + PIN hash + lockout state
//   pk "LOGIN#<loginId>", sk "SAVE"     cloud save (rev-numbered snapshot)
//   pk "META",            sk "USERS"    { count } — enforces MAX_USERS on sign-up

const TABLE = process.env.ACCOUNTS_TABLE_NAME;
const userKey = (loginId) => ({ pk: `LOGIN#${loginId}`, sk: "PROFILE" });
const saveKey = (loginId) => ({ pk: `LOGIN#${loginId}`, sk: "SAVE" });
const META_KEY = { pk: "META", sk: "USERS" };

function codedError(code) {
  const e = new Error(code);
  e.code = code;
  return e;
}

async function getUser(loginId) {
  const res = await doc.send(new GetCommand({ TableName: TABLE, Key: userKey(loginId) }));
  if (!res.Item) return null;
  const { pk, sk, ...user } = res.Item;
  return user;
}

// Creates the profile and bumps the user count in one transaction, so the
// cap holds even when two kids sign up at the same moment. `uncounted`
// (the admin, made by scripts/accounts.js) skips the count and the cap.
async function createUser(user, maxUsers, { uncounted = false } = {}) {
  if (uncounted) {
    try {
      await doc.send(
        new PutCommand({
          TableName: TABLE,
          Item: { ...userKey(user.loginId), ...user, uncounted: true },
          ConditionExpression: "attribute_not_exists(pk)",
        })
      );
    } catch (e) {
      if (e.name === "ConditionalCheckFailedException") throw codedError("id_taken");
      throw e;
    }
    return;
  }
  try {
    await doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLE,
              Item: { ...userKey(user.loginId), ...user },
              ConditionExpression: "attribute_not_exists(pk)",
            },
          },
          {
            Update: {
              TableName: TABLE,
              Key: META_KEY,
              UpdateExpression: "SET #c = if_not_exists(#c, :zero) + :one",
              ConditionExpression: "attribute_not_exists(#c) OR #c < :max",
              ExpressionAttributeNames: { "#c": "count" },
              ExpressionAttributeValues: { ":zero": 0, ":one": 1, ":max": maxUsers },
            },
          },
        ],
      })
    );
  } catch (e) {
    if (e.name === "TransactionCanceledException") {
      const [userReason, metaReason] = (e.CancellationReasons || []).map((r) => r?.Code);
      if (userReason === "ConditionalCheckFailed") throw codedError("id_taken");
      if (metaReason === "ConditionalCheckFailed") throw codedError("full");
    }
    throw e;
  }
}

async function updateUser(loginId, fields) {
  const names = {};
  const values = {};
  const sets = Object.keys(fields).map((k, i) => {
    names[`#f${i}`] = k;
    values[`:v${i}`] = fields[k];
    return `#f${i} = :v${i}`;
  });
  await doc.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: userKey(loginId),
      UpdateExpression: `SET ${sets.join(", ")}`,
      ConditionExpression: "attribute_exists(pk)",
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

async function getSave(loginId) {
  const res = await doc.send(new GetCommand({ TableName: TABLE, Key: saveKey(loginId) }));
  if (!res.Item) return null;
  const { pk, sk, ...save } = res.Item;
  return save;
}

// Optimistic concurrency: only writes if the stored rev is still baseRev
// (0 = no save yet), so two devices can't silently overwrite each other.
async function putSave(loginId, record, baseRev) {
  try {
    await doc.send(
      new PutCommand({
        TableName: TABLE,
        Item: { ...saveKey(loginId), ...record },
        ConditionExpression: baseRev === 0 ? "attribute_not_exists(pk)" : "rev = :base",
        ExpressionAttributeValues: baseRev === 0 ? undefined : { ":base": baseRev },
      })
    );
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") throw codedError("conflict");
    throw e;
  }
}

// --- admin helpers (backend/scripts/accounts.js) ---

async function listUsers() {
  const users = [];
  let ExclusiveStartKey;
  do {
    const res = await doc.send(
      // A scan is fine at this size (≤ 100 accounts) and saves a GSI.
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "sk = :p",
        ExpressionAttributeValues: { ":p": "PROFILE" },
        ExclusiveStartKey,
      })
    );
    for (const { pk, sk, pinHash, ...u } of res.Items || []) users.push(u);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return users;
}

// Save metadata for every account (no save data), for the admin page.
async function listSaves() {
  const saves = [];
  let ExclusiveStartKey;
  do {
    const res = await doc.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "sk = :s",
        ProjectionExpression: "pk, rev, updatedAt, device",
        ExpressionAttributeValues: { ":s": "SAVE" },
        ExclusiveStartKey,
      })
    );
    for (const { pk, ...save } of res.Items || []) saves.push({ loginId: pk.slice("LOGIN#".length), ...save });
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return saves;
}

async function deleteUser(loginId) {
  const user = await getUser(loginId);
  if (!user) throw codedError("not_found");
  const items = [
    {
      Delete: {
        TableName: TABLE,
        Key: userKey(loginId),
        ConditionExpression: "attribute_exists(pk)",
      },
    },
  ];
  if (!user.uncounted) {
    items.push({
      Update: {
        TableName: TABLE,
        Key: META_KEY,
        UpdateExpression: "SET #c = #c - :one",
        ConditionExpression: "#c > :zero",
        ExpressionAttributeNames: { "#c": "count" },
        ExpressionAttributeValues: { ":zero": 0, ":one": 1 },
      },
    });
  }
  await doc.send(new TransactWriteCommand({ TransactItems: items }));
  await doc.send(new DeleteCommand({ TableName: TABLE, Key: saveKey(loginId) }));
}

// Moves an account (profile + cloud save) to a new Player ID in one
// transaction, applying `fields` to the profile on the way. The old save is
// only removed if it is still the revision we copied (or still absent), so
// an upload that lands mid-rename is never lost: we re-read and try again.
const RENAME_TRIES = 3;
async function renameUser(oldId, newId, fields) {
  for (let attempt = 1; ; attempt++) {
    const user = await getUser(oldId);
    if (!user) throw codedError("not_found");
    const save = await getSave(oldId);
    const items = [
      {
        Put: {
          TableName: TABLE,
          Item: { ...userKey(newId), ...user, ...fields, loginId: newId },
          ConditionExpression: "attribute_not_exists(pk)",
        },
      },
      { Delete: { TableName: TABLE, Key: userKey(oldId), ConditionExpression: "attribute_exists(pk)" } },
    ];
    if (save) {
      items.push(
        {
          Put: {
            TableName: TABLE,
            Item: { ...saveKey(newId), ...save },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
        {
          Delete: {
            TableName: TABLE,
            Key: saveKey(oldId),
            ConditionExpression: "rev = :rev",
            ExpressionAttributeValues: { ":rev": save.rev },
          },
        }
      );
    } else {
      items.push({
        ConditionCheck: { TableName: TABLE, Key: saveKey(oldId), ConditionExpression: "attribute_not_exists(pk)" },
      });
    }
    try {
      await doc.send(new TransactWriteCommand({ TransactItems: items }));
      return;
    } catch (e) {
      if (e.name !== "TransactionCanceledException") throw e;
      const failed = (e.CancellationReasons || []).map((r) => r?.Code === "ConditionalCheckFailed");
      if (failed[0]) throw codedError("id_taken");
      if (failed[1]) throw codedError("not_found");
      // The save changed under us (an upload mid-rename): read it again.
      if ((failed[2] || failed[3]) && attempt < RENAME_TRIES) continue;
      throw e;
    }
  }
}

// ---------- access log ----------
// One partition per UTC day: pk "LOG#2026-10-25", sk "<ISO time>#<random>".
// Items expire by themselves through the table's TTL attribute `ttl`.

const LOG_LIMIT_PER_DAY = 500;

async function addLog(entry, ttlSec) {
  const day = entry.at.slice(0, 10);
  await doc.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `LOG#${day}`,
        sk: `${entry.at}#${Math.random().toString(36).slice(2, 8)}`,
        ...entry,
        ttl: Math.floor(Date.parse(entry.at) / 1000) + ttlSec,
      },
    })
  );
}

// Newest first.
async function listLogs(day) {
  const res = await doc.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": `LOG#${day}` },
      ScanIndexForward: false,
      Limit: LOG_LIMIT_PER_DAY,
    })
  );
  return (res.Items || []).map(({ pk, sk, ttl, ...entry }) => entry);
}

// ---------- error reports ----------
// pk "ERR", sk = signature (same page + message + file + line → one item).

const errKey = (sig) => ({ pk: "ERR", sk: sig });

// Adds one occurrence: bumps `count`, keeps the latest details, remembers
// who was affected, and pushes `ttl` forward so quiet errors expire.
async function recordError(sig, report, loginId, ttlSec) {
  const names = {
    "#count": "count", "#status": "status", "#ttl": "ttl", "#page": "page", "#message": "message",
    "#source": "source", "#line": "line", "#col": "col", "#stack": "stack", "#lastAt": "lastAt",
    "#firstAt": "firstAt", "#lastDevice": "lastDevice", "#lastUserAgent": "lastUserAgent",
    "#lastVersion": "lastVersion", "#kind": "kind", "#url": "url",
  };
  const values = {
    ":one": 1, ":new": "new", ":ttl": Math.floor(Date.parse(report.at) / 1000) + ttlSec,
    ":page": report.page, ":message": report.message, ":source": report.source, ":line": report.line,
    ":col": report.col, ":stack": report.stack, ":at": report.at, ":device": report.device,
    ":ua": report.userAgent, ":version": report.version, ":kind": report.kind, ":url": report.url,
  };
  let update =
    "SET #page = :page, #message = :message, #source = :source, #line = :line, #col = :col, " +
    "#stack = :stack, #lastAt = :at, #firstAt = if_not_exists(#firstAt, :at), #lastDevice = :device, " +
    "#lastUserAgent = :ua, #lastVersion = :version, #kind = :kind, #url = :url, " +
    "#status = if_not_exists(#status, :new), #ttl = :ttl ADD #count :one";
  if (loginId) {
    names["#users"] = "users";
    values[":user"] = new Set([loginId]);
    update += ", #users :user";
  }
  await doc.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: errKey(sig),
      UpdateExpression: update,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

async function listErrors() {
  const res = await doc.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "ERR" },
    })
  );
  return (res.Items || []).map(({ pk, sk, ttl, users, ...e }) => ({ sig: sk, users: users ? [...users] : [], ...e }));
}

async function updateError(sig, fields) {
  const names = {};
  const values = {};
  const sets = Object.keys(fields).map((k, i) => {
    names[`#f${i}`] = k;
    values[`:v${i}`] = fields[k];
    return `#f${i} = :v${i}`;
  });
  try {
    await doc.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: errKey(sig),
        UpdateExpression: `SET ${sets.join(", ")}`,
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      })
    );
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") throw codedError("not_found");
    throw e;
  }
}

async function deleteError(sig) {
  await doc.send(new DeleteCommand({ TableName: TABLE, Key: errKey(sig) }));
}

module.exports = {
  getUser, createUser, updateUser, getSave, putSave, listUsers, listSaves, deleteUser, renameUser,
  addLog, listLogs, recordError, listErrors, updateError, deleteError,
};
