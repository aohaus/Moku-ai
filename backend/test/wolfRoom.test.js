// Moku Wolf Multiplayer rooms (src/roomApi.js + src/wolfParty.js) on the in-memory store.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { createRoomApi } = require("../src/roomApi");
const { createMemoryStore } = require("../src/memoryStore");
const { RULES } = require("../src/wolfParty");
const token = require("../src/token");

const SECRET = "test-secret-test-secret-test-secret-00";
const NAMES = ["aoi", "ren", "sora", "mio", "kai"];

async function setup() {
  let clock = Date.parse("2026-10-31T00:00:00Z");
  let keys = 0, codes = 0;
  const store = createMemoryStore();
  const api = createRoomApi(store, {
    authSecret: SECRET,
    now: () => clock,
    newKey: () => String(++keys).padStart(16, "0"),
    code: () => "W" + "ABCDEFGH"[codes++ % 8] + "ZZ",
  });
  const users = {};
  for (const [i, loginId] of NAMES.entries()) {
    const uid = String(i + 1).repeat(16);
    const user = { loginId, uid, displayName: loginId.toUpperCase(), tv: 1, pinHash: "x" };
    await store.createUser(user, 100, {});
    users[loginId] = { tag: `u${uid.slice(0, 5)}`, token: token.sign({ lid: loginId, uid, name: user.displayName, tv: 1 }, SECRET, clock) };
  }
  async function call(method, rawPath, who, body, query) {
    const res = await api({
      requestContext: { http: { method } },
      rawPath,
      queryStringParameters: query,
      headers: who ? { authorization: `Bearer ${users[who].token}` } : {},
      body: body === undefined ? "" : JSON.stringify(body),
    });
    return { status: res.statusCode, body: JSON.parse(res.body) };
  }
  return { store, users, call, tick: (ms) => (clock += ms) };
}

async function lobby(t, who = ["ren", "sora"]) {
  const room = (await t.call("POST", "/rooms", "aoi", { game: "wolf" })).body.room;
  for (const w of who) assert.equal((await t.call("POST", `/rooms/${room.id}/join`, w, {})).status, 200);
  return room;
}
async function started(t, who, settings = {}) {
  const room = await lobby(t, who);
  const res = await t.call("POST", `/rooms/${room.id}/start`, "aoi", { topic: "food", wolves: 1, minutes: 3, ...settings });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.room;
}
const look = async (t, id, who) => (await t.call("GET", `/rooms/${id}`, who)).body.room;
const act = (t, id, who, body) => t.call("POST", `/rooms/${id}/wolf`, who, body);

// Who got the odd word out (with 1 WordMoku the wolf word is the one only one player has).
async function words(t, id, players) {
  const out = {};
  for (const w of players) out[w] = (await look(t, id, w)).wolf.you.w;
  const count = {};
  Object.values(out).forEach((x) => { count[x] = (count[x] || 0) + 1; });
  const wolves = players.filter((w) => count[out[w]] === 1);
  return { out, wolves, citizens: players.filter((w) => !wolves.includes(w)) };
}

test("a wolf room: 3–10 players, its own list, settings checked at start", async () => {
  const t = await setup();
  const made = await t.call("POST", "/rooms", "aoi", { game: "wolf" });
  assert.equal(made.status, 201);
  const room = made.body.room;
  assert.equal(room.game, "wolf");
  assert.deepEqual(room.settings, { topic: "food", wolves: 1, minutes: 3 });
  assert.equal(room.wolf, null);
  assert.equal(room.rules.MAX_PLAYERS, 10);

  await t.call("POST", `/rooms/${room.id}/join`, "ren", {});
  const two = await t.call("POST", `/rooms/${room.id}/start`, "aoi", {});
  assert.equal(two.status, 409);
  assert.equal(two.body.error, "need_players");

  await t.call("POST", `/rooms/${room.id}/join`, "sora", {});
  assert.equal((await t.call("POST", `/rooms/${room.id}/start`, "ren", {})).body.error, "not_host");
  assert.equal((await t.call("POST", `/rooms/${room.id}/start`, "aoi", { topic: "space" })).body.error, "invalid_topic");
  assert.equal((await t.call("POST", `/rooms/${room.id}/start`, "aoi", { wolves: 2 })).body.error, "invalid_wolves", "3 players: 1 WordMoku");
  assert.equal((await t.call("POST", `/rooms/${room.id}/start`, "aoi", { minutes: 4 })).body.error, "invalid_minutes");

  const list = await t.call("GET", "/rooms", "ren", undefined, { game: "wolf" });
  assert.deepEqual(list.body.rooms.map((r) => r.id), [room.id]);
  assert.deepEqual((await t.call("GET", "/rooms", "ren")).body.rooms, [], "not in the Riddle Race list");
  assert.equal((await t.call("POST", `/rooms/${room.id}/answer`, "aoi", { q: 0, answer: "x" })).body.error, "wrong_game");
  assert.equal((await act(t, room.id, "aoi", { do: "ready" })).body.error, "not_playing");
});

test("each phone gets only its own word; everyone sees all words at the end", async () => {
  const t = await setup();
  const room = await started(t, ["ren", "sora", "mio", "kai"], { topic: "school", wolves: 2, minutes: 1 });
  assert.equal(room.status, "playing");
  assert.equal(room.wolf.stage, "check");
  assert.equal(room.wolf.wolves, 2);
  assert.equal(JSON.stringify(room).includes("wolfUids"), false);
  const seen = {};
  for (const w of NAMES) {
    const r = await look(t, room.id, w);
    seen[w] = r.wolf.you.w;
    assert.equal(r.wolf.result, null);
    assert.equal(r.wolf.choices, null);
    // Nothing in the room tells you the other word.
    const other = Object.values(seen).find((x) => x !== r.wolf.you.w);
    if (other) assert.equal(JSON.stringify(r).includes(other), false);
  }
  const counts = {};
  Object.values(seen).forEach((x) => { counts[x] = (counts[x] || 0) + 1; });
  assert.deepEqual(Object.values(counts).sort(), [2, 3], "2 WordMoku, 3 Citizens");
});

test("ready → talk → vote → a caught WordMoku picks the Citizens' word and steals the win", async () => {
  const t = await setup();
  const players = ["aoi", "ren", "sora", "mio"];
  const room = await started(t, ["ren", "sora", "mio"], { minutes: 2 });
  for (const w of players.slice(0, 3)) assert.equal((await act(t, room.id, w, { do: "ready" })).status, 200);
  let r = await look(t, room.id, "aoi");
  assert.equal(r.wolf.stage, "check");
  assert.equal(r.wolf.ready.length, 3);
  r = (await act(t, room.id, "mio", { do: "ready" })).body.room;
  assert.equal(r.wolf.stage, "talk");
  assert.equal(r.wolf.talkEndAt, r.now + 2 * 60000);

  assert.equal((await act(t, room.id, "aoi", { do: "vote", tag: t.users.ren.tag })).body.error, "not_voting");
  t.tick(2 * 60000);
  r = await look(t, room.id, "ren");
  assert.equal(r.wolf.stage, "vote", "the timer ran out");

  const { wolves, citizens } = await words(t, room.id, players);
  const [wolfName] = wolves;
  assert.equal((await act(t, room.id, wolfName, { do: "vote", tag: t.users[wolfName].tag })).body.error, "invalid_vote", "not yourself");
  for (const w of players) {
    const target = w === wolfName ? citizens[0] : wolfName;
    assert.equal((await act(t, room.id, w, { do: "vote", tag: t.users[target].tag })).status, 200);
  }
  r = await look(t, room.id, citizens[0]);
  assert.equal(r.wolf.stage, "guess");
  assert.equal(r.wolf.caught, t.users[wolfName].tag);
  assert.equal(r.wolf.choices, null, "only the caught WordMoku sees the choices");
  assert.equal((await act(t, room.id, citizens[0], { do: "guess", pick: 0 })).body.error, "not_guessing");

  const mine = await look(t, room.id, wolfName);
  assert.equal(mine.wolf.choices.length, RULES.CHOICES);
  const citizenWord = (await look(t, room.id, citizens[0])).wolf.you.w;
  assert.ok(mine.wolf.choices.some((c) => c.w === citizenWord));
  assert.ok(!mine.wolf.choices.some((c) => c.w === mine.wolf.you.w), "not your own word");
  const pick = mine.wolf.choices.findIndex((c) => c.w === citizenWord);
  r = (await act(t, room.id, wolfName, { do: "guess", pick })).body.room;
  assert.equal(r.status, "done");
  assert.equal(r.wolf.result.winner, "wolf");
  assert.equal(r.wolf.result.citizenWord.w, citizenWord);
  assert.deepEqual(r.wolf.result.wolves, [t.users[wolfName].tag]);
  assert.equal(r.wolf.result.votes.length, 4);
});

test("a wrong guess, a citizen voted out, and a tie", async () => {
  // Wrong guess → Citizens win.
  let t = await setup();
  let room = await started(t, ["ren", "sora"]);
  let ws = await words(t, room.id, ["aoi", "ren", "sora"]);
  for (const w of ["aoi", "ren", "sora"]) await act(t, room.id, w, { do: "ready" });
  await act(t, room.id, "aoi", { do: "skip" });   // host: vote now
  for (const w of ["aoi", "ren", "sora"]) {
    await act(t, room.id, w, { do: "vote", tag: t.users[w === ws.wolves[0] ? ws.citizens[0] : ws.wolves[0]].tag });
  }
  let mine = await look(t, room.id, ws.wolves[0]);
  const wrong = mine.wolf.choices.findIndex((c) => c.w !== ws.out[ws.citizens[0]]);
  let r = (await act(t, room.id, ws.wolves[0], { do: "guess", pick: wrong })).body.room;
  assert.equal(r.wolf.result.winner, "citizens");

  // A Citizen voted out → the WordMoku wins at once.
  t = await setup();
  room = await started(t, ["ren", "sora"]);
  ws = await words(t, room.id, ["aoi", "ren", "sora"]);
  await act(t, room.id, "aoi", { do: "skip" });
  await act(t, room.id, "aoi", { do: "skip" });
  for (const w of ["aoi", "ren", "sora"]) {
    const target = w === ws.citizens[0] ? ws.citizens[1] : ws.citizens[0];
    await act(t, room.id, w, { do: "vote", tag: t.users[target].tag });
  }
  r = await look(t, room.id, "ren");
  assert.equal(r.status, "done");
  assert.equal(r.wolf.result.winner, "wolf");
  assert.equal(r.wolf.caught, t.users[ws.citizens[0]].tag);

  // A tie (or nobody voting before time is up) catches nobody.
  t = await setup();
  room = await started(t, ["ren", "sora"]);
  await act(t, room.id, "aoi", { do: "skip" });
  await act(t, room.id, "aoi", { do: "skip" });
  t.tick(RULES.VOTE_MS);
  r = await look(t, room.id, "sora");
  assert.equal(r.status, "done");
  assert.equal(r.wolf.tie, true);
  assert.equal(r.wolf.result.winner, "wolf");
});

test("a caught WordMoku that doesn't pick in time misses; again keeps the settings", async () => {
  const t = await setup();
  const room = await started(t, ["ren", "sora", "mio", "kai"], { topic: "fantasy", wolves: 2, minutes: 5 });
  const players = ["aoi", "ren", "sora", "mio", "kai"];
  const ws = await words(t, room.id, players);
  const wolfName = Object.keys(ws.out).find((w) => Object.values(ws.out).filter((x) => x === ws.out[w]).length === 2);
  await act(t, room.id, "aoi", { do: "skip" });
  await act(t, room.id, "aoi", { do: "skip" });
  for (const w of players) {
    const target = w === wolfName ? players.find((x) => x !== w) : wolfName;
    await act(t, room.id, w, { do: "vote", tag: t.users[target].tag });
  }
  let r = await look(t, room.id, "aoi");
  assert.equal(r.wolf.stage, "guess");
  assert.equal((await t.call("POST", `/rooms/${room.id}/again`, "aoi", {})).body.error, "not_done");
  t.tick(RULES.GUESS_MS);
  r = await look(t, room.id, "aoi");
  assert.equal(r.status, "done");
  assert.equal(r.wolf.result.winner, "citizens");
  assert.equal(r.wolf.result.pick, null);

  const again = await t.call("POST", `/rooms/${room.id}/again`, "aoi", {});
  assert.equal(again.status, 201);
  assert.equal(again.body.room.game, "wolf");
  assert.equal(again.body.room.players.length, 5);
  assert.deepEqual(again.body.room.settings, { topic: "fantasy", wolves: 2, minutes: 5 });
});

test("the server's word list is the same file as shared/", () => {
  const read = (p) => fs.readFileSync(path.join(__dirname, p), "utf8");
  assert.equal(read("../src/vendor/moku-wolf-words.js"), read("../../shared/moku-wolf-words.js"),
    "run: cp shared/moku-wolf-words.js backend/src/vendor/");
  const Words = require("../src/vendor/moku-wolf-words");
  const all = Words.pool("mix").flatMap((p) => [p.w1, p.w2]);
  assert.equal(new Set(all).size, all.length, "every word is unique");
  Words.pool("mix").forEach((p) => ["w1", "j1", "e1", "w2", "j2", "e2"].forEach((k) => assert.ok(p[k], `${p.w1}: ${k}`)));
});
