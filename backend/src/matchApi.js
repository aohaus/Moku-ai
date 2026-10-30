const crypto = require("crypto");
const { json } = require("./response");
const token = require("./token");
const MokuChessRules = require("./vendor/moku-chess-rules");

// Online matches between two logged-in players (see API_SPEC.md "Matches").
// First game: Moku Chess, played like letter chess — no clock; each player
// moves when they like, and the page polls GET /matches/{id} while it is the
// other player's turn. The server replays every move with the shared rules
// (shared/moku-chess-rules.js), so a page can't sneak in an illegal move.
//
// Storage-agnostic like accountApi.js: `store` is accountStore.js (DynamoDB)
// or memoryStore.js (tests, server.js dev mock).
//
// Players are keyed by `uid` (it never changes), not the Player ID (the admin
// can rename that, and it is half of a login, so it never leaves the server).

const MATCH_ID_RE = /^[0-9a-f]{16}$/;
const TAG_RE = /^u[0-9a-f]{5}$/;
const UCI_RE = /^[a-h][1-8][a-h][1-8][nbrq]?$/;
const MAX_ACTIVE_MATCHES = 20;      // per player, so nobody can flood a friend with invites
const MAX_MOVES = 600;              // far past any real game; keeps an item small
const ACTIVE_TTL_SEC = 7 * 24 * 60 * 60;    // a week with no move ends it (DynamoDB TTL deletes it)
const FINISHED_TTL_SEC = 30 * 24 * 60 * 60; // finished games stay a month for the result screen

// One entry per game that can be played online.
const GAMES = {
  "moku-chess": {
    // Plays `moves` from the start; null if any move is illegal or comes after the end.
    replay(moves) {
      const r = MokuChessRules.replay(moves);
      if (!r.ok) return null;
      const end = r.status;
      // Checkmate: the side that just moved wins. Every other ending is a draw.
      const result = !end ? null : end === "checkmate" ? (r.turn === "w" ? "black" : "white") : "draw";
      return { fen: r.fen, turn: r.turn, endReason: end, result };
    },
  },
};

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

function tagOf(user) {
  return `u${user.uid.slice(0, 5)}`; // same public tag as accountApi.js publicUserView
}

function seatOf(user) {
  return { uid: user.uid, name: user.displayName, tag: tagOf(user) };
}

function colorOf(match, uid) {
  if (match.white.uid === uid) return "w";
  if (match.black.uid === uid) return "b";
  return null;
}

// What a player sees of a match: names and tags, never another player's uid.
function matchView(match, uid) {
  const you = colorOf(match, uid);
  return {
    id: match.id,
    game: match.game,
    status: match.status,
    you,
    white: { name: match.white.name, tag: match.white.tag },
    black: { name: match.black.name, tag: match.black.tag },
    moves: match.moves,
    fen: match.fen,
    turn: match.turn,
    yourTurn: match.status === "active" && match.turn === you,
    version: match.version,
    result: match.result,
    endReason: match.endReason,
    createdAt: match.createdAt,
    updatedAt: match.updatedAt,
  };
}

// Each player's row in their own match list (pk PLAYER#<uid>). Kept in step
// with the match on every write, so GET /matches is one query.
function indexItems(match) {
  return ["white", "black"].map((side) => {
    const me = match[side], other = match[side === "white" ? "black" : "white"];
    return {
      uid: me.uid,
      matchId: match.id,
      game: match.game,
      status: match.status,
      you: side === "white" ? "w" : "b",
      opponent: { name: other.name, tag: other.tag },
      turn: match.turn,
      version: match.version,
      result: match.result,
      endReason: match.endReason,
      updatedAt: match.updatedAt,
      ttl: match.ttl,
    };
  });
}

function listView(row) {
  return {
    id: row.matchId,
    game: row.game,
    status: row.status,
    you: row.you,
    opponent: row.opponent,
    turn: row.turn,
    yourTurn: row.status === "active" && row.turn === row.you,
    version: row.version,
    result: row.result,
    endReason: row.endReason,
    updatedAt: row.updatedAt,
  };
}

function createMatchApi(store, config) {
  const { authSecret, now = () => Date.now(), newId = () => crypto.randomBytes(8).toString("hex") } = config;
  if (!authSecret || authSecret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters");
  }

  // Same rule as accountApi.js: a valid token for a user whose uid and token
  // version still match (a PIN change or an ID change logs other devices out).
  async function authenticate(event) {
    const header = event.headers?.authorization || event.headers?.Authorization || "";
    const m = /^Bearer\s+(\S+)$/i.exec(header);
    const payload = m && token.verify(m[1], authSecret, now());
    if (!payload) return null;
    const user = await store.getUser(payload.lid);
    if (!user || user.uid !== payload.uid || user.tv !== payload.tv) return null;
    return user;
  }

  function stamp(match) {
    const t = now();
    match.updatedAt = new Date(t).toISOString();
    match.ttl = Math.floor(t / 1000) + (match.status === "active" ? ACTIVE_TTL_SEC : FINISHED_TTL_SEC);
  }

  async function activeCount(uid) {
    return (await store.listPlayerMatches(uid)).filter((r) => r.status === "active").length;
  }

  async function createMatch(user, body) {
    const game = body.game;
    if (!GAMES[game]) return err(400, "invalid_game", "This game can't be played online yet.");
    if (typeof body.opponentTag !== "string" || !TAG_RE.test(body.opponentTag)) {
      return err(400, "invalid_opponent", "Choose a friend to play with.");
    }
    const opponent = (await store.listUsers()).find((u) => tagOf(u) === body.opponentTag && u.role !== "admin");
    if (!opponent) return err(404, "opponent_not_found", "We couldn't find that player.");
    if (opponent.uid === user.uid) return err(400, "invalid_opponent", "You can't play against yourself.");
    const color = body.color === undefined ? "random" : body.color;
    if (!["white", "black", "random"].includes(color)) return err(400, "invalid_color", "color must be white, black or random.");
    if ((await activeCount(user.uid)) >= MAX_ACTIVE_MATCHES) {
      return err(409, "too_many_matches", "Finish a game before starting a new one.");
    }
    if ((await activeCount(opponent.uid)) >= MAX_ACTIVE_MATCHES) {
      return err(409, "opponent_busy", "Your friend has too many games going.");
    }

    const meWhite = color === "white" || (color === "random" && crypto.randomInt(2) === 0);
    const start = GAMES[game].replay([]);
    const match = {
      id: newId(),
      game,
      status: "active",
      white: seatOf(meWhite ? user : opponent),
      black: seatOf(meWhite ? opponent : user),
      moves: [],
      fen: start.fen,
      turn: start.turn,
      version: 0,
      result: null,
      endReason: null,
      createdAt: new Date(now()).toISOString(),
    };
    stamp(match);
    await store.createMatch(match, indexItems(match));
    return json(201, { match: matchView(match, user.uid) });
  }

  async function listMatches(user) {
    const rows = (await store.listPlayerMatches(user.uid)).map(listView);
    // Your turn first, then the other active games, then finished; newest first in each.
    const rank = (r) => (r.yourTurn ? 0 : r.status === "active" ? 1 : 2);
    rows.sort((a, b) => rank(a) - rank(b) || (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return json(200, { matches: rows, yourTurn: rows.filter((r) => r.yourTurn).length });
  }

  async function loadOwnMatch(user, id) {
    const match = await store.getMatch(id);
    // Someone else's match looks the same as a missing one. So does an
    // expired one: DynamoDB's TTL delete can lag a day or two, and a move
    // would otherwise bring it back to life.
    if (!match || !colorOf(match, user.uid)) return null;
    if (match.ttl && match.ttl <= Math.floor(now() / 1000)) return null;
    return match;
  }

  async function getMatch(user, id, query) {
    const match = await loadOwnMatch(user, id);
    if (!match) return err(404, "match_not_found", "This game is gone.");
    // Polling: nothing new since the version the page already has → a tiny reply.
    const since = query && query.v !== undefined ? Number(query.v) : NaN;
    if (Number.isInteger(since) && since === match.version) {
      return json(200, { changed: false, version: match.version });
    }
    return json(200, { changed: true, match: matchView(match, user.uid) });
  }

  async function makeMove(user, id, body) {
    if (typeof body.move !== "string" || !UCI_RE.test(body.move)) {
      return err(400, "invalid_move", "That move isn't written right.");
    }
    if (!Number.isInteger(body.version)) return err(400, "invalid_version", "version is required.");
    const match = await loadOwnMatch(user, id);
    if (!match) return err(404, "match_not_found", "This game is gone.");
    const you = colorOf(match, user.uid);
    // A stale page (the other move already arrived, or a double tap) gets the
    // game as it is now and can redraw.
    if (body.version !== match.version) {
      return err(409, "version_conflict", "The game has moved on.", { match: matchView(match, user.uid) });
    }
    if (match.status !== "active") return err(409, "match_over", "This game is over.", { match: matchView(match, user.uid) });
    if (match.turn !== you) return err(409, "not_your_turn", "It's your friend's turn.", { match: matchView(match, user.uid) });
    if (match.moves.length >= MAX_MOVES) return err(409, "too_many_moves", "This game is too long.");

    const moves = match.moves.concat(body.move);
    const next = GAMES[match.game].replay(moves);
    if (!next) return err(400, "illegal_move", "That move isn't allowed.", { match: matchView(match, user.uid) });

    const updated = {
      ...match,
      moves,
      fen: next.fen,
      turn: next.turn,
      version: match.version + 1,
      status: next.result ? "finished" : "active",
      result: next.result,
      endReason: next.endReason,
    };
    stamp(updated);
    try {
      await store.saveMatch(updated, match.version, indexItems(updated));
    } catch (e) {
      if (e.code !== "conflict") throw e;
      const fresh = await store.getMatch(id);
      return err(409, "version_conflict", "The game has moved on.", fresh ? { match: matchView(fresh, user.uid) } : {});
    }
    return json(200, { match: matchView(updated, user.uid) });
  }

  return async function handler(event) {
    const method = event.requestContext?.http?.method || "GET";
    const path = (event.rawPath || "/").replace(/\/+$/, "") || "/";
    const one = /^\/matches\/([^/]+)(\/move)?$/.exec(path);

    try {
      const isList = path === "/matches" && (method === "GET" || method === "POST");
      const isOne = one && !one[2] && method === "GET";
      const isMove = one && one[2] && method === "POST";
      if (!isList && !isOne && !isMove) return err(404, "not_found", "not found");
      if (one && !MATCH_ID_RE.test(one[1])) return err(404, "match_not_found", "This game is gone.");

      const user = await authenticate(event);
      if (!user) return err(401, "unauthorized", "Please log in again.");

      if (isOne) return await getMatch(user, one[1], event.queryStringParameters || {});
      if (isList && method === "GET") return await listMatches(user);

      const body = parseBody(event);
      if (!body) return err(400, "invalid_json", "invalid JSON body");
      if (isMove) return await makeMove(user, one[1], body);
      return await createMatch(user, body);
    } catch (e) {
      console.error(e);
      return err(500, "internal", "internal error");
    }
  };
}

let prodHandler = null;

// Lambda entry point (MatchFunction in template.yaml).
exports.handler = async (event) => {
  if (!prodHandler) {
    prodHandler = createMatchApi(require("./accountStore"), { authSecret: process.env.AUTH_SECRET });
  }
  return prodHandler(event);
};

exports.createMatchApi = createMatchApi;
exports.GAMES = GAMES;
