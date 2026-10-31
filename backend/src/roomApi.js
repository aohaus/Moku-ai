const crypto = require("crypto");
const { json } = require("./response");
const { TAG_RE, err, parseBody, tagOf, makeAuthenticate, findOpponent } = require("./playCommon");
const MokuRiddles = require("./vendor/moku-riddles");
const moyo = require("./moyoParty");
const wolf = require("./wolfParty");

// Riddle Race rooms (API_SPEC.md "Rooms"): several logged-in players solve the
// same Moku Word Riddles at the same time. A host opens a room (a 4-letter
// code friends can type, or an invite), starts it, and everyone sees the same
// riddle together. The first right answer the server gets wins that riddle;
// the most riddles won wins the race.
//
// Where the race is (countdown / question / reveal / done) is worked out from
// startAt + wins with MokuRiddles.raceTimeline — the same function the page
// uses — so nothing has to move the room along: it only changes when someone
// joins, starts or answers first.
//
// Players are keyed by uid; only display names and #u tags leave the server.
//
// The same rooms also host Moyomoyo Multiplayer (game "moyomoyo", moyoParty.js):
// 2–4 players, 3 games, and each player posts their board to
// POST /rooms/{code}/state instead of answering riddles.
//
// And Moku Wolf Multiplayer (game "wolf", wolfParty.js): 3–10 players, the
// server deals each one a secret word, and players act through
// POST /rooms/{code}/wolf (ready / vote / guess / host skip).

const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";   // no I, L, O: easy to read out and type
const CODE_RE = /^[A-Z]{4}$/;
const MAX_PLAYERS = 6;
const MAX_INVITES = 10;
const COUNTS = [5, 10];
const MAX_OPEN_ROOMS = 10;                 // lobby/playing rooms you can be in at once (a soft cap)
const TTL_SEC = 24 * 60 * 60;              // a day after the last change, DynamoDB deletes it
const { RACE } = MokuRiddles;
const GAMES = ["riddles", "moyomoyo", "wolf"];
const gameOf = (room) => room.game || "riddles";   // rooms from before "game" existed are riddle rooms
const maxPlayers = (room) => (gameOf(room) === "moyomoyo" ? moyo.RULES.MAX_PLAYERS : gameOf(room) === "wolf" ? wolf.RULES.MAX_PLAYERS : MAX_PLAYERS);
const minPlayers = (room) => (gameOf(room) === "wolf" ? wolf.RULES.MIN_PLAYERS : 2);

// lobby / playing / done / closed, for any game
function phaseOf(room, t) {
  if (gameOf(room) !== "riddles") return room.status;
  return MokuRiddles.raceTimeline(room, t).phase;
}

function newCode() {
  let out = "";
  for (let i = 0; i < 4; i++) out += CODE_LETTERS[crypto.randomInt(CODE_LETTERS.length)];
  return out;
}

function pickRiddles(count) {
  const ids = MokuRiddles.RIDDLES.map((r) => r.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, count);
}

const seat = (u) => ({ uid: u.uid, name: u.displayName, tag: tagOf(u) });

function isPlayer(room, uid) {
  return room.players.some((p) => p.uid === uid);
}
function isInvited(room, uid) {
  return room.invited.some((p) => p.uid === uid);
}

function scores(room) {
  const s = {};
  room.players.forEach((p) => { s[p.uid] = 0; });
  Object.values(room.wins || {}).forEach((w) => { if (w.uid in s) s[w.uid] += 1; });
  return s;
}

// What a player (or an invited friend) sees. states: the Moyomoyo players' rows.
function roomView(room, uid, t, states) {
  if (gameOf(room) === "wolf") {
    const tagByUid = {};
    room.players.forEach((p) => { tagByUid[p.uid] = p.tag; });
    return {
      id: room.id,
      key: room.key,
      game: "wolf",
      status: room.status,
      you: room.players.concat(room.invited).find((p) => p.uid === uid)?.tag || null,
      joined: isPlayer(room, uid),
      isHost: room.host === uid,
      players: room.players.map((p) => ({ name: p.name, tag: p.tag, host: p.uid === room.host, score: 0 })),
      invited: room.invited.filter((p) => !isPlayer(room, p.uid)).map((p) => ({ name: p.name, tag: p.tag })),
      ...wolf.view(room, uid, tagByUid),
      next: room.next || null,
      version: room.version,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      now: t,
    };
  }
  if (gameOf(room) === "moyomoyo") {
    const totals = {};
    moyo.standings(room).forEach((row) => { totals[row.uid] = row.total; });
    return {
      id: room.id,
      key: room.key,
      game: "moyomoyo",
      status: room.status,
      you: room.players.concat(room.invited).find((p) => p.uid === uid)?.tag || null,
      joined: isPlayer(room, uid),
      isHost: room.host === uid,
      players: room.players.map((p) => ({ name: p.name, tag: p.tag, host: p.uid === room.host, score: totals[p.uid] || 0 })),
      invited: room.invited.filter((p) => !isPlayer(room, p.uid)).map((p) => ({ name: p.name, tag: p.tag })),
      ...moyo.view(room, states, t),
      next: room.next || null,
      version: room.version,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      now: t,
    };
  }
  const tl = MokuRiddles.raceTimeline(room, t);
  const sc = scores(room);
  const tagByUid = {};
  room.players.forEach((p) => { tagByUid[p.uid] = p.tag; });
  const started = room.status === "playing";
  return {
    id: room.id,
    key: room.key,
    game: "riddles",
    status: tl.phase === "done" ? "done" : room.status,
    you: room.players.concat(room.invited).find((p) => p.uid === uid)?.tag || null,
    joined: isPlayer(room, uid),
    isHost: room.host === uid,
    count: room.count,
    players: room.players.map((p) => ({ name: p.name, tag: p.tag, host: p.uid === room.host, score: sc[p.uid] || 0 })),
    invited: room.invited.filter((p) => !isPlayer(room, p.uid)).map((p) => ({ name: p.name, tag: p.tag })),
    riddles: started ? room.riddles : [],
    startAt: room.startAt || null,
    wins: Object.keys(room.wins || {}).map((q) => ({ q: Number(q), tag: tagByUid[room.wins[q].uid] || null, at: room.wins[q].at }))
      .sort((a, b) => a.q - b.q),
    race: RACE,
    next: room.next || null,
    version: room.version,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    now: t,
  };
}

function createRoomApi(store, config) {
  const {
    authSecret, now = () => Date.now(), newKey = () => crypto.randomBytes(8).toString("hex"), code = newCode, pick = pickRiddles,
    newSeed = () => crypto.randomBytes(4).toString("hex"), randInt = (n) => crypto.randomInt(n),
  } = config;
  if (!authSecret || authSecret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters");
  }
  const authenticate = makeAuthenticate(store, authSecret, now);

  function stamp(room) {
    const t = now();
    room.updatedAt = new Date(t).toISOString();
    room.ttl = Math.floor(t / 1000) + TTL_SEC;
  }
  const indexRow = (uid, room) => ({ uid, roomId: room.id, key: room.key, ttl: room.ttl });

  // A room that is still there (TTL deletes can lag a day or two).
  async function load(id) {
    const room = await store.getRoom(id);
    if (!room || (room.ttl && room.ttl <= Math.floor(now() / 1000))) return null;
    return room;
  }
  async function loadFor(user, id) {
    const room = await load(id);
    if (!room || !(isPlayer(room, user.uid) || isInvited(room, user.uid))) return null;
    return room;
  }
  const gone = () => err(404, "room_not_found", "We couldn't find that room.");

  async function openRooms(uid) {
    const rows = await store.listPlayerRooms(uid);
    const t = now(), out = [];
    for (const row of rows) {
      const room = await load(row.roomId);
      if (!room || room.key !== row.key) continue;
      if (!(isPlayer(room, uid) || isInvited(room, uid))) continue;
      const phase = phaseOf(room, t);
      if (phase === "closed" || phase === "done") continue;
      out.push(room);
    }
    return out;
  }

  // Save, and if someone else changed the room at the same moment, load it
  // again and redo the change on top (change(room) returns an error response
  // to stop, or nothing to save).
  async function update(id, change, extraRows = () => []) {
    for (let i = 0; i < 5; i++) {
      const room = await load(id);
      if (!room) return { error: gone() };
      const base = room.version;
      const stop = change(room);
      if (stop) return { error: stop, room };
      room.version = base + 1;
      stamp(room);
      try {
        await store.saveRoom(room, base, extraRows(room));
        return { room };
      } catch (e) {
        if (e.code !== "conflict") throw e;
      }
    }
    return { error: err(409, "busy", "Lots happening! Try again.") };
  }

  // prev: the room "again" was pressed in (Moku Wolf keeps its settings).
  async function newRoom(host, game, count, players, prev) {
    const t = now();
    for (let i = 0; i < 8; i++) {
      const room = {
        id: code(),
        key: newKey(),
        game,
        host: host.uid,
        status: "lobby",
        count,
        ...(game === "moyomoyo" ? moyo.newRoomFields() : {}),
        ...(game === "wolf" ? wolf.newRoomFields(prev) : {}),
        players,
        invited: [],
        riddles: [],
        startAt: null,
        wins: {},
        next: null,
        version: 0,
        createdAt: new Date(t).toISOString(),
      };
      stamp(room);
      try {
        await store.createRoom(room, players.map((p) => indexRow(p.uid, room)), Math.floor(t / 1000));
        return room;
      } catch (e) {
        if (e.code !== "conflict") throw e;   // that code is taken: try another
      }
    }
    throw new Error("no free room code");
  }

  async function create(user, body) {
    const game = body.game === undefined ? "riddles" : body.game;
    if (!GAMES.includes(game)) return err(400, "invalid_game", "That game can't be played in a room.");
    const count = game === "moyomoyo" ? moyo.RULES.ROUNDS : game === "wolf" ? 1 : body.count === undefined ? 5 : body.count;
    if (game === "riddles" && !COUNTS.includes(count)) return err(400, "invalid_count", "Choose 5 or 10 riddles.");
    if ((await openRooms(user.uid)).filter((r) => isPlayer(r, user.uid)).length >= MAX_OPEN_ROOMS) {
      return err(409, "too_many_rooms", "Finish a game before opening a new room.");
    }
    const room = await newRoom(user, game, count, [seat(user)]);
    return json(201, { room: roomView(room, user.uid, now(), {}) });
  }

  // Rooms you are in or were invited to that haven't finished, for one game
  // (?game=, riddles when left out — the Riddle Race page doesn't send it).
  async function list(user, query) {
    const game = (query && query.game) || "riddles";
    if (!GAMES.includes(game)) return err(400, "invalid_game", "That game can't be played in a room.");
    const t = now();
    const rooms = (await openRooms(user.uid)).filter((r) => gameOf(r) === game).map((r) => roomView(r, user.uid, t, {}));
    rooms.sort((a, b) => (a.joined === b.joined ? (b.updatedAt || "").localeCompare(a.updatedAt || "") : a.joined ? 1 : -1));
    return json(200, { rooms, invites: rooms.filter((r) => !r.joined && r.status === "lobby").length, now: t });
  }

  async function get(user, id, query) {
    const room = await loadFor(user, id);
    if (!room) return gone();
    if (gameOf(room) === "moyomoyo" && room.status === "playing") {
      // A game in progress: always send everyone's boards (they change every second).
      const states = await statesOf(room);
      const settled = await settle(id, room, states);
      return json(200, { changed: true, room: roomView(settled, user.uid, now(), states) });
    }
    if (gameOf(room) === "wolf" && room.status === "playing") {
      // Timed stages (talk → vote → guess) move on when someone looks.
      const settled = await settleWolf(id, room);
      if (settled.error) return settled.error;
      if (!settled.room) return gone();
      const t = now();
      if (query && query.v !== undefined && String(settled.room.version) === String(query.v)) return json(200, { changed: false, now: t });
      return json(200, { changed: true, room: roomView(settled.room, user.uid, t, {}) });
    }
    const t = now();
    if (query && query.v !== undefined && String(room.version) === String(query.v)) return json(200, { changed: false, now: t });
    const states = gameOf(room) === "moyomoyo" && room.status === "done" ? await statesOf(room) : {};
    return json(200, { changed: true, room: roomView(room, user.uid, t, states) });
  }

  // Moyomoyo players' rows for this room (a reused code can still have rows
  // from the expired room before it: those have another key).
  async function statesOf(room) {
    const all = await store.listRoomStates(room.id), out = {};
    Object.keys(all).forEach((uid) => { if (all[uid].key === room.key) out[uid] = all[uid]; });
    return out;
  }

  // A change() that found nothing to save (settle / settleWolf).
  const NO_CHANGE = { noChange: true };

  // Moyomoyo: save the room when a game ended or the next one starts.
  async function settle(id, room, states) {
    const t = now();
    if (!moyo.advance(JSON.parse(JSON.stringify(room)), states, t)) return room;
    const res = await update(id, (r) => (moyo.advance(r, states, t) ? null : NO_CHANGE));
    return res.room || room;
  }

  // Moku Wolf: save the room when a timed stage ran out. → { room } (or { error }).
  async function settleWolf(id, room) {
    const t = now();
    if (!wolf.advance(JSON.parse(JSON.stringify(room)), t, randInt)) return { room };
    const res = await update(id, (r) => (wolf.advance(r, now(), randInt) ? null : NO_CHANGE));
    if (res.error === NO_CHANGE) return { room: res.room };
    return res;
  }

  // Moku Wolf: { do: "ready" | "vote" | "guess" | "skip", tag?, pick? }.
  async function postWolf(user, id, body) {
    const res = await update(id, (room) => {
      if (!isPlayer(room, user.uid)) return gone();
      if (gameOf(room) !== "wolf") return err(400, "wrong_game", "This room isn't a Moku Wolf room.");
      const t = now();
      wolf.advance(room, t, randInt);
      const no = wolf.act(room, user.uid, body, t, randInt);
      return no ? err(no.status, no.error, no.message) : null;
    });
    if (res.error) return res.error;
    return json(200, { room: roomView(res.room, user.uid, now(), {}) });
  }

  // Moyomoyo: { r, score, alive, final, board, attacks } — this player's board
  // right now. Answers with the room and everyone's boards, so a page in a
  // game only needs this one call each second.
  async function postState(user, id, body) {
    const room = await load(id);
    if (!room || !isPlayer(room, user.uid)) return gone();
    if (gameOf(room) !== "moyomoyo") return err(400, "wrong_game", "This room isn't a Moyomoyo room.");
    const next = moyo.cleanState(body);
    if (!next) return err(400, "invalid_state", "That board doesn't look right.");
    let states = await statesOf(room);
    if (room.status === "playing" && next.r === room.round) {
      const t = now();
      const row = { ...moyo.mergeState(states[user.uid], next, user.uid, t), key: room.key };
      await store.putRoomState(id, row, room.ttl);
      states = { ...states, [user.uid]: row };
    }
    const settled = await settle(id, room, states);
    return json(200, { room: roomView(settled, user.uid, now(), states) });
  }

  async function join(user, id) {
    const res = await update(id, (room) => {
      if (isPlayer(room, user.uid)) return json(200, { room: roomView(room, user.uid, now(), {}) });
      if (room.status !== "lobby") return err(409, "already_started", "This game already started.");
      if (room.players.length >= maxPlayers(room)) return err(409, "room_full", "This room is full.");
      room.players.push(seat(user));
      return null;
    }, (room) => [indexRow(user.uid, room)]);
    if (res.error) return res.error;
    return json(200, { room: roomView(res.room, user.uid, now(), {}) });
  }

  async function invite(user, id, body) {
    if (typeof body.tag !== "string" || !TAG_RE.test(body.tag)) return err(400, "invalid_opponent", "Choose a friend to invite.");
    const found = await findOpponent(store, user, body.tag);
    if (found.error) return found.error;
    const friend = found.opponent;
    const res = await update(id, (room) => {
      if (!isPlayer(room, user.uid)) return gone();
      if (room.status !== "lobby") return err(409, "already_started", "This game already started.");
      if (isPlayer(room, friend.uid) || isInvited(room, friend.uid)) return json(200, { room: roomView(room, user.uid, now(), {}) });
      if (room.invited.length >= MAX_INVITES) return err(409, "too_many_invites", "That's a lot of invites! Share the room code instead.");
      room.invited.push(seat(friend));
      return null;
    }, (room) => [indexRow(friend.uid, room)]);
    if (res.error) return res.error;
    return json(200, { room: roomView(res.room, user.uid, now(), {}) });
  }

  // In the lobby: leave (the host leaving closes the room). Once it started
  // there is nothing to undo — you just stop playing.
  async function leave(user, id) {
    const res = await update(id, (room) => {
      if (!isPlayer(room, user.uid) && !isInvited(room, user.uid)) return gone();
      if (room.status !== "lobby") return json(200, { room: roomView(room, user.uid, now(), {}) });
      if (room.host === user.uid) room.status = "closed";
      room.players = room.players.filter((p) => p.uid !== user.uid);
      room.invited = room.invited.filter((p) => p.uid !== user.uid);
      return null;
    });
    if (res.error) return res.error;
    return json(200, { ok: true });
  }

  async function start(user, id, body) {
    const res = await update(id, (room) => {
      if (!isPlayer(room, user.uid)) return gone();
      if (room.host !== user.uid) return err(403, "not_host", "Only the host can start the game.");
      if (room.status !== "lobby") return json(200, { room: roomView(room, user.uid, now(), {}) });
      if (room.players.length < minPlayers(room)) {
        return err(409, "need_players", minPlayers(room) > 2 ? `You need ${minPlayers(room)} players to start.` : "Wait for a friend to join.");
      }
      if (gameOf(room) === "wolf") {
        const no = wolf.start(room, body, now(), randInt);
        return no ? err(no.status, no.error, no.message) : null;
      }
      if (gameOf(room) === "moyomoyo") {
        moyo.start(room, now(), newSeed);
        return null;
      }
      room.status = "playing";
      room.riddles = pick(room.count);
      room.startAt = now() + RACE.COUNTDOWN_MS;
      return null;
    });
    if (res.error) return res.error;
    return json(200, { room: roomView(res.room, user.uid, now(), {}) });
  }

  // { q, answer }. Only the riddle on screen right now counts, and only the
  // first right answer the server gets wins it.
  async function answer(user, id, body) {
    if (!Number.isInteger(body.q) || typeof body.answer !== "string" || body.answer.length > 60) {
      return err(400, "invalid_answer", "That answer isn't right.");
    }
    const res = await update(id, (room) => {
      if (!isPlayer(room, user.uid)) return gone();
      if (gameOf(room) !== "riddles") return err(400, "wrong_game", "This room isn't a Riddle Race.");
      const t = now();
      const tl = MokuRiddles.raceTimeline(room, t);
      if (tl.phase !== "question" || tl.q !== body.q) {
        return json(200, { correct: MokuRiddles.isCorrect(room.riddles[body.q], body.answer), first: false, late: true, room: roomView(room, user.uid, t, {}) });
      }
      if (!MokuRiddles.isCorrect(room.riddles[body.q], body.answer)) return json(200, { correct: false, first: false, room: roomView(room, user.uid, t, {}) });
      room.wins = { ...(room.wins || {}), [body.q]: { uid: user.uid, at: t } };
      return null;
    });
    if (res.error) return res.error;
    return json(200, { correct: true, first: true, room: roomView(res.room, user.uid, now(), {}) });
  }

  // After a race: the host opens a new room with the same players already in it.
  async function again(user, id) {
    const old = await loadFor(user, id);
    if (!old || !isPlayer(old, user.uid)) return gone();
    if (old.host !== user.uid) return err(403, "not_host", "Only the host can start a new game.");
    if (phaseOf(old, now()) !== "done") return err(409, "not_done", "This game isn't over yet.");
    if (old.next) {
      const existing = await load(old.next);
      if (existing && existing.key === old.nextKey) return json(200, { room: roomView(existing, user.uid, now(), {}) });
    }
    const room = await newRoom(user, gameOf(old), old.count, old.players.map((p) => ({ ...p })), old);
    // Point the old room at the new one, so the friends waiting on the results move over too.
    const res = await update(id, (r) => { r.next = room.id; r.nextKey = room.key; return null; });
    if (res.error) return res.error;
    return json(201, { room: roomView(room, user.uid, now(), {}) });
  }

  return async function handler(event) {
    const method = event.requestContext?.http?.method || "GET";
    const path = (event.rawPath || "/").replace(/\/+$/, "") || "/";
    const one = /^\/rooms\/([^/]+)(?:\/(join|invite|leave|start|answer|again|state|wolf))?$/.exec(path);
    try {
      const isList = path === "/rooms" && (method === "GET" || method === "POST");
      const isOne = one && !one[2] && method === "GET";
      const isAction = one && one[2] && method === "POST";
      if (!isList && !isOne && !isAction) return err(404, "not_found", "not found");
      const id = one ? one[1].toUpperCase() : null;
      if (one && !CODE_RE.test(id)) return gone();

      const user = await authenticate(event);
      if (!user) return err(401, "unauthorized", "Please log in again.");

      if (isOne) return await get(user, id, event.queryStringParameters);
      if (isList && method === "GET") return await list(user, event.queryStringParameters);
      const body = parseBody(event);
      if (!body) return err(400, "invalid_json", "invalid JSON body");
      if (isList) return await create(user, body);
      switch (one[2]) {
        case "join": return await join(user, id);
        case "invite": return await invite(user, id, body);
        case "leave": return await leave(user, id);
        case "start": return await start(user, id, body);
        case "answer": return await answer(user, id, body);
        case "state": return await postState(user, id, body);
        case "wolf": return await postWolf(user, id, body);
        default: return await again(user, id);
      }
    } catch (e) {
      console.error(e);
      return err(500, "internal", "internal error");
    }
  };
}

exports.createRoomApi = createRoomApi;
exports.MAX_PLAYERS = MAX_PLAYERS;
