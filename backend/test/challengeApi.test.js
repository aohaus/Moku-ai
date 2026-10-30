// "Same puzzle" challenges (src/challengeApi.js) on the in-memory store. No AWS needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createChallengeApi } = require("../src/challengeApi");
const { createMemoryStore } = require("../src/memoryStore");
const token = require("../src/token");

const SECRET = "test-secret-test-secret-test-secret-00";

async function setup() {
  let clock = Date.parse("2026-10-30T00:00:00Z");
  let ids = 0;
  const store = createMemoryStore();
  const api = createChallengeApi(store, {
    authSecret: SECRET,
    now: () => clock,
    newId: () => String(++ids).padStart(16, "0"),
    seed: () => "SEED" + ids,
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
  async function call(method, rawPath, who, body) {
    const res = await api({
      requestContext: { http: { method } },
      rawPath,
      headers: who ? { authorization: `Bearer ${users[who].token}` } : {},
      body: body === undefined ? "" : JSON.stringify(body),
    });
    return { status: res.statusCode, body: JSON.parse(res.body) };
  }
  return { store, users, call, tick: (ms) => (clock += ms) };
}

async function newChallenge(t, from = "aoi", to = "ren", steps) {
  const r = await t.call("POST", "/challenges", from, { game: "moku-bridge", opponentTag: t.users[to].tag, ...(steps ? { steps } : {}) });
  assert.equal(r.status, 201);
  return r.body.challenge;
}

test("challenges need a login, a real friend and a known game", async () => {
  const t = await setup();
  assert.equal((await t.call("GET", "/challenges")).status, 401);
  assert.equal((await t.call("POST", "/challenges", "aoi", { game: "moku-bridge", opponentTag: "u99999" })).status, 404);
  assert.equal((await t.call("POST", "/challenges", "aoi", { game: "moku-bridge", opponentTag: t.users.aoi.tag })).body.error, "invalid_opponent");
  assert.equal((await t.call("POST", "/challenges", "aoi", { game: "moku-bridge", opponentTag: t.users.admin.tag })).status, 404);
  assert.equal((await t.call("POST", "/challenges", "aoi", { game: "moku-chess", opponentTag: t.users.ren.tag })).body.error, "invalid_game");
  assert.equal((await t.call("POST", "/challenges", "aoi", { game: "moku-bridge", opponentTag: t.users.ren.tag, steps: 12 })).body.error, "invalid_params");
});

test("both players get the same bridge (seed and steps from the server)", async () => {
  const t = await setup();
  const c = await newChallenge(t, "aoi", "ren", 10);
  assert.equal(c.seed, "SEED1");
  assert.deepEqual(c.params, { steps: 10 });
  assert.deepEqual([c.you, c.yourTurn, c.status], ["from", true, "open"]);
  assert.deepEqual(c.opponent, { name: "REN", tag: t.users.ren.tag });
  const ren = (await t.call("GET", `/challenges/${c.id}`, "ren")).body.challenge;
  assert.deepEqual([ren.seed, ren.params.steps, ren.you, ren.yourTurn], ["SEED1", 10, "to", true]);
  assert.equal((await t.call("GET", `/challenges/${c.id}`, "sora")).status, 404, "only the two players");
  const list = (await t.call("GET", "/challenges", "ren")).body;
  assert.equal(list.yourTurn, 1);
  assert.equal(list.challenges[0].seed, undefined, "the list doesn't hand out the bridge");
  const raw = JSON.stringify([c, ren, list]);
  for (const secret of ["a0a0a0a0a0a0a0a0", "b1b1b1b1b1b1b1b1", '"aoi"', '"ren"']) assert.ok(!raw.includes(secret), secret);
});

test("fewer falls wins; the friend's result stays hidden until you play", async () => {
  const t = await setup();
  const c = await newChallenge(t);
  const mine = await t.call("POST", `/challenges/${c.id}/result`, "aoi", { result: { falls: 3 } });
  assert.deepEqual([mine.body.challenge.status, mine.body.challenge.yourTurn, mine.body.challenge.theyPlayed], ["open", false, false]);

  const renBefore = (await t.call("GET", `/challenges/${c.id}`, "ren")).body.challenge;
  assert.equal(renBefore.theirResult, null, "Aoi's falls are hidden from Ren");
  assert.equal(renBefore.theyPlayed, true);

  const ren = await t.call("POST", `/challenges/${c.id}/result`, "ren", { result: { falls: 1 } });
  assert.deepEqual([ren.body.challenge.status, ren.body.challenge.winner], ["done", "you"]);
  assert.deepEqual(ren.body.challenge.theirResult, { falls: 3 });
  const aoi = (await t.call("GET", `/challenges/${c.id}`, "aoi")).body.challenge;
  assert.deepEqual([aoi.winner, aoi.theirResult.falls, aoi.yourResult.falls], ["them", 1, 3]);
  const row = (await t.call("GET", "/challenges", "aoi")).body.challenges[0];
  assert.deepEqual([row.status, row.winner], ["done", "them"]);

  assert.equal((await t.call("POST", `/challenges/${c.id}/result`, "aoi", { result: { falls: 0 } })).body.error, "already_played");
});

test("the same falls is a tie; bad results are refused", async () => {
  const t = await setup();
  const c = await newChallenge(t);
  for (const bad of [{}, { falls: -1 }, { falls: 1.5 }, { falls: 100 }, { falls: "2" }]) {
    assert.equal((await t.call("POST", `/challenges/${c.id}/result`, "aoi", { result: bad })).body.error, "invalid_result");
  }
  await t.call("POST", `/challenges/${c.id}/result`, "aoi", { result: { falls: 2 } });
  const r = await t.call("POST", `/challenges/${c.id}/result`, "ren", { result: { falls: 2 } });
  assert.equal(r.body.challenge.winner, "tie");
});

test("both results at the same moment: neither is lost", async () => {
  const t = await setup();
  const c = await newChallenge(t);
  const realGet = t.store.getChallenge;
  let raced = false;
  t.store.getChallenge = async (id) => {
    const snapshot = await realGet(id);
    if (!raced) {
      raced = true;
      await t.call("POST", `/challenges/${c.id}/result`, "ren", { result: { falls: 4 } });
    }
    return snapshot;
  };
  const r = await t.call("POST", `/challenges/${c.id}/result`, "aoi", { result: { falls: 2 } });
  t.store.getChallenge = realGet;
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.challenge.status, r.body.challenge.winner, r.body.challenge.theirResult.falls], ["done", "you", 4]);
});

test("challenges expire two weeks after the last change", async () => {
  const t = await setup();
  const c = await newChallenge(t);
  t.tick(14 * 86400 * 1000 + 1000);
  assert.equal((await t.call("GET", `/challenges/${c.id}`, "ren")).status, 404);
  assert.equal((await t.call("POST", `/challenges/${c.id}/result`, "ren", { result: { falls: 0 } })).status, 404);
});

test("one player can't have more than 20 open challenges", async () => {
  const t = await setup();
  for (let i = 0; i < 20; i++) await newChallenge(t);
  assert.equal((await t.call("POST", "/challenges", "aoi", { game: "moku-bridge", opponentTag: t.users.sora.tag })).body.error, "too_many_challenges");
  assert.equal((await t.call("POST", "/challenges", "sora", { game: "moku-bridge", opponentTag: t.users.ren.tag })).body.error, "opponent_busy");
});
