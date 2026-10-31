const crypto = require("crypto");
const { json } = require("./response");
const { TAG_RE, err, parseBody, tagOf, makeAuthenticate, findOpponent } = require("./playCommon");
const MokuRiddles = require("./vendor/moku-riddles");

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

const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";   // no I, L, O: easy to read out and type
const CODE_RE = /^[A-Z]{4}$/;
const MAX_PLAYERS = 6;
const MAX_INVITES = 10;
const COUNTS = [5, 10];
const MAX_OPEN_ROOMS = 10;                 // lobby/playing rooms you can be in at once (a soft cap)
const TTL_SEC = 24 * 60 * 60;              // a day after the last change, DynamoDB deletes it
const { RACE } = MokuRiddles;

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

// What a player (or an invited friend) sees.
function roomView(room, uid, t) {
  const tl = MokuRiddles.raceTimeline(room, t);
  const sc = scores(room);
  const tagByUid = {};
  room.players.forEach((p) => { tagByUid[p.uid] = p.tag; });
  const started = room.status === "playing";
  return {
    id: room.id,
    key: room.key,
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
  const { authSecret, now = () => Date.now(), newKey = () => crypto.randomBytes(8).toString("hex"), code = newCode, pick = pickRiddles } = config;
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
      const phase = MokuRiddles.raceTimeline(room, t).phase;
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

  async function newRoom(host, count, players) {
    const t = now();
    for (let i = 0; i < 8; i++) {
      const room = {
        id: code(),
        key: newKey(),
        host: host.uid,
        status: "lobby",
        count,
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
    const count = body.count === undefined ? 5 : body.count;
    if (!COUNTS.includes(count)) return err(400, "invalid_count", "Choose 5 or 10 riddles.");
    if ((await openRooms(user.uid)).filter((r) => isPlayer(r, user.uid)).length >= MAX_OPEN_ROOMS) {
      return err(409, "too_many_rooms", "Finish a race before opening a new room.");
    }
    const room = await newRoom(user, count, [seat(user)]);
    return json(201, { room: roomView(room, user.uid, now()) });
  }

  // Rooms you are in or were invited to that haven't finished.
  async function list(user) {
    const t = now();
    const rooms = (await openRooms(user.uid)).map((r) => roomView(r, user.uid, t));
    rooms.sort((a, b) => (a.joined === b.joined ? (b.updatedAt || "").localeCompare(a.updatedAt || "") : a.joined ? 1 : -1));
    return json(200, { rooms, invites: rooms.filter((r) => !r.joined && r.status === "lobby").length, now: t });
  }

  async function get(user, id, query) {
    const room = await loadFor(user, id);
    if (!room) return gone();
    const t = now();
    if (query && query.v !== undefined && String(room.version) === String(query.v)) return json(200, { changed: false, now: t });
    return json(200, { changed: true, room: roomView(room, user.uid, t) });
  }

  async function join(user, id) {
    const res = await update(id, (room) => {
      if (isPlayer(room, user.uid)) return json(200, { room: roomView(room, user.uid, now()) });
      if (room.status !== "lobby") return err(409, "already_started", "This race already started.");
      if (room.players.length >= MAX_PLAYERS) return err(409, "room_full", "This room is full.");
      room.players.push(seat(user));
      return null;
    }, (room) => [indexRow(user.uid, room)]);
    if (res.error) return res.error;
    return json(200, { room: roomView(res.room, user.uid, now()) });
  }

  async function invite(user, id, body) {
    if (typeof body.tag !== "string" || !TAG_RE.test(body.tag)) return err(400, "invalid_opponent", "Choose a friend to invite.");
    const found = await findOpponent(store, user, body.tag);
    if (found.error) return found.error;
    const friend = found.opponent;
    const res = await update(id, (room) => {
      if (!isPlayer(room, user.uid)) return gone();
      if (room.status !== "lobby") return err(409, "already_started", "This race already started.");
      if (isPlayer(room, friend.uid) || isInvited(room, friend.uid)) return json(200, { room: roomView(room, user.uid, now()) });
      if (room.invited.length >= MAX_INVITES) return err(409, "too_many_invites", "That's a lot of invites! Share the room code instead.");
      room.invited.push(seat(friend));
      return null;
    }, (room) => [indexRow(friend.uid, room)]);
    if (res.error) return res.error;
    return json(200, { room: roomView(res.room, user.uid, now()) });
  }

  // In the lobby: leave (the host leaving closes the room). Once it started
  // there is nothing to undo — you just stop playing.
  async function leave(user, id) {
    const res = await update(id, (room) => {
      if (!isPlayer(room, user.uid) && !isInvited(room, user.uid)) return gone();
      if (room.status !== "lobby") return json(200, { room: roomView(room, user.uid, now()) });
      if (room.host === user.uid) room.status = "closed";
      room.players = room.players.filter((p) => p.uid !== user.uid);
      room.invited = room.invited.filter((p) => p.uid !== user.uid);
      return null;
    });
    if (res.error) return res.error;
    return json(200, { ok: true });
  }

  async function start(user, id) {
    const res = await update(id, (room) => {
      if (!isPlayer(room, user.uid)) return gone();
      if (room.host !== user.uid) return err(403, "not_host", "Only the host can start the race.");
      if (room.status !== "lobby") return json(200, { room: roomView(room, user.uid, now()) });
      if (room.players.length < 2) return err(409, "need_players", "Wait for a friend to join.");
      room.status = "playing";
      room.riddles = pick(room.count);
      room.startAt = now() + RACE.COUNTDOWN_MS;
      return null;
    });
    if (res.error) return res.error;
    return json(200, { room: roomView(res.room, user.uid, now()) });
  }

  // { q, answer }. Only the riddle on screen right now counts, and only the
  // first right answer the server gets wins it.
  async function answer(user, id, body) {
    if (!Number.isInteger(body.q) || typeof body.answer !== "string" || body.answer.length > 60) {
      return err(400, "invalid_answer", "That answer isn't right.");
    }
    const res = await update(id, (room) => {
      if (!isPlayer(room, user.uid)) return gone();
      const t = now();
      const tl = MokuRiddles.raceTimeline(room, t);
      if (tl.phase !== "question" || tl.q !== body.q) {
        return json(200, { correct: MokuRiddles.isCorrect(room.riddles[body.q], body.answer), first: false, late: true, room: roomView(room, user.uid, t) });
      }
      if (!MokuRiddles.isCorrect(room.riddles[body.q], body.answer)) return json(200, { correct: false, first: false, room: roomView(room, user.uid, t) });
      room.wins = { ...(room.wins || {}), [body.q]: { uid: user.uid, at: t } };
      return null;
    });
    if (res.error) return res.error;
    return json(200, { correct: true, first: true, room: roomView(res.room, user.uid, now()) });
  }

  // After a race: the host opens a new room with the same players already in it.
  async function again(user, id) {
    const old = await loadFor(user, id);
    if (!old || !isPlayer(old, user.uid)) return gone();
    if (old.host !== user.uid) return err(403, "not_host", "Only the host can start a new race.");
    if (MokuRiddles.raceTimeline(old, now()).phase !== "done") return err(409, "not_done", "This race isn't over yet.");
    if (old.next) {
      const existing = await load(old.next);
      if (existing && existing.key === old.nextKey) return json(200, { room: roomView(existing, user.uid, now()) });
    }
    const room = await newRoom(user, old.count, old.players.map((p) => ({ ...p })));
    // Point the old room at the new one, so the friends waiting on the results move over too.
    const res = await update(id, (r) => { r.next = room.id; r.nextKey = room.key; return null; });
    if (res.error) return res.error;
    return json(201, { room: roomView(room, user.uid, now()) });
  }

  return async function handler(event) {
    const method = event.requestContext?.http?.method || "GET";
    const path = (event.rawPath || "/").replace(/\/+$/, "") || "/";
    const one = /^\/rooms\/([^/]+)(?:\/(join|invite|leave|start|answer|again))?$/.exec(path);
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
      if (isList && method === "GET") return await list(user);
      const body = parseBody(event);
      if (!body) return err(400, "invalid_json", "invalid JSON body");
      if (isList) return await create(user, body);
      switch (one[2]) {
        case "join": return await join(user, id);
        case "invite": return await invite(user, id, body);
        case "leave": return await leave(user, id);
        case "start": return await start(user, id);
        case "answer": return await answer(user, id, body);
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
