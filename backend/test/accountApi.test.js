// Run: node --test backend/test   (no AWS needed — uses the in-memory store)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createAccountApi } = require("../src/accountApi");
const { createMemoryStore } = require("../src/memoryStore");
const token = require("../src/token");

const SECRET = "test-secret-test-secret-test-secret-00";

function setup({ maxUsers = 100 } = {}) {
  let clock = Date.parse("2026-10-24T00:00:00Z");
  const api = createAccountApi(createMemoryStore(), {
    authSecret: SECRET,
    inviteCode: "owl-invite",
    maxUsers,
    now: () => clock,
  });
  const call = async (method, path, body, tok) => {
    const res = await api({
      requestContext: { http: { method } },
      rawPath: path,
      headers: tok ? { authorization: `Bearer ${tok}` } : {},
      body: body ? JSON.stringify(body) : "",
    });
    return { status: res.statusCode, body: JSON.parse(res.body) };
  };
  const register = (loginId, pin = "2580", extra = {}) =>
    call("POST", "/auth/register", { inviteCode: "owl-invite", loginId, pin, displayName: "Aoi", ...extra });
  return { call, register, advance: (ms) => (clock += ms) };
}

test("register → login → me", async () => {
  const { call, register } = setup();
  const r = await register("Aoi_01");
  assert.equal(r.status, 201);
  assert.equal(r.body.user.loginId, "aoi_01");
  assert.match(r.body.user.tag, /^u[0-9a-f]{5}$/);

  const l = await call("POST", "/auth/login", { loginId: "AOI_01", pin: "2580" });
  assert.equal(l.status, 200);
  const me = await call("GET", "/auth/me", null, l.body.token);
  assert.deepEqual(me.body.user, r.body.user);
});

test("sign-up needs the invite code, a free ID and room", async () => {
  const { register } = setup({ maxUsers: 2 });
  assert.equal((await register("aoi", "2580", { inviteCode: "nope" })).body.error, "bad_invite");
  assert.equal((await register("aoi", "1111")).body.error, "weak_pin");
  assert.equal((await register("aoi", "123456")).body.error, "weak_pin");
  assert.equal((await register("a")).body.error, "invalid_login_id");
  assert.equal((await register("aoi")).status, 201);
  assert.equal((await register("AOI")).body.error, "id_taken");
  assert.equal((await register("ren")).status, 201);
  assert.equal((await register("mio")).body.error, "full");
});

test("display name is cleaned for leaderboards", async () => {
  const { register } = setup();
  const r = await register("aoi", "2580", { displayName: "  A#o*i|/\\ the great owl " });
  assert.equal(r.body.user.displayName, "Aoi the grea");
});

test("wrong PINs lock the account, and the lock expires", async () => {
  const { call, register, advance } = setup();
  await register("aoi");
  for (let i = 0; i < 4; i++) {
    assert.equal((await call("POST", "/auth/login", { loginId: "aoi", pin: "9999" })).status, 401);
  }
  const fifth = await call("POST", "/auth/login", { loginId: "aoi", pin: "9999" });
  assert.equal(fifth.body.error, "locked");
  assert.equal(fifth.body.retryAfterSec, 15 * 60);
  // Even the right PIN is refused while locked.
  assert.equal((await call("POST", "/auth/login", { loginId: "aoi", pin: "2580" })).body.error, "locked");
  advance(15 * 60 * 1000 + 1);
  assert.equal((await call("POST", "/auth/login", { loginId: "aoi", pin: "2580" })).status, 200);
});

test("unknown ID and wrong PIN look the same", async () => {
  const { call, register } = setup();
  await register("aoi");
  const a = await call("POST", "/auth/login", { loginId: "nobody", pin: "2580" });
  const b = await call("POST", "/auth/login", { loginId: "aoi", pin: "0000" });
  assert.deepEqual(a, b);
});

test("cloud save uses revisions to catch conflicts", async () => {
  const { call, register } = setup();
  const tok = (await register("aoi")).body.token;
  assert.deepEqual((await call("GET", "/save", null, tok)).body, { save: null });

  const p1 = await call("PUT", "/save", { data: { "moku:x": "1" }, baseRev: 0, device: "iPad" }, tok);
  assert.equal(p1.body.rev, 1);
  const p2 = await call("PUT", "/save", { data: { "moku:x": "2" }, baseRev: 1 }, tok);
  assert.equal(p2.body.rev, 2);
  // A device still on rev 1 must not overwrite rev 2.
  const stale = await call("PUT", "/save", { data: { "moku:x": "old" }, baseRev: 1 }, tok);
  assert.equal(stale.status, 409);
  assert.equal(stale.body.rev, 2);

  const g = await call("GET", "/save", null, tok);
  assert.deepEqual(g.body.save.data, { "moku:x": "2" });
  assert.equal(g.body.save.rev, 2);

  assert.equal((await call("PUT", "/save", { data: { k: 5 }, baseRev: 2 }, tok)).status, 400);
  const big = { k: "x".repeat(301 * 1024) };
  assert.equal((await call("PUT", "/save", { data: big, baseRev: 2 }, tok)).status, 413);
});

test("save endpoints need a valid token", async () => {
  const { call, register } = setup();
  const tok = (await register("aoi")).body.token;
  assert.equal((await call("GET", "/save")).status, 401);
  assert.equal((await call("GET", "/save", null, tok + "x")).status, 401);
  const forged = token.sign({ lid: "aoi", uid: "x", name: "Aoi", tv: 1 }, "another-secret-another-secret-0000");
  assert.equal((await call("GET", "/save", null, forged)).status, 401);
});

test("changing the PIN logs out other devices", async () => {
  const { call, register } = setup();
  const oldTok = (await register("aoi")).body.token;
  const bad = await call("POST", "/auth/pin", { currentPin: "0000", newPin: "4826" }, oldTok);
  assert.equal(bad.status, 401);
  const ok = await call("POST", "/auth/pin", { currentPin: "2580", newPin: "4826" }, oldTok);
  assert.equal(ok.status, 200);
  assert.equal((await call("GET", "/auth/me", null, oldTok)).status, 401);
  assert.equal((await call("GET", "/auth/me", null, ok.body.token)).status, 200);
  assert.equal((await call("POST", "/auth/login", { loginId: "aoi", pin: "4826" })).status, 200);
});

test("tokens expire", () => {
  const t0 = Date.now();
  const t = token.sign({ lid: "aoi" }, SECRET, t0);
  assert.equal(token.verify(t, SECRET, t0 + 1000).lid, "aoi");
  assert.equal(token.verify(t, SECRET, t0 + (token.TOKEN_TTL_SEC + 1) * 1000), null);
});

test("players list: public names only, newest first, online within 5 min", async () => {
  const { call, register, advance } = setup();
  const aoi = (await register("aoi", "2580", { displayName: "Aoi" })).body.token;
  advance(10 * 60 * 1000);
  const ren = (await register("ren", "4826", { displayName: "Ren" })).body.token;

  assert.equal((await call("GET", "/players")).status, 401);
  const res = await call("GET", "/players", null, ren);
  assert.equal(res.status, 200);
  const [first, second] = res.body.players;
  assert.equal(first.displayName, "Ren");
  assert.equal(first.you, true);
  assert.equal(first.online, true);
  assert.equal(second.displayName, "Aoi");
  assert.equal(second.online, false); // last seen 10 min ago
  assert.equal(second.you, false);
  for (const p of res.body.players) {
    assert.deepEqual(Object.keys(p).sort(), ["displayName", "lastSeenAt", "online", "tag", "you"]);
  }

  // Any authenticated call counts as being seen.
  await call("GET", "/auth/me", null, aoi);
  const again = (await call("GET", "/players", null, ren)).body.players;
  assert.equal(again[0].displayName, "Aoi");
  assert.equal(again[0].online, true);
});
