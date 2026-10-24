const http = require("http");
const crypto = require("crypto");

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const UPSTREAM_HOST = "dreamlo.com";

// { "<gameId>": { "public": "<dreamlo public code>", "private": "<dreamlo private code>" }, ... }
// Private codes live ONLY here (server-side env var) — the client never
// sees them, so a public game HTML file can't leak write access to the
// leaderboard.
const GAME_KEYS = JSON.parse(process.env.GAME_KEYS || "{}");

// Same HMAC key as backend/ (accounts API). Empty = accounts not set up yet:
// every submit is treated as a guest.
const AUTH_SECRET = process.env.AUTH_SECRET || "";

const MAX_NAME_LEN = 20;
const MAX_LIMIT = 25; // Dreamlo free tier only ever keeps the top 25 anyway.

function corsHeaders(extra = {}) {
  return {
    "access-control-allow-origin": ALLOWED_ORIGIN,
    ...extra,
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(body),
  };
}

function fetchUpstream(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: UPSTREAM_HOST, path, timeout: 4000 }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({
          statusCode: res.statusCode || 502,
          body: Buffer.concat(chunks).toString("utf8"),
        })
      );
    });
    req.on("timeout", () => req.destroy(new Error("upstream timeout")));
    req.on("error", reject);
  });
}

function sanitizeName(name) {
  return String(name || "Moku").replace(/\*/g, "").slice(0, MAX_NAME_LEN);
}

// Copy of verify() in backend/src/token.js — keep the two in sync.
function verifyToken(token) {
  if (typeof token !== "string" || !AUTH_SECRET) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload && payload.exp * 1000 > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

// Leaderboard names are "<label>#<suffix>". Logged-in players get the
// account's display name and a "u" + 5-hex tag, set here from the signed
// token so it can't be faked. Guests send their own name with a hex
// device-id suffix (shared/moku-scores.js), which never starts with "u".
function entryName(params) {
  const account = verifyToken(params.auth);
  if (account) {
    return { name: sanitizeName(`${account.name}#u${String(account.uid).slice(0, 5)}`) };
  }
  const name = sanitizeName(params.name);
  if (/#u/i.test(name)) return { error: "names ending in #u… are reserved for logged-in players" };
  return { name };
}

async function handleTop(gameId, limitParam) {
  const keys = GAME_KEYS[gameId];
  if (!keys) return json(404, { error: `unknown gameId: ${gameId}` });

  const { statusCode, body } = await fetchUpstream(`/lb/${keys.public}/json`);
  if (statusCode !== 200) return json(502, { error: "upstream error" });

  let limit = parseInt(limitParam, 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = MAX_LIMIT;
  limit = Math.min(limit, MAX_LIMIT);

  const data = JSON.parse(body);
  const entries = data?.dreamlo?.leaderboard?.entry;
  const list = Array.isArray(entries) ? entries : entries ? [entries] : [];

  const ranking = list
    .map((e) => ({
      playerName: String(e.name),
      score: Number(e.score),
      level: Number(e.seconds) || undefined,
      date: e.date,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry, i) => ({ rank: i + 1, ...entry }));

  return json(200, { gameId, ranking });
}

async function handleSubmit(gameId, params) {
  const keys = GAME_KEYS[gameId];
  if (!keys) return json(404, { error: `unknown gameId: ${gameId}` });

  const score = parseInt(params.score, 10);
  if (!Number.isFinite(score) || score < 0) {
    return json(400, { error: "score must be a non-negative integer" });
  }
  const entry = entryName(params);
  if (entry.error) return json(400, { error: entry.error });
  const name = encodeURIComponent(entry.name);
  const seconds = Math.max(0, parseInt(params.seconds, 10) || 0);

  const { statusCode } = await fetchUpstream(
    `/lb/${keys.private}/add/${name}/${score}/${seconds}`
  );
  if (statusCode !== 200) return json(502, { error: "upstream error" });

  return json(200, { submitted: true });
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || "GET";
  if (method !== "GET") {
    return json(405, { error: "method not allowed" });
  }

  const params = event.queryStringParameters || {};
  const { gameId, action } = params;
  if (!gameId) return json(400, { error: "gameId is required" });

  try {
    if (action === "submit") return await handleSubmit(gameId, params);
    return await handleTop(gameId, params.limit);
  } catch (err) {
    console.error(err);
    return json(500, { error: "internal error" });
  }
};
