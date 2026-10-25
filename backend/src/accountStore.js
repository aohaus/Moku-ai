const {
  GetCommand,
  UpdateCommand,
  PutCommand,
  TransactWriteCommand,
  DeleteCommand,
  ScanCommand,
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

module.exports = {
  getUser, createUser, updateUser, getSave, putSave, listUsers, listSaves, deleteUser, renameUser,
};
