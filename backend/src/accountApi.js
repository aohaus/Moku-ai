const crypto = require("crypto");
const { json } = require("./response");
const token = require("./token");
const { hashPin, verifyPin, burnPinCheck, isWeakPin } = require("./pin");

// Accounts + cloud save for Moku Series (see API_SPEC.md "Accounts").
// The routing/validation here is storage-agnostic: `store` is either
// accountStore.js (DynamoDB, production) or memoryStore.js (server.js dev mock).

const LOGIN_ID_RE = /^[a-z0-9_-]{3,16}$/;
// Kids can't sign up with these (the admin account is made by scripts/accounts.js).
const RESERVED_IDS = ["admin", "administrator", "root", "moku", "mokumoku", "system"];
const PIN_RE = /^\d{4,6}$/;
const MAX_DISPLAY_NAME_LEN = 12;
const MAX_SAVE_BYTES = 300 * 1024; // DynamoDB items cap at 400 KB
const MAX_SAVE_KEY_LEN = 200;
const MAX_DEVICE_LEN = 40;
// lastSeenAt is written at most this often per player, and anyone seen
// within ONLINE_WINDOW_MS counts as "online" in GET /players.
const SEEN_WRITE_EVERY_MS = 60 * 1000;
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

// Every 5th wrong PIN in a row locks the ID: 15 min, then 30, 60 … up to 24 h.
const FAILS_PER_LOCK = 5;
const BASE_LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 24 * 60 * 60 * 1000;

function err(statusCode, code, message, extra = {}) {
  return json(statusCode, { error: code, message, ...extra });
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  try {
    const body = JSON.parse(raw);
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

function normalizeLoginId(id) {
  return typeof id === "string" ? id.trim().toLowerCase() : "";
}

// Display names end up on public leaderboards (Dreamlo), whose name field
// can't carry "#" (our name#tag separator), "*", "|", "/" or "\".
function cleanDisplayName(name) {
  if (typeof name !== "string") return "";
  return name.replace(/[\u0000-\u001f\u007f#*|/\\]/g, "").trim().slice(0, MAX_DISPLAY_NAME_LEN);
}

function sameSecret(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function lockMs(failCount) {
  const step = Math.floor(failCount / FAILS_PER_LOCK) - 1;
  return Math.min(BASE_LOCK_MS * 2 ** Math.max(0, step), MAX_LOCK_MS);
}

// What other players may see.
function publicUserView(user) {
  return {
    displayName: user.displayName,
    // Public leaderboard tag. Starts with "u", which never appears in the
    // hex device-id suffix guests get, so the two can't be confused.
    tag: `u${user.uid.slice(0, 5)}`,
  };
}

// What the player sees about themselves.
function publicUser(user) {
  return { loginId: user.loginId, ...publicUserView(user), ...(isAdmin(user) ? { admin: true } : {}) };
}

function isAdmin(user) {
  return user?.role === "admin";
}

// What the admin page sees about each account (never the PIN hash).
function adminView(user, save, t) {
  return {
    loginId: user.loginId,
    ...publicUserView(user),
    admin: isAdmin(user),
    createdAt: user.createdAt || null,
    lastSeenAt: user.lastSeenAt ? new Date(user.lastSeenAt).toISOString() : null,
    online: !!user.lastSeenAt && t - user.lastSeenAt < ONLINE_WINDOW_MS,
    failCount: user.failCount || 0,
    lockedUntil: user.lockedUntil > t ? new Date(user.lockedUntil).toISOString() : null,
    save: save ? { rev: save.rev, updatedAt: save.updatedAt, device: save.device || "" } : null,
  };
}

// Shared by sign-up and the admin page. Returns an error response or null.
function checkLoginId(loginId) {
  if (!LOGIN_ID_RE.test(loginId)) return err(400, "invalid_login_id", "Player ID: 3–16 letters, numbers, - or _.");
  if (RESERVED_IDS.includes(loginId)) return err(409, "id_taken", "That Player ID is already taken.");
  return null;
}
function checkPin(pin) {
  if (!PIN_RE.test(pin)) return err(400, "invalid_pin", "PIN: 4–6 numbers.");
  if (isWeakPin(pin)) return err(400, "weak_pin", "That PIN is too easy to guess.");
  return null;
}

function issueToken(user, secret, now) {
  return token.sign(
    { lid: user.loginId, uid: user.uid, name: user.displayName, tv: user.tv },
    secret,
    now
  );
}

function createAccountApi(store, config) {
  const { authSecret, inviteCode, maxUsers = 100, now = () => Date.now() } = config;
  if (!authSecret || authSecret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters");
  }

  // Resolves the bearer token to the current user record, or null.
  // The `tv` (token version) check makes a PIN change log out other devices.
  async function authenticate(event) {
    const header = event.headers?.authorization || event.headers?.Authorization || "";
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    const payload = match && token.verify(match[1], authSecret, now());
    if (!payload) return null;
    const user = await store.getUser(payload.lid);
    if (!user || user.uid !== payload.uid || user.tv !== payload.tv) return null;
    await markSeen(user);
    // The admin may rename someone; GET /auth/me hands out a fresh token then.
    user.tokenIsStale = payload.name !== user.displayName;
    return user;
  }

  // Feeds the "online" list. Best effort: a failed write never fails the request.
  async function markSeen(user) {
    const t = now();
    if (user.lastSeenAt && t - user.lastSeenAt < SEEN_WRITE_EVERY_MS) return;
    user.lastSeenAt = t;
    try {
      await store.updateUser(user.loginId, { lastSeenAt: t });
    } catch (e) {
      console.error(e);
    }
  }

  // Everyone with an account, newest activity first. Only display names and
  // public tags — never the Player ID, which is half of someone's login.
  async function listPlayers(me) {
    const t = now();
    const players = (await store.listUsers()).filter((u) => !isAdmin(u)).map((u) => ({
      ...publicUserView(u),
      lastSeenAt: u.lastSeenAt ? new Date(u.lastSeenAt).toISOString() : null,
      online: !!u.lastSeenAt && t - u.lastSeenAt < ONLINE_WINDOW_MS,
      you: u.uid === me.uid,
    }));
    players.sort((a, b) => (b.lastSeenAt || "").localeCompare(a.lastSeenAt || ""));
    return json(200, { players, onlineWindowSec: ONLINE_WINDOW_MS / 1000 });
  }

  async function register(body) {
    if (!inviteCode) return err(403, "registration_closed", "New accounts are closed.");
    if (!sameSecret(String(body.inviteCode || "").trim(), inviteCode)) {
      return err(403, "bad_invite", "That invite code doesn't work.");
    }
    return createAccount(body, true);
  }

  // Sign-up (signIn: log the new player in) or the admin page adding someone.
  async function createAccount(body, signIn) {
    const loginId = normalizeLoginId(body.loginId);
    const pin = String(body.pin ?? "");
    const invalid = checkLoginId(loginId) || checkPin(pin);
    if (invalid) return invalid;
    const displayName = cleanDisplayName(body.displayName) || loginId.slice(0, MAX_DISPLAY_NAME_LEN);

    const user = {
      loginId,
      uid: crypto.randomBytes(8).toString("hex"),
      displayName,
      pinHash: await hashPin(pin),
      tv: 1,
      failCount: 0,
      lockedUntil: 0,
      lastSeenAt: signIn ? now() : 0,
      createdAt: new Date(now()).toISOString(),
    };
    try {
      await store.createUser(user, maxUsers);
    } catch (e) {
      if (e.code === "id_taken") return err(409, "id_taken", "That Player ID is already taken.");
      if (e.code === "full") return err(403, "full", "Moku Series is full right now.");
      throw e;
    }
    if (!signIn) return json(201, { user: adminView(user, null, now()) });
    return json(201, { token: issueToken(user, authSecret, now()), user: publicUser(user) });
  }

  // ---------- admin (role "admin", see scripts/accounts.js create-admin) ----------

  async function adminListUsers() {
    const [users, saves] = await Promise.all([store.listUsers(), store.listSaves()]);
    const saveOf = new Map(saves.map((sv) => [sv.loginId, sv]));
    const t = now();
    const list = users
      .map((u) => adminView(u, saveOf.get(u.loginId), t))
      .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    return json(200, { users: list, count: users.filter((u) => !u.uncounted).length, maxUsers });
  }

  // Change any of: displayName, pin (logs their devices out), unlock,
  // loginId (moves the account + save; also logs their devices out).
  async function adminUpdateUser(loginId, body) {
    const target = await store.getUser(loginId);
    if (!target) return err(404, "not_found", "No such player.");
    const fields = {};
    if (body.displayName !== undefined) {
      const name = cleanDisplayName(body.displayName);
      if (!name) return err(400, "invalid_name", "Name can't be empty.");
      fields.displayName = name;
    }
    if (body.pin) {
      const invalid = checkPin(String(body.pin));
      if (invalid) return invalid;
      fields.pinHash = await hashPin(String(body.pin));
      fields.tv = target.tv + 1;
    }
    if (body.pin || body.unlock) {
      fields.failCount = 0;
      fields.lockedUntil = 0;
    }
    const newId = body.loginId === undefined ? loginId : normalizeLoginId(body.loginId);
    if (newId !== loginId) {
      // Reserved IDs are fine for the admin account itself.
      const invalid = isAdmin(target) && LOGIN_ID_RE.test(newId) ? null : checkLoginId(newId);
      if (invalid) return invalid;
      fields.tv = (fields.tv || target.tv) + 1;
      try {
        await store.renameUser(loginId, newId, fields);
      } catch (e) {
        if (e.code === "id_taken") return err(409, "id_taken", "That Player ID is already taken.");
        throw e;
      }
    } else if (Object.keys(fields).length) {
      await store.updateUser(loginId, fields);
    }
    const saves = await store.listSaves();
    const updated = await store.getUser(newId);
    return json(200, { user: adminView(updated, saves.find((sv) => sv.loginId === newId), now()) });
  }

  async function adminDeleteUser(me, loginId) {
    if (loginId === me.loginId) return err(400, "cannot_delete_self", "You can't delete your own admin account.");
    try {
      await store.deleteUser(loginId);
    } catch (e) {
      if (e.code === "not_found") return err(404, "not_found", "No such player.");
      throw e;
    }
    return json(200, { deleted: loginId });
  }

  async function login(body) {
    const loginId = normalizeLoginId(body.loginId);
    const pin = String(body.pin ?? "");
    const badCredentials = () => err(401, "bad_credentials", "Player ID or PIN is wrong.");
    if (!LOGIN_ID_RE.test(loginId) || !PIN_RE.test(pin)) return badCredentials();

    const user = await store.getUser(loginId);
    if (!user) {
      await burnPinCheck(pin);
      return badCredentials();
    }
    const t = now();
    if (user.lockedUntil > t) {
      return err(429, "locked", "Too many tries. Please wait and try again.", {
        retryAfterSec: Math.ceil((user.lockedUntil - t) / 1000),
      });
    }
    if (!(await verifyPin(pin, user.pinHash))) {
      const failCount = (user.failCount || 0) + 1;
      const locking = failCount % FAILS_PER_LOCK === 0;
      const lockedUntil = locking ? t + lockMs(failCount) : user.lockedUntil || 0;
      await store.updateUser(loginId, { failCount, lockedUntil });
      if (locking) {
        return err(429, "locked", "Too many tries. Please wait and try again.", {
          retryAfterSec: Math.ceil((lockedUntil - t) / 1000),
        });
      }
      return badCredentials();
    }
    await store.updateUser(loginId, { failCount: 0, lockedUntil: 0, lastSeenAt: t });
    return json(200, { token: issueToken(user, authSecret, t), user: publicUser(user) });
  }

  async function changePin(user, body) {
    if (!(await verifyPin(String(body.currentPin ?? ""), user.pinHash))) {
      return err(401, "bad_credentials", "Current PIN is wrong.");
    }
    const pin = String(body.newPin ?? "");
    if (!PIN_RE.test(pin)) return err(400, "invalid_pin", "PIN: 4–6 numbers.");
    if (isWeakPin(pin)) return err(400, "weak_pin", "That PIN is too easy to guess.");
    const updated = { ...user, pinHash: await hashPin(pin), tv: user.tv + 1 };
    await store.updateUser(user.loginId, { pinHash: updated.pinHash, tv: updated.tv });
    return json(200, { token: issueToken(updated, authSecret, now()), user: publicUser(updated) });
  }

  async function getSave(user) {
    const save = await store.getSave(user.loginId);
    if (!save) return json(200, { save: null });
    return json(200, {
      save: { rev: save.rev, updatedAt: save.updatedAt, device: save.device, data: JSON.parse(save.data) },
    });
  }

  async function putSave(user, body) {
    const { data, baseRev } = body;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return err(400, "invalid_save", "data must be an object of strings.");
    }
    for (const [k, v] of Object.entries(data)) {
      if (k.length > MAX_SAVE_KEY_LEN || typeof v !== "string") {
        return err(400, "invalid_save", "data must be an object of strings.");
      }
    }
    if (!Number.isInteger(baseRev) || baseRev < 0) {
      return err(400, "invalid_save", "baseRev must be a non-negative integer.");
    }
    const serialized = JSON.stringify(data);
    if (Buffer.byteLength(serialized, "utf8") > MAX_SAVE_BYTES) {
      return err(413, "too_large", "Save data is too big.");
    }
    const record = {
      data: serialized,
      rev: baseRev + 1,
      updatedAt: new Date(now()).toISOString(),
      device: typeof body.device === "string" ? body.device.slice(0, MAX_DEVICE_LEN) : "",
    };
    try {
      await store.putSave(user.loginId, record, baseRev);
    } catch (e) {
      if (e.code !== "conflict") throw e;
      const current = await store.getSave(user.loginId);
      return err(409, "conflict", "Cloud save changed on another device.", { rev: current?.rev ?? 0 });
    }
    return json(200, { rev: record.rev, updatedAt: record.updatedAt });
  }

  return async function handler(event) {
    const method = event.requestContext?.http?.method || "GET";
    const path = (event.rawPath || "/").replace(/\/+$/, "") || "/";
    const route = `${method} ${path}`;

    try {
      if (route === "POST /auth/register" || route === "POST /auth/login") {
        const body = parseBody(event);
        if (!body) return err(400, "invalid_json", "invalid JSON body");
        return route === "POST /auth/login" ? await login(body) : await register(body);
      }

      const authed = ["GET /auth/me", "POST /auth/pin", "GET /save", "PUT /save", "GET /players"];
      const adminUser = /^\/admin\/users\/([^/]+)$/.exec(path);
      const adminRoute =
        route === "GET /admin/users" || route === "POST /admin/users" ||
        (adminUser && (method === "PATCH" || method === "DELETE"));
      if (!authed.includes(route) && !adminRoute) return err(404, "not_found", "not found");

      const user = await authenticate(event);
      if (!user) return err(401, "unauthorized", "Please log in again.");

      if (adminRoute) {
        if (!isAdmin(user)) return err(403, "forbidden", "Admins only.");
        if (route === "GET /admin/users") return await adminListUsers();
        if (method === "DELETE") return await adminDeleteUser(user, decodeURIComponent(adminUser[1]));
        const adminBody = parseBody(event);
        if (!adminBody) return err(400, "invalid_json", "invalid JSON body");
        if (route === "POST /admin/users") return await createAccount(adminBody, false);
        return await adminUpdateUser(decodeURIComponent(adminUser[1]), adminBody);
      }

      if (route === "GET /auth/me") {
        return json(200, {
          user: publicUser(user),
          ...(user.tokenIsStale ? { token: issueToken(user, authSecret, now()) } : {}),
        });
      }
      if (route === "GET /save") return await getSave(user);
      if (route === "GET /players") return await listPlayers(user);

      const body = parseBody(event);
      if (!body) return err(400, "invalid_json", "invalid JSON body");
      return route === "POST /auth/pin" ? await changePin(user, body) : await putSave(user, body);
    } catch (e) {
      console.error(e);
      return err(500, "internal", "internal error");
    }
  };
}

let prodHandler = null;

// Lambda entry point. The DynamoDB store is required lazily so the dev mock
// (backend/dev/mount.js) can load this file without the AWS SDK installed.
exports.handler = async (event) => {
  if (!prodHandler) {
    prodHandler = createAccountApi(require("./accountStore"), {
      authSecret: process.env.AUTH_SECRET,
      inviteCode: process.env.INVITE_CODE,
      maxUsers: parseInt(process.env.MAX_USERS, 10) || 100,
    });
  }
  return prodHandler(event);
};

exports.createAccountApi = createAccountApi;
