// Riddle Race rooms (src/roomApi.js) on the in-memory store. No AWS needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { createRoomApi } = require("../src/roomApi");
const { createMemoryStore } = require("../src/memoryStore");
const MokuRiddles = require("../src/riddles");
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
    pick: (n) => ["bicycle", "airport", "i-understand", "high-five", "tennis", "underground", "forget-it", "sunflower", "sunset", "big-deal"].slice(0, n),
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

test("the vendor copies of moku-riddles.js and riddles-db.md match shared/ and data/", () => {
  for (const [src, copy, cmd] of [
    ["../../shared/moku-riddles.js", "../src/vendor/moku-riddles.js", "cp shared/moku-riddles.js backend/src/vendor/"],
    ["../../data/riddles-db.md", "../src/vendor/riddles-db.md", "cp data/riddles-db.md backend/src/vendor/"],
  ]) {
    const a = fs.readFileSync(path.join(__dirname, src), "utf8");
    const b = fs.readFileSync(path.join(__dirname, copy), "utf8");
    assert.ok(a === b, `backend/src/vendor copy differs: ${cmd}`);
  }
});

test("riddle data: every riddle in riddles-db.md reads, no duplicates, no wrong choice counts as right", () => {
  const parsed = MokuRiddles.parse(fs.readFileSync(path.join(__dirname, "../../data/riddles-db.md"), "utf8"));
  assert.deepEqual(parsed.problems, [], "fix these riddles in data/riddles-db.md");
  assert.deepEqual(parsed.duplicates, [], "these IDs (or their answers) are in data/riddles-db.md twice");
  const R = MokuRiddles.RIDDLES;
  assert.ok(R.length >= 100, `only ${R.length} riddles`);
  assert.equal(new Set(R.map((r) => r.id)).size, R.length);
  for (const r of R) {
    assert.match(r.id, /^[a-z0-9-]+$/);
    assert.ok([1, 2, 3].includes(r.level), r.id);
    assert.equal(r.choices.length, 3, r.id);
    assert.ok(r.art.length > 0 && r.clue && r.why, r.id);
    assert.ok(MokuRiddles.isCorrect(r.id, r.answer.toUpperCase()), r.id);
    for (const c of r.choices) assert.ok(!MokuRiddles.isCorrect(r.id, c), `${r.id}: "${c}" is a choice but counts as right`);
    for (const p of r.art) assert.ok(!p.c || p.c === "ink", `${r.id}: one ink color (use {…} for the accent)`);
    // Every riddle shows how the phrase is used (data/RIDDLES_GUIDE.md), and the sentence really uses it.
    const said = MokuRiddles.norm(r.example);
    assert.ok(r.example && MokuRiddles.accepted(r).some((ans) => said.includes(ans)), `${r.id}: Example must use the answer`);
  }
  assert.ok(MokuRiddles.isCorrect("high-five", "High-Five!"));
  assert.ok(!MokuRiddles.isCorrect("high-five", ""));
  assert.ok(!MokuRiddles.isCorrect("nope", "high five"));
});

test("riddle engine: Markdown fields, the Visual layout words, and what it refuses", () => {
  const md = [
    "# title", "",
    "## ID: 12", "- **Pattern**: quantity", "- **Visual**: Get it (x4) (v5)", "- **Answer**: Forget it", "- **Hint**: Four gets", "",
    "## ID: 13", "- **Visual**: T-O-W-N (vertical stack)", "- **Answer**: downtown", "",
    "## ID: 14", "- **Visual**: DAY surrounded by M-I-D", "- **Answer**: midday", "- **Level**: easy", "",
    "## ID: 15", "- **Visual**: father / [stairs]", "- **Answer**: stepfather", "",
    "## ID: 16", "- **Visual**: LIFE (wobbly)", "- **Answer**: afterlife", "",
    "## ID: 17", "- **Pattern**: emoji", "- **Visual**: ☀️ + 👓", "- **Answer**: sunglasses", "",
    "## ID: 18", "- **Visual**: GET IT | GET IT | GET IT | GET IT", "- **Answer**: forget it", "",
  ].join("\n");
  const p = MokuRiddles.parse(md);
  assert.deepEqual(p.riddles.map((r) => r.id), ["12", "13", "14"]);
  assert.deepEqual(p.duplicates, ["18"], "the same answer twice");
  assert.equal(p.problems.length, 2);
  assert.match(p.problems[0], /15.*unknown item \[stairs\]/);
  assert.match(p.problems[1], /16.*unknown modifier "wobbly"/);
  const [a, b, c] = p.riddles;
  assert.deepEqual([a.answer, a.level, a.clue, a.art.length], ["forget it", 2, "Four gets", 4]);
  assert.deepEqual([b.art[0].t, b.art[0].vert], ["TOWN", 1]);
  assert.deepEqual(c.art[0].parts, [["MI", "ink"], ["DAY", "accent"], ["D", "ink"]]);
  assert.equal(c.level, 1);
  const art = (v) => MokuRiddles.layout(v, []);
  assert.deepEqual(art("CHAIR (top)").map((x) => [x.t, x.y]), [["CHAIR", 16]]);
  assert.deepEqual(art("[line] / GROUND").map((x) => (x.line ? "line" : x.t)), ["line", "GROUND"]);
  assert.equal(art("PACK (backwards)")[0].t, "KCAP");
  assert.deepEqual(art("ICE^3").map((x) => x.t), ["ICE", "3"]);
  assert.equal(art("[box: LUNCH]")[0].box.length, 2);
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
  assert.deepEqual(s.riddles, ["bicycle", "airport", "i-understand", "high-five", "tennis"]);
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
  const ahead = await t.call("POST", `/rooms/${room.id}/answer`, "ren", { q: 1, answer: "airport" });
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
  assert.equal((await t.call("POST", `/rooms/${room.id}/answer`, "aoi", { q: 1, answer: "airport" })).body.first, true);
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
  assert.equal((await t.call("POST", `/rooms/${room.id}/join`, "sora", {})).body.error, "room_closed");
});

test("a lobby nobody joins closes after the invite expiry (60 minutes by default)", async () => {
  const t = await setup();
  const room = (await t.call("POST", "/rooms", "aoi", {})).body.room;
  assert.equal(room.expiresAt, new Date(t.now() + 60 * 60 * 1000).toISOString());
  await t.call("POST", `/rooms/${room.id}/invite`, "aoi", { tag: t.users.ren.tag });
  t.tick(59 * 60 * 1000);
  assert.equal((await t.call("GET", "/rooms", "ren")).body.invites, 1, "still open after 59 minutes");

  t.tick(2 * 60 * 1000);
  const v = (await t.store.getRoom(room.id)).version;
  const polled = (await t.call("GET", `/rooms/${room.id}`, "aoi", undefined, { v: String(v) })).body;
  assert.equal(polled.changed, true, "a page polling with ?v= hears about it");
  assert.deepEqual([polled.room.status, polled.room.closedReason], ["closed", "expired"]);
  assert.equal((await t.call("GET", "/rooms", "ren")).body.invites, 0, "the invite is gone");
  const join = await t.call("POST", `/rooms/${room.id}/join`, "sora", {});
  assert.deepEqual([join.status, join.body.error], [410, "room_expired"]);
  assert.equal((await t.store.getRoom(room.id)).status, "lobby", "nothing is rewritten: it is worked out on read");
});

test("a lobby someone joined doesn't close at the invite expiry (only when it never starts); the admin's settings change both", async () => {
  const t = await setup();
  const room = (await t.call("POST", "/rooms", "aoi", {})).body.room;
  const joined = (await t.call("POST", `/rooms/${room.id}/join`, "ren", {})).body.room;
  assert.equal(joined.expiresAt, new Date(t.now() + 120 * 60 * 1000).toISOString(), "only the 2-hour lobby limit is left");
  t.tick(90 * 60 * 1000);
  assert.equal((await t.call("GET", `/rooms/${room.id}`, "aoi")).body.room.status, "lobby");
  await t.call("POST", `/rooms/${room.id}/leave`, "ren", {});
  const left = (await t.call("GET", `/rooms/${room.id}`, "aoi")).body.room;
  assert.equal(left.status, "lobby", "a friend who joined and left still counts as joined");
  assert.equal((await t.call("POST", `/rooms/${room.id}/join`, "ren", {})).status, 200, "and can come back");

  t.tick(31 * 60 * 1000);   // 121 minutes: the lobby never started
  const idle = (await t.call("GET", `/rooms/${room.id}`, "aoi")).body.room;
  assert.deepEqual([idle.status, idle.closedReason], ["closed", "idle"]);
  const late = await t.call("POST", `/rooms/${room.id}/join`, "sora", {});
  assert.deepEqual([late.status, late.body.error], [410, "room_expired"]);

  await t.store.putSettings({ values: { "rooms.inviteExpiryMinutes": 10, "rooms.lobbyMaxMinutes": 30 } });
  t.tick(61 * 1000);   // past the settings cache
  const short = (await t.call("POST", "/rooms", "sora", {})).body.room;
  assert.equal(short.expiresAt, new Date(t.now() + 10 * 60 * 1000).toISOString());
  t.tick(11 * 60 * 1000);
  assert.equal((await t.call("GET", `/rooms/${short.id}`, "sora")).body.room.closedReason, "expired");
});

test("each invite runs out on its own: the friend's list drops it, the room stays", async () => {
  const t = await setup();
  const room = (await t.call("POST", "/rooms", "aoi", {})).body.room;
  await t.call("POST", `/rooms/${room.id}/join`, "ren", {});          // the room is in use
  await t.call("POST", `/rooms/${room.id}/invite`, "aoi", { tag: t.users.sora.tag });
  t.tick(59 * 60 * 1000);
  assert.equal((await t.call("GET", "/rooms", "sora")).body.invites, 1);
  t.tick(2 * 60 * 1000);
  assert.equal((await t.call("GET", "/rooms", "sora")).body.invites, 0, "Sora's invite ran out");
  assert.equal((await t.call("GET", `/rooms/${room.id}`, "sora")).status, 404, "and the room is no longer Sora's to see");
  const v = (await t.store.getRoom(room.id)).version;
  const polled = (await t.call("GET", `/rooms/${room.id}`, "aoi", undefined, { v: String(v) })).body;
  assert.equal(polled.changed, true, "the lobby polling with ?v= hears that the invite ran out");
  const host = polled.room;
  assert.deepEqual([host.status, host.invited.length, host.players.length], ["lobby", 0, 2]);
  assert.equal((await t.store.getRoom(room.id)).invited.length, 0, "swept out for good");
  const next = (await t.call("GET", `/rooms/${room.id}`, "aoi", undefined, { v: String(host.version) })).body;
  assert.equal(next.changed, false, "and quiet again after that");

  // Inviting again starts a fresh hour.
  await t.call("POST", `/rooms/${room.id}/invite`, "aoi", { tag: t.users.sora.tag });
  assert.equal((await t.call("GET", "/rooms", "sora")).body.invites, 1);
  assert.equal((await t.store.getRoom(room.id)).invited.length, 1, "the old invite was swept out");
});

test("invites from before invite times existed count from the room's creation", async () => {
  const t = await setup();
  const room = (await t.call("POST", "/rooms", "aoi", {})).body.room;
  await t.call("POST", `/rooms/${room.id}/join`, "ren", {});
  const stored = await t.store.getRoom(room.id);
  stored.invited.push({ uid: "c2c2c2c2c2c2c2c2", name: "SORA", tag: t.users.sora.tag });   // no "at"
  await t.store.saveRoom(stored, stored.version, [{ uid: "c2c2c2c2c2c2c2c2", roomId: room.id, key: stored.key, ttl: stored.ttl }]);
  assert.equal((await t.call("GET", "/rooms", "sora")).body.invites, 1);
  t.tick(61 * 60 * 1000);
  assert.equal((await t.call("GET", "/rooms", "sora")).body.invites, 0);
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
