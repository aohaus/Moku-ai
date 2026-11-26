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

test("pages: sw.js and moku-account.js use the same Offline Mode markers", () => {
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const account = fs.readFileSync(path.join(ROOT, "shared", "moku-account.js"), "utf8");
  for (const marker of ["__moku-offline-pack__", "__moku-offline-mode__"]) {
    assert.ok(sw.includes(marker), `sw.js has ${marker}`);
    assert.ok(account.includes(marker), `moku-account.js has ${marker}`);
  }
  // moku-gate.js and moku-errors.js read the switch from the same localStorage key.
  for (const f of ["shared/moku-account.js", "shared/moku-gate.js", "shared/moku-errors.js"]) {
    assert.ok(fs.readFileSync(path.join(ROOT, f), "utf8").includes("mokuhub:offline-mode"), `${f} reads mokuhub:offline-mode`);
  }
});

// The double-line frame around title screens (#title-frame) is hidden on every
// game (2026-11-26, a parent asked). The Classic pages stay frozen as they were.
test("pages: #title-frame is hidden on every game except the Classic pages", () => {
  const shown = [];
  for (const file of fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && !f.endsWith("-classic.html"))) {
    const html = fs.readFileSync(path.join(ROOT, file), "utf8");
    if (!html.includes('id="title-frame"')) continue;
    if (!/#title-frame\s*\{\s*display:\s*none\s*!important;?\s*\}/.test(html)) shown.push(file);
  }
  assert.deepEqual(shown, []);
});
