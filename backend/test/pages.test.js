// Checks on the game pages at the repo root (not the backend itself).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");

// "🦉 Moku Series ▶" (#hub-link, SPEC.md §4) goes to the game list (hub.html),
// not index.html: for someone logged in that is the "Welcome back" entrance
// page, which felt like landing on a title screen (2026-11-21).
test("pages: every #hub-link goes to hub.html", () => {
  const wrong = [];
  for (const file of fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const m of html.matchAll(/<a\b[^>]*\bid="hub-link"[^>]*>/g)) {
      const href = /\bhref="([^"]*)"/.exec(m[0]);
      if (!href || href[1] !== "hub.html") wrong.push(`${file}: ${m[0]}`);
    }
  }
  assert.deepEqual(wrong, []);
});

// Offline mode (SPEC.md §16): sw.js reads the pack that moku-account.js
// fills, so both must use the same cache name.
test("pages: the offline pack has the same cache name in sw.js and moku-account.js", () => {
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const account = fs.readFileSync(path.join(ROOT, "shared", "moku-account.js"), "utf8");
  const name = (text) => (/OFFLINE_CACHE\s*=\s*'([^']+)'/.exec(text) || [])[1];
  assert.ok(name(sw), "sw.js has OFFLINE_CACHE");
  assert.equal(name(account), name(sw));
});
