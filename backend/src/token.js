const crypto = require("crypto");

// Session tokens: base64url(JSON payload) + "." + base64url(HMAC-SHA256).
// Same idea as a JWT (HS256) without the header, so no library is needed.
// dreamlo-proxy/src/proxy.js carries a copy of verify() — keep the two in sync.

const TOKEN_TTL_SEC = 90 * 24 * 60 * 60; // kids rarely log out; 90 days per device

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function sign(payload, secret, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const body = b64url(JSON.stringify({ ...payload, iat, exp: iat + TOKEN_TTL_SEC }));
  const mac = crypto.createHmac("sha256", secret).update(body).digest();
  return `${body}.${b64url(mac)}`;
}

// Returns the payload, or null if the token is malformed, forged or expired.
function verify(token, secret, now = Date.now()) {
  if (typeof token !== "string" || !secret) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = crypto.createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || payload.exp * 1000 <= now) return null;
  return payload;
}

module.exports = { sign, verify, TOKEN_TTL_SEC };
