// Dev-only mock of the accounts API for `npm run dev` (server.js).
// Runs the real handler (src/accountApi.js) on an in-memory store, so the
// login UI in shared/moku-account.js works on http://localhost:3000 without
// AWS. Data is lost when the server restarts.
//
// Invite code: "moku-dev" (override with MOKU_INVITE_CODE).

const { createAccountApi } = require("../src/accountApi");
const { createMemoryStore } = require("../src/memoryStore");

module.exports = function mountDevAccounts(app) {
  const handler = createAccountApi(createMemoryStore(), {
    authSecret: "dev-only-secret-not-for-production-0000",
    inviteCode: process.env.MOKU_INVITE_CODE || "moku-dev",
    maxUsers: 100,
  });

  app.all(["/auth/:action", "/save"], async (req, res) => {
    const result = await handler({
      requestContext: { http: { method: req.method } },
      rawPath: req.path,
      headers: req.headers,
      body: req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : "",
    });
    res.status(result.statusCode).set(result.headers || {}).send(result.body);
  });
};
