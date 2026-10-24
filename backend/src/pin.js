const crypto = require("crypto");

// PINs are short (4–6 digits), so the hash is only one layer of defence —
// the real protection is the per-account lockout in accountApi.js.
// scrypt N=2^14 needs ~16 MB, well within the Lambda's memory.
const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 32;

function scrypt(pin, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(pin, salt, KEY_LEN, SCRYPT, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pin, salt);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function verifyPin(pin, stored) {
  const [scheme, saltB64, keyB64] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const key = await scrypt(pin, Buffer.from(saltB64, "base64"));
  const expected = Buffer.from(keyB64, "base64");
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

// Burn the same CPU as a real check so "no such ID" and "wrong PIN" take
// the same time and can't be told apart.
const DUMMY_HASH = "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
async function burnPinCheck(pin) {
  await verifyPin(pin, DUMMY_HASH);
  return false;
}

// Reject PINs a sibling would guess first: one repeated digit or a straight run.
function isWeakPin(pin) {
  if (/^(\d)\1+$/.test(pin)) return true;
  const up = "01234567890123";
  const down = "98765432109876";
  return up.includes(pin) || down.includes(pin);
}

module.exports = { hashPin, verifyPin, burnPinCheck, isWeakPin };
