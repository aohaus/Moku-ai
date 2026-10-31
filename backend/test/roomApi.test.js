// Riddle Race rooms (src/roomApi.js) on the in-memory store. No AWS needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { createRoomApi } = require("../src/roomApi");
const { createMemoryStore } = require("../src/memoryStore");
const MokuRiddles = require("../src/vendor/moku-riddles");
const token = require("../src/token");

const SECRET = "test-secret-test-secret-test-secret-00";
const { COUNTDOWN_MS, LIMIT_MS, GAP_MS } = MokuRiddles.RACE;

async function setup({ codes } = {}) {
  let clock = Date.parse("2026-10-31T00:00:00Z");
  let keys = 0;
  const codeList = codes ? codes.slice() : null;
  let codeN = 0;
  const store = createMemoryStore();
  const api = createRoomApi(store, {
    authSecret: SECRET,
    now: () => clock,
    newKey: () => String(++keys).padStart(16, "0"),
    code: () => (codeList && codeList.length ? codeList.shift() : "R" + "ABCDEFGH"[codeN++ % 8] + "ZZ"),
    pick: (n) => ["bicycle", "sunglasses", "i-understand", "rainbow", "tennis", "starfish", "forget-it", "popcorn", "sunset", "big-deal"].slice(0, n),
  });
  const users = {};
  for (const [loginId, uid, role] of [
    ["aoi", "a0a0a0a0a0a0a0a0", null],
    ["ren", "b1b1b1b1b1b1b1b1", null],
    ["sora", "c2c2c2c2c2c2c2c2", null],
    ["admin", "d3d3d3d3d3d3d3d3", "admin"],
  ]) {
    const user = { loginId, uid, displayName: loginId.toUpperCase(), tv: 1, pinHash: "x", ...(role ? { role } : {}) };
    await store.createUser(user, 100, { uncounted: !!role });
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
  return { store, users, call, tick: (ms) => (clock += ms), now: () => clock };
}

async function raceOf3(t, count = 5) {
  const room = (await t.call("POST", "/rooms", "aoi", { count })).body.room;
  await t.call("POST", `/rooms/${room.id}/join`, "ren", {});
  await t.call("POST", `/rooms/${room.id}/join`, "sora", {});
  const started = await t.call("POST", `/rooms/${room.id}/start`, "aoi", {});
  assert.equal(started.status, 200);
  return started.body.room;
}

test("the vendor copy of moku-riddles.js matches shared/", () => {
  const shared = fs.readFileSync(path.join(__dirname, "../../shared/moku-riddles.js"), "utf8");
  const vendor = fs.readFileSync(path.join(__dirname, "../src/vendor/moku-riddles.js"), "utf8");
  assert.ok(shared === vendor, "backend/src/vendor/moku-riddles.js differs: cp shared/moku-riddles.js backend/src/vendor/");
});

test("riddle data: 100 riddles, unique ids, and no wrong choice counts as right", () => {
  const R = MokuRiddles.RIDDLES;
  assert.equal(R.length, 100);
  assert.equal(new Set(R.map((r) => r.id)).size, 100);
  for (const r of R) {
    assert.ok([1, 2, 3].includes(r.level), r.id);
    assert.equal(r.choices.length, 3, r.id);
    assert.ok(r.art.length > 0 && r.clue && r.why, r.id);
    assert.ok(MokuRiddles.isCorrect(r.id, r.answer.toUpperCase()), r.id);
    for (const c of r.choices) assert.ok(!MokuRiddles.isCorrect(r.id, c), `${r.id}: "${c}" is a choice but counts as right`);
  }
  assert.ok(MokuRiddles.isCorrect("bow-tie", "Bow-Tie!"));
  assert.ok(!MokuRiddles.isCorrect("bow-tie", ""));
  assert.ok(!MokuRiddles.isCorrect("nope", "bow tie"));
});

test("rooms need a login; a friend joins with the code and sees the lobby", async () => {
  const t = await setup();
  assert.equal((await t.call("GET", "/rooms")).status, 401);
  assert.equal((await t.call("POST", "/rooms", "aoi", { count: 7 })).body.error, "invalid_count");
  const r = await t.call("POST", "/rooms", "aoi", { count: 5 });
  assert.equal(r.status, 201);
  const room = r.body.room;
  assert.match(room.id, /^[A-Z]{4}$/);
  assert.deepEqual([room.status, room.isHost, room.joined, room.players.length, room.riddles.length], ["lobby", true, true, 1, 0]);
  assert.equal((await t.call("GET", `/rooms/${room.id}`, "ren")).status, 404, "not in the room yet");
  const joined = await t.call("POST", `/rooms/${room.id.toLowerCase()}/join`, "ren", {});
  assert.equal(joined.status, 200, "codes are not case sensitive");
  assert.deepEqual(joined.body.room.players.map((p) => [p.name, p.host]), [["AOI", true], ["REN", false]]);
  assert.equal((await t.call("POST", `/rooms/${room.id}/join`, "ren", {})).body.room.players.length, 2, "joining twice is fine");
  assert.equal((await t.call("POST", "/rooms/QQQQ/join", "ren", {})).status, 404);
  const raw = JSON.stringify(joined.body);
  for (const secret of ["a0a0a0a0a0a0a0a0", "b1b1b1b1b1b1b1b1", '"aoi"', '"ren"']) assert.ok(!raw.includes(secret), secret);
});

test("only the host starts, with at least 2 players; nobody joins after the start", async () => {
  const t = await setup();
  const room = (await t.call("POST", "/rooms", "aoi", {})).body.room;
  assert.equal((await t.call("POST", `/rooms/${room.id}/start`, "aoi", {})).body.error, "need_players");
  await t.call("POST", `/rooms/${room.id}/join`, "ren", {});
  assert.equal((await t.call("POST", `/rooms/${room.id}/start`, "ren", {})).body.error, "not_host");
  const s = (await t.call("POST", `/rooms/${room.id}/start`, "aoi", {})).body.room;
  assert.equal(s.status, "playing");
  assert.deepEqual(s.riddles, ["bicycle", "sunglasses", "i-understand", "rainbow", "tennis"]);
  assert.equal(s.startAt, t.now() + COUNTDOWN_MS);
  assert.equal((await t.call("POST", `/rooms/${room.id}/join`, "sora", {})).body.error, "already_started");
});

test("the first right answer wins the riddle; late and wrong answers don't", async () => {
  const t = await setup();
  const room = await raceOf3(t);
  // During the countdown nothing counts yet.
  const early = await t.call("POST", `/rooms/${room.id}/answer`, "ren", { q: 0, answer: "bicycle" });
  assert.deepEqual([early.body.correct, early.body.first, early.body.late], [true, false, true]);
  t.tick(COUNTDOWN_MS + 3000);
  const wrong = await t.call("POST", `/rooms/${room.id}/answer`, "ren", { q: 0, answer: "motorcycle" });
  assert.deepEqual([wrong.body.correct, wrong.body.first], [false, false]);
  const ahead = await t.call("POST", `/rooms/${room.id}/answer`, "ren", { q: 1, answer: "sunglasses" });
  assert.equal(ahead.body.first, false, "only the riddle on screen counts");
  const win = await t.call("POST", `/rooms/${room.id}/answer`, "sora", { q: 0, answer: "Bi Cycle" });
  assert.deepEqual([win.body.correct, win.body.first], [true, true]);
  assert.deepEqual(win.body.room.wins, [{ q: 0, tag: t.users.sora.tag, at: t.now() }]);
  t.tick(200);
  const second = await t.call("POST", `/rooms/${room.id}/answer`, "aoi", { q: 0, answer: "bicycle" });
  assert.deepEqual([second.body.correct, second.body.first], [true, false]);
  const scores = Object.fromEntries(second.body.room.players.map((p) => [p.name, p.score]));
  assert.deepEqual(scores, { AOI: 0, REN: 0, SORA: 1 });
  // Next riddle after the reveal gap.
  t.tick(GAP_MS);
  assert.equal((await t.call("POST", `/rooms/${room.id}/answer`, "aoi", { q: 1, answer: "sunglasses" })).body.first, true);
});

test("the timeline: time runs out, the race ends, and polling only sends changes", async () => {
  const t = await setup();
  const room = await raceOf3(t, 5);
  const tl = (at) => MokuRiddles.raceTimeline({ status: "playing", startAt: room.startAt, count: 5, wins: {} }, at);
  assert.equal(tl(room.startAt - 1).phase, "countdown");
  assert.deepEqual(tl(room.startAt + 10), { phase: "question", q: 0, startAt: room.startAt, endsAt: room.startAt + LIMIT_MS });
  assert.equal(tl(room.startAt + LIMIT_MS).phase, "reveal");
  assert.equal(tl(room.startAt + LIMIT_MS + GAP_MS).q, 1);
  assert.equal(tl(room.startAt + 5 * (LIMIT_MS + GAP_MS)).phase, "done");

  const g = await t.call("GET", `/rooms/${room.id}`, "ren", undefined, { v: String(room.version) });
  assert.deepEqual(g.body, { changed: false, now: t.now() });
  t.tick(COUNTDOWN_MS + 1000);
  await t.call("POST", `/rooms/${room.id}/answer`, "ren", { q: 0, answer: "bicycle" });
  const g2 = await t.call("GET", `/rooms/${room.id}`, "aoi", undefined, { v: String(room.version) });
  assert.equal(g2.body.changed, true);
  assert.equal(g2.body.room.wins.length, 1);
  t.tick(5 * (LIMIT_MS + GAP_MS));
  assert.equal((await t.call("GET", `/rooms/${room.id}`, "aoi")).body.room.status, "done");
  assert.equal((await t.call("GET", "/rooms", "aoi")).body.rooms.length, 0, "finished rooms leave the list");
});

test("invites show up in the friend's list; the host leaving closes the lobby", async () => {
  const t = await setup();
  const room = (await t.call("POST", "/rooms", "aoi", {})).body.room;
  assert.equal((await t.call("POST", `/rooms/${room.id}/invite`, "aoi", { tag: t.users.admin.tag })).status, 404, "no admin");
  assert.equal((await t.call("POST", `/rooms/${room.id}/invite`, "ren", { tag: t.users.sora.tag })).status, 404, "only players invite");
  await t.call("POST", `/rooms/${room.id}/invite`, "aoi", { tag: t.users.ren.tag });
  const list = (await t.call("GET", "/rooms", "ren")).body;
  assert.equal(list.invites, 1);
  assert.deepEqual([list.rooms[0].id, list.rooms[0].joined], [room.id, false]);
  assert.equal((await t.call("GET", `/rooms/${room.id}`, "ren")).status, 200, "an invited friend can look before joining");
  await t.call("POST", `/rooms/${room.id}/join`, "ren", {});
  assert.equal((await t.call("GET", "/rooms", "ren")).body.invites, 0);
  await t.call("POST", `/rooms/${room.id}/leave`, "aoi", {});
  assert.equal((await t.call("GET", "/rooms", "ren")).body.rooms.length, 0, "a closed room is gone");
  assert.equal((await t.call("POST", `/rooms/${room.id}/join`, "sora", {})).body.error, "already_started");
});

test("a room holds 6 players", async () => {
  const t = await setup();
  const room = (await t.call("POST", "/rooms", "aoi", {})).body.room;
  const stored = await t.store.getRoom(room.id);
  for (let i = 0; i < 5; i++) stored.players.push({ uid: `f${i}`.padEnd(16, "0"), name: `F${i}`, tag: `uf${i}000` });
  await t.store.saveRoom(stored, stored.version);
  assert.equal((await t.call("POST", `/rooms/${room.id}/join`, "ren", {})).body.error, "room_full");
});

test("play again: the host's new room takes everyone, and the old room points to it", async () => {
  const t = await setup();
  const room = await raceOf3(t, 5);
  assert.equal((await t.call("POST", `/rooms/${room.id}/again`, "aoi", {})).body.error, "not_done");
  t.tick(COUNTDOWN_MS + 5 * (LIMIT_MS + GAP_MS));
  assert.equal((await t.call("POST", `/rooms/${room.id}/again`, "ren", {})).body.error, "not_host");
  const again = await t.call("POST", `/rooms/${room.id}/again`, "aoi", {});
  assert.equal(again.status, 201);
  assert.notEqual(again.body.room.id, room.id);
  assert.deepEqual(again.body.room.players.map((p) => p.name), ["AOI", "REN", "SORA"]);
  assert.equal(again.body.room.status, "lobby");
  const old = (await t.call("GET", `/rooms/${room.id}`, "sora")).body.room;
  assert.equal(old.next, again.body.room.id);
  assert.equal((await t.call("GET", `/rooms/${old.next}`, "sora")).body.room.joined, true);
  assert.equal((await t.call("POST", `/rooms/${room.id}/again`, "aoi", {})).body.room.id, again.body.room.id, "pressing twice is fine");
});

test("a taken code is skipped; an expired room's code can be used again", async () => {
  const t = await setup({ codes: ["ABCD", "ABCD", "EFGH", "ABCD"] });
  assert.equal((await t.call("POST", "/rooms", "aoi", {})).body.room.id, "ABCD");
  assert.equal((await t.call("POST", "/rooms", "ren", {})).body.room.id, "EFGH");
  t.tick(25 * 60 * 60 * 1000);
  const reused = (await t.call("POST", "/rooms", "sora", {})).body.room;
  assert.equal(reused.id, "ABCD");
  assert.equal((await t.call("GET", "/rooms/ABCD", "aoi")).status, 404, "the old host isn't in the new room");
  assert.equal((await t.call("GET", "/rooms", "aoi")).body.rooms.length, 0);
});
