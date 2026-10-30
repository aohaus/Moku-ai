const crypto = require("crypto");
const { json } = require("./response");
const { err, parseBody, makeAuthenticate, findOpponent } = require("./playCommon");

// "Same puzzle" challenges between two logged-in players (API_SPEC.md
// "Challenges"). The server deals one puzzle (a seed the game turns into its
// level with shared/moku-random.js), both players play it whenever they like,
// and the server decides who did better once both have sent a result.
//
// First game: Moku Bridge — the same new glass bridge for both; fewer falls
// wins. Results come from the page (a casual game for invited kids; nothing
// here can prove how someone played).
//
// Players are keyed by uid; only display names and #u tags leave the server.
// Until you have sent your own result, the friend's result is hidden.

const CHALLENGE_ID_RE = /^[0-9a-f]{16}$/;
const MAX_OPEN_CHALLENGES = 20;          // per player (a soft cap, like matches)
const TTL_SEC = 14 * 24 * 60 * 60;       // two weeks after the last change, DynamoDB deletes it

// One entry per game that can be played as a challenge.
const GAMES = {
  "moku-bridge": {
    // The level: how many glass steps (8–10, like the bridges in the game).
    params(body) {
      const steps = body.steps === undefined ? 9 : body.steps;
      if (!Number.isInteger(steps) || steps < 8 || steps > 10) return null;
      return { steps };
    },
    // { falls }: how many times Moku fell before crossing.
    result(r) {
      if (!r || typeof r !== "object" || !Number.isInteger(r.falls) || r.falls < 0 || r.falls > 99) return null;
      return { falls: r.falls };
    },
    // < 0: a did better. Fewer falls wins; the same is a tie.
    compare(a, b) {
      return a.falls - b.falls;
    },
  },
};

function newSeed() {
  // 8 letters/digits without look-alikes, like MokuRandom.newSeed()
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[crypto.randomInt(chars.length)];
  return out;
}

function sideOf(ch, uid) {
  if (ch.from.uid === uid) return "from";
  if (ch.to.uid === uid) return "to";
  return null;
}

// What a player sees. The friend's result stays hidden until yours is in.
function challengeView(ch, uid) {
  const you = sideOf(ch, uid), them = you === "from" ? "to" : "from";
  const mine = ch.results[you] || null;
  return {
    id: ch.id,
    game: ch.game,
    status: ch.status,
    you,
    opponent: { name: ch[them].name, tag: ch[them].tag },
    seed: ch.seed,
    params: ch.params,
    yourResult: mine,
    theirResult: mine ? ch.results[them] || null : null,
    theyPlayed: !!ch.results[them],
    yourTurn: !mine,
    winner: ch.status === "done" ? (ch.winner === "tie" ? "tie" : ch.winner === you ? "you" : "them") : null,
    version: ch.version,
    createdAt: ch.createdAt,
    updatedAt: ch.updatedAt,
  };
}

// Each player's row in their own list (pk PLAYER#<uid>, sk CHAL#<id>).
function indexItems(ch) {
  return ["from", "to"].map((side) => {
    const view = challengeView(ch, ch[side].uid);
    const { seed, params, ...row } = view;
    return { uid: ch[side].uid, challengeId: ch.id, ...row, ttl: ch.ttl };
  });
}

function createChallengeApi(store, config) {
  const { authSecret, now = () => Date.now(), newId = () => crypto.randomBytes(8).toString("hex"), seed = newSeed } = config;
  if (!authSecret || authSecret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters");
  }
  const authenticate = makeAuthenticate(store, authSecret, now);

  function stamp(ch) {
    const t = now();
    ch.updatedAt = new Date(t).toISOString();
    ch.ttl = Math.floor(t / 1000) + TTL_SEC;
  }

  async function openCount(uid) {
    return (await store.listPlayerChallenges(uid)).filter((r) => r.status === "open").length;
  }

  async function loadOwn(user, id) {
    const ch = await store.getChallenge(id);
    if (!ch || !sideOf(ch, user.uid)) return null;
    // TTL deletes can lag a day or two; an expired challenge is gone.
    if (ch.ttl && ch.ttl <= Math.floor(now() / 1000)) return null;
    return ch;
  }

  async function create(user, body) {
    const game = GAMES[body.game];
    if (!game) return err(400, "invalid_game", "This game can't be played as a challenge yet.");
    const params = game.params(body);
    if (!params) return err(400, "invalid_params", "That level isn't allowed.");
    const found = await findOpponent(store, user, body.opponentTag);
    if (found.error) return found.error;
    const opponent = found.opponent;
    if ((await openCount(user.uid)) >= MAX_OPEN_CHALLENGES) {
      return err(409, "too_many_challenges", "Finish a challenge before starting a new one.");
    }
    if ((await openCount(opponent.uid)) >= MAX_OPEN_CHALLENGES) {
      return err(409, "opponent_busy", "Your friend has too many challenges going.");
    }
    const seat = (u) => ({ uid: u.uid, name: u.displayName, tag: `u${u.uid.slice(0, 5)}` });
    const ch = {
      id: newId(),
      game: body.game,
      status: "open",
      from: seat(user),
      to: seat(opponent),
      seed: seed(),
      params,
      results: { from: null, to: null },
      winner: null,
      version: 0,
      createdAt: new Date(now()).toISOString(),
    };
    stamp(ch);
    await store.createChallenge(ch, indexItems(ch));
    return json(201, { challenge: challengeView(ch, user.uid) });
  }

  async function list(user) {
    const rows = (await store.listPlayerChallenges(user.uid)).map(({ uid, challengeId, ttl, ...row }) => ({ id: challengeId, ...row }));
    // Your turn first, then waiting for the friend, then done; newest first in each.
    const rank = (r) => (r.status === "open" && r.yourTurn ? 0 : r.status === "open" ? 1 : 2);
    rows.sort((a, b) => rank(a) - rank(b) || (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return json(200, { challenges: rows, yourTurn: rows.filter((r) => r.status === "open" && r.yourTurn).length });
  }

  async function get(user, id) {
    const ch = await loadOwn(user, id);
    if (!ch) return err(404, "challenge_not_found", "This challenge is gone.");
    return json(200, { challenge: challengeView(ch, user.uid) });
  }

  // Your result, once. When both are in, the server decides the winner.
  async function sendResult(user, id, body) {
    const ch = await loadOwn(user, id);
    if (!ch) return err(404, "challenge_not_found", "This challenge is gone.");
    const you = sideOf(ch, user.uid), them = you === "from" ? "to" : "from";
    if (ch.results[you]) return err(409, "already_played", "You already played this one.", { challenge: challengeView(ch, user.uid) });
    const result = GAMES[ch.game].result(body.result);
    if (!result) return err(400, "invalid_result", "That result isn't right.");
    const updated = { ...ch, results: { ...ch.results, [you]: result }, version: ch.version + 1 };
    if (updated.results[them]) {
      const c = GAMES[ch.game].compare(updated.results.from, updated.results.to);
      updated.status = "done";
      updated.winner = c < 0 ? "from" : c > 0 ? "to" : "tie";
    }
    stamp(updated);
    try {
      await store.saveChallenge(updated, ch.version, indexItems(updated));
    } catch (e) {
      if (e.code !== "conflict") throw e;
      // The friend's result landed at the same moment: add ours on top of it.
      return sendResult(user, id, body);
    }
    return json(200, { challenge: challengeView(updated, user.uid) });
  }

  return async function handler(event) {
    const method = event.requestContext?.http?.method || "GET";
    const path = (event.rawPath || "/").replace(/\/+$/, "") || "/";
    const one = /^\/challenges\/([^/]+)(\/result)?$/.exec(path);
    try {
      const isList = path === "/challenges" && (method === "GET" || method === "POST");
      const isOne = one && !one[2] && method === "GET";
      const isResult = one && one[2] && method === "POST";
      if (!isList && !isOne && !isResult) return err(404, "not_found", "not found");
      if (one && !CHALLENGE_ID_RE.test(one[1])) return err(404, "challenge_not_found", "This challenge is gone.");

      const user = await authenticate(event);
      if (!user) return err(401, "unauthorized", "Please log in again.");

      if (isOne) return await get(user, one[1]);
      if (isList && method === "GET") return await list(user);
      const body = parseBody(event);
      if (!body) return err(400, "invalid_json", "invalid JSON body");
      if (isResult) return await sendResult(user, one[1], body);
      return await create(user, body);
    } catch (e) {
      console.error(e);
      return err(500, "internal", "internal error");
    }
  };
}

exports.createChallengeApi = createChallengeApi;
exports.GAMES = GAMES;
