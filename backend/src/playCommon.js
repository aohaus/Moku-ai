const { json } = require("./response");
const token = require("./token");

// Shared by the play-with-friends APIs (matchApi.js, challengeApi.js).

const TAG_RE = /^u[0-9a-f]{5}$/;

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

// Same public tag as accountApi.js publicUserView
function tagOf(user) {
  return `u${user.uid.slice(0, 5)}`;
}

// Same rule as accountApi.js: a valid token for a user whose uid and token
// version still match (a PIN change or an ID change logs other devices out).
function makeAuthenticate(store, authSecret, now) {
  return async function authenticate(event) {
    const header = event.headers?.authorization || event.headers?.Authorization || "";
    const m = /^Bearer\s+(\S+)$/i.exec(header);
    const payload = m && token.verify(m[1], authSecret, now());
    if (!payload) return null;
    const user = await store.getUser(payload.lid);
    if (!user || user.uid !== payload.uid || user.tv !== payload.tv) return null;
    return user;
  };
}

// A friend to play with: by public tag, never the admin, never yourself.
async function findOpponent(store, user, opponentTag) {
  if (typeof opponentTag !== "string" || !TAG_RE.test(opponentTag)) {
    return { error: err(400, "invalid_opponent", "Choose a friend to play with.") };
  }
  const opponent = (await store.listUsers()).find((u) => tagOf(u) === opponentTag && u.role !== "admin");
  if (!opponent) return { error: err(404, "opponent_not_found", "We couldn't find that player.") };
  if (opponent.uid === user.uid) return { error: err(400, "invalid_opponent", "You can't play against yourself.") };
  return { opponent };
}

module.exports = { TAG_RE, err, parseBody, tagOf, makeAuthenticate, findOpponent };
