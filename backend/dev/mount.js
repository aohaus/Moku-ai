// Dev-only mock of the accounts API for `npm run dev` (server.js).
// Runs the real handler (src/accountApi.js) on an in-memory store, so the
// login UI in shared/moku-account.js works on http://localhost:3000 without
// AWS. Data is lost when the server restarts.
//
// Invite code: "moku-dev" (override with MOKU_INVITE_CODE).
// Dev-only admin for admin.html: ID "admin", PIN "1357" (not the real one).

const { createAccountApi } = require("../src/accountApi");
const { createMemoryStore } = require("../src/memoryStore");

module.exports = function mountDevAccounts(app) {
  const store = createMemoryStore();
  store.createUser(
    {
      loginId: "admin", uid: "ad000000dev00000", displayName: "Admin", role: "admin",
      pinHash: "", tv: 1, failCount: 0, lockedUntil: 0, lastSeenAt: 0, createdAt: new Date().toISOString(),
    },
    0,
    { uncounted: true }
  );
  require("../src/pin").hashPin("1357").then((h) => store.updateUser("admin", { pinHash: h }));
  const handler = createAccountApi(store, {
    authSecret: "dev-only-secret-not-for-production-0000",
    inviteCode: process.env.MOKU_INVITE_CODE || "moku-dev",
    maxUsers: 100,
  });

  app.all(["/auth/:action", "/save", "/players", "/admin/users", "/admin/users/:loginId", "/admin/logs"], async (req, res) => {
    const result = await handler({
      requestContext: { http: { method: req.method } },
      rawPath: req.path,
      queryStringParameters: req.query,
      headers: req.headers,
      body: req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : "",
    });
    res.status(result.statusCode).set(result.headers || {}).send(result.body);
  });
};
