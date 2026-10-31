// Moyomoyo Multiplayer rooms (src/roomApi.js + src/moyoParty.js) on the in-memory store.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createRoomApi } = require("../src/roomApi");
const { createMemoryStore } = require("../src/memoryStore");
const { RULES } = require("../src/moyoParty");
const token = require("../src/token");

const SECRET = "test-secret-test-secret-test-secret-00";
const BOARD = ".".repeat(80) + "0123grr..g";

async function setup() {
  let clock = Date.parse("2026-10-31T00:00:00Z");
  let keys = 0, codes = 0, seeds = 0;
  const store = createMemoryStore();
  const api = createRoomApi(store, {
    authSecret: SECRET,
    now: () => clock,
    newKey: () => String(++keys).padStart(16, "0"),
    code: () => "M" + "ABCDEFGH"[codes++ % 8] + "ZZ",
    newSeed: () => `seed${++seeds}`,
  });
  const users = {};
  for (const [loginId, uid] of [
    ["aoi", "a0a0a0a0a0a0a0a0"],
    ["ren", "b1b1b1b1b1b1b1b1"],
    ["sora", "c2c2c2c2c2c2c2c2"],
    ["mio", "e4e4e4e4e4e4e4e4"],
    ["kai", "f5f5f5f5f5f5f5f5"],
  ]) {
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

async function startedRoom(t, who = ["ren", "sora"]) {
  const room = (await t.call("POST", "/rooms", "aoi", { game: "moyomoyo" })).body.room;
  for (const w of who) await t.call("POST", `/rooms/${room.id}/join`, w, {});
  const started = await t.call("POST", `/rooms/${room.id}/start`, "aoi", {});
  assert.equal(started.status, 200);
  return started.body.room;
}
const post = (t, id, who, state) => t.call("POST", `/rooms/${id}/state`, who, { board: BOARD, attacks: [], ...state });

test("a Moyomoyo room: up to 4 players, its own lobby list, no riddles", async () => {
  const t = await setup();
  const made = await t.call("POST", "/rooms", "aoi", { game: "moyomoyo" });
  assert.equal(made.status, 201);
  const room = made.body.room;
  assert.equal(room.game, "moyomoyo");
  assert.equal(room.status, "lobby");
  assert.equal(room.rules.ROUNDS, 3);
  for (const w of ["ren", "sora", "mio"]) assert.equal((await t.call("POST", `/rooms/${room.id}/join`, w, {})).status, 200);
  const full = await t.call("POST", `/rooms/${room.id}/join`, "kai", {});
  assert.equal(full.status, 409);
  assert.equal(full.body.error, "room_full");

  // The Riddle Race page (no ?game=) doesn't see it; ?game=moyomoyo does.
  await t.call("POST", "/rooms", "ren", { count: 5 });
  const riddles = (await t.call("GET", "/rooms", "ren")).body.rooms;
  assert.deepEqual(riddles.map((r) => r.game), ["riddles"]);
  const moyos = (await t.call("GET", "/rooms", "ren", undefined, { game: "moyomoyo" })).body.rooms;
  assert.deepEqual(moyos.map((r) => r.id), [room.id]);
  assert.equal((await t.call("GET", "/rooms", "ren", undefined, { game: "chess" })).status, 400);
  assert.equal((await t.call("POST", "/rooms", "ren", { game: "chess" })).status, 400);

  const ans = await t.call("POST", `/rooms/${room.id}/answer`, "aoi", { q: 0, answer: "x" });
  assert.equal(ans.body.error, "wrong_game");
});

test("start: game 1 with a shared seed after a countdown", async () => {
  const t = await setup();
  const room = await startedRoom(t);
  assert.equal(room.status, "playing");
  assert.equal(room.round, 1);
  assert.equal(room.seed, "seed1");
  assert.equal(room.roundStartAt - room.now, RULES.COUNTDOWN_MS);
  assert.equal(room.states.length, 3);
  assert.ok(room.states.every((s) => s.alive && !s.out && s.score === 0));
});

test("boards and attacks reach the other players; bad states are refused", async () => {
  const t = await setup();
  const room = await startedRoom(t);
  t.tick(RULES.COUNTDOWN_MS + 1000);
  const ren = t.users.ren.tag, sora = t.users.sora.tag;
  const res = await post(t, room.id, "aoi", { r: 1, score: 120, alive: true, attacks: [{ id: 1, to: { [ren]: 3, [sora]: 2 } }] });
  assert.equal(res.status, 200);
  const seen = (await t.call("GET", `/rooms/${room.id}`, "ren")).body.room;
  const aoi = seen.states.find((s) => s.tag === t.users.aoi.tag);
  assert.equal(aoi.score, 120);
  assert.equal(aoi.board, BOARD);
  assert.deepEqual(aoi.attacks, [{ id: 1, to: { [ren]: 3, [sora]: 2 } }]);

  for (const bad of [
    { r: 1, score: -1, alive: true },
    { r: 1, score: 1, alive: "yes" },
    { r: 4, score: 1, alive: true },
    { r: 1, score: 1, alive: true, board: "xyz" },
    { r: 1, score: 1, alive: true, attacks: [{ id: 0, to: { [ren]: 1 } }] },
    { r: 1, score: 1, alive: true, attacks: [{ id: 2, to: { nobody: 1 } }] },
    { r: 1, score: 1, alive: true, attacks: [{ id: 2, to: { [ren]: 999 } }] },
  ]) {
    const r = await post(t, room.id, "aoi", bad);
    assert.equal(r.status, 400, JSON.stringify(bad));
  }
  // Someone who isn't in the room can't post.
  assert.equal((await post(t, room.id, "kai", { r: 1, score: 1, alive: true })).status, 404);
});

test("a board that topped out stays out; the last one standing ends the game", async () => {
  const t = await setup();
  const room = await startedRoom(t);
  t.tick(RULES.COUNTDOWN_MS + 5000);
  await post(t, room.id, "aoi", { r: 1, score: 300, alive: true });
  await post(t, room.id, "ren", { r: 1, score: 100, alive: false });
  const back = (await post(t, room.id, "ren", { r: 1, score: 150, alive: true })).body.room;
  assert.equal(back.states.find((s) => s.tag === t.users.ren.tag).alive, false);
  assert.equal(back.roundEndAt, null);

  t.tick(1000);
  const ended = (await post(t, room.id, "sora", { r: 1, score: 200, alive: false })).body.room;
  assert.ok(ended.roundEndAt);
  assert.equal(ended.round, 1);

  // Everyone sends a final score → scores saved, game 2 after the break.
  await post(t, room.id, "ren", { r: 1, score: 150, alive: false, final: true });
  await post(t, room.id, "sora", { r: 1, score: 200, alive: false, final: true });
  const next = (await post(t, room.id, "aoi", { r: 1, score: 310, alive: true, final: true })).body.room;
  assert.equal(next.round, 2);
  assert.equal(next.seed, "seed2");
  assert.equal(next.roundStartAt - next.now, RULES.INTERMISSION_MS);
  assert.deepEqual(next.results, [{ scores: { [t.users.aoi.tag]: 310, [t.users.ren.tag]: 150, [t.users.sora.tag]: 200 } }]);
  assert.deepEqual(next.standings.map((s) => [s.tag, s.total, s.rank]), [
    [t.users.aoi.tag, 310, 1], [t.users.sora.tag, 200, 2], [t.users.ren.tag, 150, 3],
  ]);
  // The last game's rows don't count for the new one.
  assert.ok(next.states.every((s) => s.alive && s.score === 0 && s.r === 2));
  // A final score after the game was saved changes nothing.
  await post(t, room.id, "ren", { r: 1, score: 9999, alive: false, final: true });
  assert.equal((await t.call("GET", `/rooms/${room.id}`, "aoi")).body.room.results[0].scores[t.users.ren.tag], 150);
});

test("a page that stops talking is out; scores wait for finals only a few seconds", async () => {
  const t = await setup();
  const room = await startedRoom(t, ["ren"]);
  t.tick(RULES.COUNTDOWN_MS + 2000);
  await post(t, room.id, "aoi", { r: 1, score: 50, alive: true });
  await post(t, room.id, "ren", { r: 1, score: 40, alive: true });
  // ren's phone goes quiet.
  for (let i = 0; i < 6; i++) {
    t.tick(2500);
    await post(t, room.id, "aoi", { r: 1, score: 60 + i, alive: true });
  }
  const now = (await t.call("GET", `/rooms/${room.id}`, "aoi")).body.room;
  assert.ok(now.roundEndAt, "ren went quiet, so aoi is the last one standing");
  assert.equal(now.states.find((s) => s.tag === t.users.ren.tag).out, true);
  // aoi never sends a final: the game is scored after the grace period anyway.
  t.tick(RULES.GRACE_MS + 1);
  const next = (await t.call("GET", `/rooms/${room.id}`, "aoi")).body.room;
  assert.equal(next.round, 2);
  assert.deepEqual(next.results[0].scores, { [t.users.aoi.tag]: 65, [t.users.ren.tag]: 40 });
});

test("time runs out: the game ends with everyone still playing", async () => {
  const t = await setup();
  const room = await startedRoom(t, ["ren"]);
  t.tick(RULES.COUNTDOWN_MS);
  for (let at = 0; at < RULES.ROUND_MS; at += 5000) {
    t.tick(5000);
    await post(t, room.id, "aoi", { r: 1, score: 10, alive: true });
    await post(t, room.id, "ren", { r: 1, score: 20, alive: true });
  }
  const res = (await t.call("GET", `/rooms/${room.id}`, "ren")).body.room;
  assert.ok(res.roundEndAt);
});

test("three games, then done: ranks by the total score, ties share a rank, again keeps the game", async () => {
  const t = await setup();
  const room = await startedRoom(t, ["ren", "sora", "mio"]);
  const scores = { aoi: [100, 100, 100], ren: [300, 0, 0], sora: [50, 50, 50], mio: [0, 0, 150] };
  let view = room;
  for (let g = 0; g < 3; g++) {
    t.tick(view.roundStartAt - view.now + 1000);
    for (const who of ["ren", "sora", "mio"]) await post(t, room.id, who, { r: g + 1, score: scores[who][g], alive: false, final: true });
    view = (await post(t, room.id, "aoi", { r: g + 1, score: scores.aoi[g], alive: true, final: true })).body.room;
    if (g < 2) {
      // the round ended on aoi's post; the next post scores it
      view = (await post(t, room.id, "aoi", { r: g + 1, score: scores.aoi[g], alive: true, final: true })).body.room;
      assert.equal(view.round, g + 2);
    }
  }
  if (view.status !== "done") view = (await t.call("GET", `/rooms/${room.id}`, "aoi")).body.room;
  assert.equal(view.status, "done");
  assert.equal(view.seed, null);
  assert.deepEqual(view.standings.map((s) => [s.name, s.total, s.rank]), [
    ["AOI", 300, 1], ["REN", 300, 1], ["SORA", 150, 3], ["MIO", 150, 3],
  ]);
  assert.deepEqual(view.standings[0].games, [100, 100, 100]);
  // Finished rooms leave the lobby list.
  assert.equal((await t.call("GET", "/rooms", "ren", undefined, { game: "moyomoyo" })).body.rooms.length, 0);

  const again = await t.call("POST", `/rooms/${room.id}/again`, "aoi", {});
  assert.equal(again.status, 201);
  assert.equal(again.body.room.game, "moyomoyo");
  assert.equal(again.body.room.status, "lobby");
  assert.equal(again.body.room.players.length, 4);
});
