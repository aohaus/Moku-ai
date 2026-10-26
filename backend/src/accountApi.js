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
// Hollow (hub.html#hollow): each player's public card — what their Moku
// wears and a few highlights. Built by the hub, sent with PUT /save.
const CARD_SLOTS = ["head", "mood", "face", "neck", "bg"];
const MAX_CARD_HIGHLIGHTS = 4;
const CARD_ID_RE = /^[a-z0-9-]{1,40}$/;
const MAX_CARD_RECORDS = 40;           // one record per game (hub Achievements page)
const MAX_CARD_RECORD = 1e9;
// lastSeenAt is written at most this often per player, and anyone seen
// within ONLINE_WINDOW_MS counts as "online" in GET /players.
const SEEN_WRITE_EVERY_MS = 60 * 1000;
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
// Access log (admin page): kept 90 days, at most 30 days per request.
const LOG_TTL_SEC = 90 * 24 * 60 * 60;
const MAX_LOG_DAYS = 30;
const MAX_LOGGED_KEYS = 30;
// Error reports (shared/moku-errors.js): kept until 60 days after the last one.
const ERROR_TTL_SEC = 60 * 24 * 60 * 60;
const ERROR_STATUSES = ["new", "fix", "watch", "ignore"];
const ERROR_KINDS = ["error", "rejection", "resource"];
// Save keys that change without anyone playing (sync stamps, hub streak).
const NOT_PLAY_KEYS = [/^moku:meta:/, /^moku:stats:/];

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

function cleanCardText(s, max) {
  return typeof s === "string" ? s.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : "";
}

// Keeps only short, plain values: item ids for the outfit, short strings
// for highlights. Nothing from the save itself is ever shown to others.
function cleanCard(card, t) {
  if (!card || typeof card !== "object" || Array.isArray(card)) return null;
  const outfit = {};
  const src = card.outfit && typeof card.outfit === "object" ? card.outfit : {};
  for (const slot of CARD_SLOTS) {
    if (typeof src[slot] === "string" && CARD_ID_RE.test(src[slot])) outfit[slot] = src[slot];
  }
  const highlights = (Array.isArray(card.highlights) ? card.highlights : [])
    .slice(0, MAX_CARD_HIGHLIGHTS)
    .map((h) => (h && typeof h === "object" ? {
      icon: cleanCardText(h.icon, 8),
      title: cleanCardText(h.title, 32),
      value: cleanCardText(h.value, 40),
      game: typeof h.game === "string" && CARD_ID_RE.test(h.game) ? h.game : "",
    } : null))
    .filter((h) => h && h.title);
  // records: { gameId: number } for the Achievements Top 3 (whole numbers, 0..1e9)
  const records = {};
  const rsrc = card.records && typeof card.records === "object" && !Array.isArray(card.records) ? card.records : {};
  for (const id of Object.keys(rsrc).slice(0, MAX_CARD_RECORDS)) {
    const v = rsrc[id];
    if (CARD_ID_RE.test(id) && typeof v === "number" && Number.isFinite(v) && v > 0) records[id] = Math.min(MAX_CARD_RECORD, Math.round(v));
  }
  const out = { outfit, highlights, records, updatedAt: new Date(t).toISOString() };
  if (Number.isInteger(card.level) && card.level > 0 && card.level < 10000) out.level = card.level;
  return out;
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

// Same rough labels as shared/moku-account.js deviceLabel().
function deviceFromUA(ua) {
  ua = String(ua || "");
  if (/iPad/.test(ua)) return "iPad";
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android phone" : "Android tablet";
  if (/CrOS/.test(ua)) return "Chromebook";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  return ua ? "Browser" : "";
}

// Save keys whose values differ between two saves (added, changed or removed).
function changedKeys(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((k) => before[k] !== after[k] && !NOT_PLAY_KEYS.some((re) => re.test(k)))
    .sort();
}

// Validates and trims an error report from the browser. null = drop it.
function cleanErrorReport(body, device, userAgent, at) {
  const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
  const int = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
  const message = str(body.message, 500).trim();
  if (!message) return null;
  return {
    at,
    page: str(body.page, 100).replace(/[^\w.\-/]/g, "") || "unknown",
    message,
    source: str(body.source, 300),
    line: int(body.line),
    col: int(body.col),
    stack: str(body.stack, 4000),
    version: str(body.version, 60),
    kind: ERROR_KINDS.includes(body.kind) ? body.kind : "error",
    url: str(body.url, 300),
    device,
    userAgent: str(userAgent, 300),
  };
}

// Same page + message + file + line = the same error.
function errorSignature(r) {
  const file = r.source.split(/[?#]/)[0];
  return crypto
    .createHash("sha256")
    .update([r.page, r.message.slice(0, 200), file, r.line].join("|"))
    .digest("hex")
    .slice(0, 16);
}

// Most important first: "fix" / "new" before "watch" / "ignore", then how
// many players hit it, how often, and how recently.
const ERROR_STATUS_ORDER = { fix: 0, new: 1, watch: 2, ignore: 3 };
function errorRank(a, b) {
  const order = (e) => ERROR_STATUS_ORDER[e.status] ?? 1;
  return order(a) - order(b) || b.users.length - a.users.length || b.count - a.count ||
    (b.lastAt || "").localeCompare(a.lastAt || "");
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

  // Access log for the admin page. Best effort: never fails the request.
  // Never pass PINs in `detail`.
  async function record(type, who, detail, device) {
    try {
      await store.addLog(
        {
          at: new Date(now()).toISOString(),
          type,
          loginId: who?.loginId || null,
          displayName: who?.displayName || null,
          device: device || "",
          ...(detail ? { detail } : {}),
        },
        LOG_TTL_SEC
      );
    } catch (e) {
      console.error(e);
    }
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
      card: u.card || null,
    }));
    players.sort((a, b) => (b.lastSeenAt || "").localeCompare(a.lastSeenAt || ""));
    return json(200, { players, onlineWindowSec: ONLINE_WINDOW_MS / 1000 });
  }

  async function register(body, device) {
    if (!inviteCode) return err(403, "registration_closed", "New accounts are closed.");
    if (!sameSecret(String(body.inviteCode || "").trim(), inviteCode)) {
      return err(403, "bad_invite", "That invite code doesn't work.");
    }
    return createAccount(body, null, device);
  }

  // Sign-up (admin = null: log the new player in) or the admin page adding someone.
  async function createAccount(body, admin, device) {
    const signIn = !admin;
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
    if (!signIn) {
      await record("admin_create", user, { by: admin.loginId }, device);
      return json(201, { user: adminView(user, null, now()) });
    }
    await record("register", user, null, device);
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
  async function adminUpdateUser(admin, loginId, body, device) {
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
    const changes = [];
    if (newId !== loginId) changes.push("loginId");
    if (fields.displayName) changes.push("displayName");
    if (body.pin) changes.push("pin");
    else if (body.unlock) changes.push("unlock");
    const saves = await store.listSaves();
    const updated = await store.getUser(newId);
    if (changes.length) {
      await record("admin_update", updated, {
        by: admin.loginId, changes,
        ...(newId !== loginId ? { from: loginId } : {}),
        ...(fields.displayName && fields.displayName !== target.displayName ? { fromName: target.displayName } : {}),
      }, device);
    }
    return json(200, { user: adminView(updated, saves.find((sv) => sv.loginId === newId), now()) });
  }

  async function adminDeleteUser(me, loginId, device) {
    if (loginId === me.loginId) return err(400, "cannot_delete_self", "You can't delete your own admin account.");
    const target = await store.getUser(loginId);
    try {
      await store.deleteUser(loginId);
    } catch (e) {
      if (e.code === "not_found") return err(404, "not_found", "No such player.");
      throw e;
    }
    await record("admin_delete", target, { by: me.loginId }, device);
    return json(200, { deleted: loginId });
  }

  // GET /admin/logs?days=7&loginId=aoi — newest first.
  async function adminListLogs(query) {
    const days = Math.min(Math.max(parseInt(query.days, 10) || 7, 1), MAX_LOG_DAYS);
    const only = query.loginId ? normalizeLoginId(query.loginId) : null;
    const today = now();
    const lists = await Promise.all(
      Array.from({ length: days }, (_, i) => store.listLogs(new Date(today - i * 86400000).toISOString().slice(0, 10)))
    );
    let logs = lists.flat();
    if (only) logs = logs.filter((l) => l.loginId === only || l.detail?.from === only);
    logs.sort((a, b) => b.at.localeCompare(a.at));
    return json(200, { logs, days });
  }

  // POST /errors — no login needed (guests' errors count too). A logged-in
  // player's token comes in the body so the request stays a simple CORS
  // request (no preflight); it only adds who was affected.
  async function reportError(body, device, userAgent) {
    const report = cleanErrorReport(body, device, userAgent, new Date(now()).toISOString());
    if (!report) return err(400, "invalid_report", "message is required");
    const who = typeof body.auth === "string" ? token.verify(body.auth, authSecret, now()) : null;
    await store.recordError(errorSignature(report), report, who?.lid || null, ERROR_TTL_SEC);
    return json(200, { ok: true });
  }

  async function adminListErrors() {
    const errors = (await store.listErrors()).sort(errorRank);
    return json(200, { errors });
  }

  async function adminUpdateError(sig, body) {
    const fields = {};
    if (body.status !== undefined) {
      if (!ERROR_STATUSES.includes(body.status)) return err(400, "invalid_status", "status: new, fix, watch or ignore");
      fields.status = body.status;
    }
    if (body.note !== undefined) fields.note = String(body.note).slice(0, 500);
    if (!Object.keys(fields).length) return err(400, "invalid_request", "nothing to change");
    try {
      await store.updateError(sig, fields);
    } catch (e) {
      if (e.code === "not_found") return err(404, "not_found", "No such error.");
      throw e;
    }
    return json(200, { updated: sig });
  }

  async function login(body, device) {
    const loginId = normalizeLoginId(body.loginId);
    const pin = String(body.pin ?? "");
    const badCredentials = () => err(401, "bad_credentials", "Player ID or PIN is wrong.");
    if (!LOGIN_ID_RE.test(loginId) || !PIN_RE.test(pin)) return badCredentials();

    const user = await store.getUser(loginId);
    if (!user) {
      await burnPinCheck(pin);
      await record("login_failed", { loginId }, { reason: "unknown_id" }, device);
      return badCredentials();
    }
    const t = now();
    if (user.lockedUntil > t) {
      await record("login_failed", user, { reason: "locked" }, device);
      return err(429, "locked", "Too many tries. Please wait and try again.", {
        retryAfterSec: Math.ceil((user.lockedUntil - t) / 1000),
      });
    }
    if (!(await verifyPin(pin, user.pinHash))) {
      const failCount = (user.failCount || 0) + 1;
      const locking = failCount % FAILS_PER_LOCK === 0;
      const lockedUntil = locking ? t + lockMs(failCount) : user.lockedUntil || 0;
      await store.updateUser(loginId, { failCount, lockedUntil });
      await record(locking ? "locked" : "login_failed", user, { reason: "wrong_pin", failCount }, device);
      if (locking) {
        return err(429, "locked", "Too many tries. Please wait and try again.", {
          retryAfterSec: Math.ceil((lockedUntil - t) / 1000),
        });
      }
      return badCredentials();
    }
    await store.updateUser(loginId, { failCount: 0, lockedUntil: 0, lastSeenAt: t });
    await record("login", user, null, device);
    return json(200, { token: issueToken(user, authSecret, t), user: publicUser(user) });
  }

  async function changePin(user, body, device) {
    if (!(await verifyPin(String(body.currentPin ?? ""), user.pinHash))) {
      return err(401, "bad_credentials", "Current PIN is wrong.");
    }
    const pin = String(body.newPin ?? "");
    if (!PIN_RE.test(pin)) return err(400, "invalid_pin", "PIN: 4–6 numbers.");
    if (isWeakPin(pin)) return err(400, "weak_pin", "That PIN is too easy to guess.");
    const updated = { ...user, pinHash: await hashPin(pin), tv: user.tv + 1 };
    await store.updateUser(user.loginId, { pinHash: updated.pinHash, tv: updated.tv });
    await record("pin_change", user, null, device);
    return json(200, { token: issueToken(updated, authSecret, now()), user: publicUser(updated) });
  }

  async function getSave(user) {
    const save = await store.getSave(user.loginId);
    if (!save) return json(200, { save: null });
    return json(200, {
      save: { rev: save.rev, updatedAt: save.updatedAt, device: save.device, data: JSON.parse(save.data) },
    });
  }

  async function putSave(user, body, device) {
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
    const saved = {
      data: serialized,
      rev: baseRev + 1,
      updatedAt: new Date(now()).toISOString(),
      device: typeof body.device === "string" ? body.device.slice(0, MAX_DEVICE_LEN) : "",
    };
    const before = await store.getSave(user.loginId);
    try {
      await store.putSave(user.loginId, saved, baseRev);
    } catch (e) {
      if (e.code !== "conflict") throw e;
      const current = await store.getSave(user.loginId);
      return err(409, "conflict", "Cloud save changed on another device.", { rev: current?.rev ?? 0 });
    }
    // Hollow card: only the hub sends one; game pages leave the last one as is.
    if (body.card !== undefined) {
      const card = cleanCard(body.card, now());
      if (card) await store.updateUser(user.loginId, { card });
    }
    // "Play" = which save keys this upload changed (the admin page maps them to games).
    const keys = changedKeys(before ? JSON.parse(before.data) : {}, data);
    if (keys.length) {
      await record("play", user, { keys: keys.slice(0, MAX_LOGGED_KEYS), rev: saved.rev }, saved.device || device);
    }
    return json(200, { rev: saved.rev, updatedAt: saved.updatedAt });
  }

  return async function handler(event) {
    const method = event.requestContext?.http?.method || "GET";
    const path = (event.rawPath || "/").replace(/\/+$/, "") || "/";
    const route = `${method} ${path}`;
    const device = deviceFromUA(event.headers?.["user-agent"] || event.headers?.["User-Agent"]);

    try {
      if (route === "POST /errors") {
        const body = parseBody(event);
        if (!body) return err(400, "invalid_json", "invalid JSON body");
        return await reportError(body, device, event.headers?.["user-agent"] || event.headers?.["User-Agent"]);
      }

      if (route === "POST /auth/register" || route === "POST /auth/login") {
        const body = parseBody(event);
        if (!body) return err(400, "invalid_json", "invalid JSON body");
        return route === "POST /auth/login" ? await login(body, device) : await register(body, device);
      }

      const authed = ["GET /auth/me", "POST /auth/pin", "GET /save", "PUT /save", "GET /players"];
      const adminUser = /^\/admin\/users\/([^/]+)$/.exec(path);
      const adminError = /^\/admin\/errors\/([0-9a-f]{16})$/.exec(path);
      const adminRoute =
        route === "GET /admin/users" || route === "POST /admin/users" || route === "GET /admin/logs" ||
        route === "GET /admin/errors" ||
        ((adminUser || adminError) && (method === "PATCH" || method === "DELETE"));
      if (!authed.includes(route) && !adminRoute) return err(404, "not_found", "not found");

      const user = await authenticate(event);
      if (!user) return err(401, "unauthorized", "Please log in again.");

      if (adminRoute) {
        if (!isAdmin(user)) return err(403, "forbidden", "Admins only.");
        if (route === "GET /admin/users") return await adminListUsers();
        if (route === "GET /admin/logs") return await adminListLogs(event.queryStringParameters || {});
        if (route === "GET /admin/errors") return await adminListErrors();
        if (adminError && method === "DELETE") {
          await store.deleteError(adminError[1]);
          return json(200, { deleted: adminError[1] });
        }
        if (method === "DELETE") return await adminDeleteUser(user, decodeURIComponent(adminUser[1]), device);
        const adminBody = parseBody(event);
        if (!adminBody) return err(400, "invalid_json", "invalid JSON body");
        if (route === "POST /admin/users") return await createAccount(adminBody, user, device);
        if (adminError) return await adminUpdateError(adminError[1], adminBody);
        return await adminUpdateUser(user, decodeURIComponent(adminUser[1]), adminBody, device);
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
      return route === "POST /auth/pin" ? await changePin(user, body, device) : await putSave(user, body, device);
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
