// Online matches (src/matchApi.js) on the in-memory store. No AWS needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createMatchApi } = require("../src/matchApi");
const { createMemoryStore } = require("../src/memoryStore");
const token = require("../src/token");

const SECRET = "test-secret-test-secret-test-secret-00";

async function setup() {
  let clock = Date.parse("2026-10-30T00:00:00Z");
  let ids = 0;
  const store = createMemoryStore();
  const api = createMatchApi(store, {
    authSecret: SECRET,
    now: () => clock,
    newId: () => String(++ids).padStart(16, "0"),
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
    users[loginId] = { ...user, tag: `u${uid.slice(0, 5)}`, token: token.sign({ lid: loginId, uid, name: user.displayName, tv: 1 }, SECRET, clock) };
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
  return { api, store, users, call, tick: (ms) => (clock += ms) };
}

// White = aoi, black = ren (aoi picks white).
async function newGame(t) {
  const r = await t.call("POST", "/matches", "aoi", { game: "moku-chess", opponentTag: t.users.ren.tag, color: "white" });
  assert.equal(r.status, 201);
  return r.body.match;
}

test("the server keeps an exact copy of the shared chess rules", () => {
  const shared = fs.readFileSync(path.join(__dirname, "../../shared/moku-chess-rules.js"), "utf8");
  const vendor = fs.readFileSync(path.join(__dirname, "../src/vendor/moku-chess-rules.js"), "utf8");
  assert.ok(shared === vendor, "backend/src/vendor/moku-chess-rules.js differs: cp shared/moku-chess-rules.js backend/src/vendor/");
});

test("matches need a login and a real friend", async () => {
  const t = await setup();
  assert.equal((await t.call("GET", "/matches")).status, 401);
  assert.equal((await t.call("POST", "/matches", "aoi", { game: "moku-chess", opponentTag: "u99999" })).status, 404);
  assert.equal((await t.call("POST", "/matches", "aoi", { game: "moku-chess", opponentTag: t.users.aoi.tag })).body.error, "invalid_opponent");
  assert.equal((await t.call("POST", "/matches", "aoi", { game: "moku-chess", opponentTag: t.users.admin.tag })).status, 404, "the admin is hidden");
  assert.equal((await t.call("POST", "/matches", "aoi", { game: "moku-kart", opponentTag: t.users.ren.tag })).body.error, "invalid_game");
  assert.equal((await t.call("POST", "/matches", "aoi", { game: "moku-chess", opponentTag: t.users.ren.tag, color: "green" })).status, 400);
  assert.equal((await t.call("DELETE", "/matches", "aoi")).status, 404);
});

test("a new match shows up for both players, with no Player IDs or uids", async () => {
  const t = await setup();
  const m = await newGame(t);
  assert.equal(m.you, "w");
  assert.equal(m.yourTurn, true);
  assert.deepEqual(m.white, { name: "AOI", tag: t.users.aoi.tag });
  assert.deepEqual(m.black, { name: "REN", tag: t.users.ren.tag });
  assert.equal(m.version, 0);
  assert.equal(m.fen, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

  const ren = await t.call("GET", "/matches", "ren");
  assert.equal(ren.body.matches.length, 1);
  assert.deepEqual(
    { you: ren.body.matches[0].you, yourTurn: ren.body.matches[0].yourTurn, opponent: ren.body.matches[0].opponent },
    { you: "b", yourTurn: false, opponent: { name: "AOI", tag: t.users.aoi.tag } }
  );
  assert.equal((await t.call("GET", "/matches", "aoi")).body.yourTurn, 1);

  const raw = JSON.stringify([m, ren.body, (await t.call("GET", `/matches/${m.id}`, "ren")).body]);
  for (const secret of ["aoi\"", "ren\"", "a0a0a0a0a0a0a0a0", "b1b1b1b1b1b1b1b1"]) assert.ok(!raw.includes(secret), secret);

  // Only the two players can see it.
  assert.equal((await t.call("GET", `/matches/${m.id}`, "sora")).status, 404);
  assert.equal((await t.call("GET", "/matches/nope", "aoi")).status, 404);
});

test("polling: an unchanged match answers with changed:false", async () => {
  const t = await setup();
  const m = await newGame(t);
  assert.deepEqual((await t.call("GET", `/matches/${m.id}`, "ren", undefined, { v: "0" })).body, { changed: false, version: 0 });
  await t.call("POST", `/matches/${m.id}/move`, "aoi", { move: "e2e4", version: 0 });
  const r = await t.call("GET", `/matches/${m.id}`, "ren", undefined, { v: "0" });
  assert.equal(r.body.changed, true);
  assert.deepEqual(r.body.match.moves, ["e2e4"]);
  assert.equal(r.body.match.yourTurn, true);
});

test("moves: only yours, only legal, only on the latest version", async () => {
  const t = await setup();
  const m = await newGame(t);
  const move = (who, mv, version) => t.call("POST", `/matches/${m.id}/move`, who, { move: mv, version });

  assert.equal((await move("ren", "e7e5", 0)).body.error, "not_your_turn");
  assert.equal((await move("sora", "e2e4", 0)).status, 404, "not a player");
  assert.equal((await move("aoi", "e2e5", 0)).body.error, "illegal_move");
  assert.equal((await move("aoi", "E2E4", 0)).body.error, "invalid_move");
  assert.equal((await t.call("POST", `/matches/${m.id}/move`, "aoi", { move: "e2e4" })).body.error, "invalid_version");

  const ok = await move("aoi", "e2e4", 0);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.match.version, 1);
  assert.equal(ok.body.match.turn, "b");
  assert.equal(ok.body.match.yourTurn, false);

  // A double tap (same version again) gets the game as it is now.
  const again = await move("aoi", "d2d4", 0);
  assert.equal(again.status, 409);
  assert.equal(again.body.error, "version_conflict");
  assert.deepEqual(again.body.match.moves, ["e2e4"]);
});

test("a move that loses a race to another write comes back as a conflict", async () => {
  const t = await setup();
  const m = await newGame(t);
  // The page read version 0, but another device's move lands between the read and the write.
  const realGet = t.store.getMatch;
  let raced = false;
  t.store.getMatch = async (id) => {
    const snapshot = await realGet(id);
    if (!raced) {
      raced = true;
      const moved = { ...snapshot, moves: ["d2d4"], version: 1, turn: "b" };
      await t.store.saveMatch(moved, 0, []);
    }
    return snapshot;
  };
  const r = await t.call("POST", `/matches/${m.id}/move`, "aoi", { move: "e2e4", version: 0 });
  t.store.getMatch = realGet;
  assert.equal(r.status, 409);
  assert.equal(r.body.error, "version_conflict");
  assert.deepEqual(r.body.match.moves, ["d2d4"]);
});

test("checkmate ends the match for both players", async () => {
  const t = await setup();
  const m = await newGame(t);
  const seq = [["aoi", "f2f3"], ["ren", "e7e5"], ["aoi", "g2g4"], ["ren", "d8h4"]];
  let last;
  for (let i = 0; i < seq.length; i++) last = await t.call("POST", `/matches/${m.id}/move`, seq[i][0], { move: seq[i][1], version: i });
  assert.equal(last.status, 200);
  assert.equal(last.body.match.status, "finished");
  assert.equal(last.body.match.result, "black");
  assert.equal(last.body.match.endReason, "checkmate");
  assert.equal(last.body.match.yourTurn, false);

  const after = await t.call("POST", `/matches/${m.id}/move`, "aoi", { move: "a2a3", version: 4 });
  assert.equal(after.body.error, "match_over");
  const list = (await t.call("GET", "/matches", "aoi")).body;
  assert.equal(list.matches[0].status, "finished");
  assert.equal(list.matches[0].result, "black");
  assert.equal(list.yourTurn, 0);
});

test("a draw by repetition ends the match", async () => {
  const t = await setup();
  const m = await newGame(t);
  const knights = ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"];
  let last;
  for (let i = 0; i < knights.length; i++) {
    last = await t.call("POST", `/matches/${m.id}/move`, i % 2 ? "ren" : "aoi", { move: knights[i], version: i });
  }
  assert.deepEqual([last.body.match.status, last.body.match.result, last.body.match.endReason], ["finished", "draw", "repetition"]);
});

test("matches expire a week after the last move (a month once finished)", async () => {
  const t = await setup();
  const m = await newGame(t);
  const stored = await t.store.getMatch(m.id);
  assert.equal(stored.ttl, Math.floor(Date.parse("2026-10-30T00:00:00Z") / 1000) + 7 * 86400);
  t.tick(3600 * 1000);
  await t.call("POST", `/matches/${m.id}/move`, "aoi", { move: "e2e4", version: 0 });
  assert.equal((await t.store.getMatch(m.id)).ttl, stored.ttl + 3600);
});

test("one player can't have more than 20 games going", async () => {
  const t = await setup();
  for (let i = 0; i < 20; i++) await newGame(t);
  const r = await t.call("POST", "/matches", "aoi", { game: "moku-chess", opponentTag: t.users.sora.tag });
  assert.equal(r.body.error, "too_many_matches");
  const busy = await t.call("POST", "/matches", "sora", { game: "moku-chess", opponentTag: t.users.ren.tag });
  assert.equal(busy.body.error, "opponent_busy");
});
