/**
 * Moku Series — shared leaderboard client.
 *
 * Usage:
 *   MokuScores.configure({
 *     proxyBaseUrl: "https://xxxx.execute-api.<region>.amazonaws.com/default/moku-dreamlo-proxy",
 *     gameId: "angry-moku-battle-royal",
 *   });
 *   await MokuScores.submit(score, { playerName: "Moku", level: 5 });
 *   const ranking = await MokuScores.fetchTop(20);
 *
 * Design notes (see SPEC.md §6):
 * - Guests are identified by a per-device UUID stored at
 *   localStorage["moku:deviceId"], shared across all Moku titles.
 * - Logged-in players (shared/moku-account.js) also send their session token
 *   as `auth`; the proxy then replaces the name with the account's display
 *   name + a verified "#u…" tag. Sent as a query param (not a header) so the
 *   GET stays a simple CORS request with no preflight.
 * - Opt-in networking only: call submit()/fetchTop() from explicit user
 *   actions (score-confirmed screen, opening the ranking screen) — never on
 *   page load. Never let a failed request block gameplay.
 * - The client NEVER holds a Dreamlo key. dreamlo-proxy/ maps gameId to a
 *   {public, private} Dreamlo key pair server-side (Lambda env var). This
 *   file is embedded in a public, unminified game HTML file, so it must
 *   never carry write-capable secrets — only `gameId` is sent.
 */
(function (global) {
  const DEVICE_ID_KEY = "moku:deviceId";
  const ACCOUNT_TOKEN_KEY = "moku:account:token"; // written by shared/moku-account.js

  let proxyBaseUrl = null;
  let gameId = null;

  function configure({ proxyBaseUrl: base, gameId: id } = {}) {
    proxyBaseUrl = base ? base.replace(/\/$/, "") : proxyBaseUrl;
    gameId = id ?? gameId;
  }

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  function requireConfig() {
    if (!proxyBaseUrl) throw new Error("MokuScores: call configure({ proxyBaseUrl }) first");
    if (!gameId) throw new Error("MokuScores: call configure({ gameId }) first");
  }

  // Suffix the display name with a short device id so two players who pick
  // the same nickname don't collide (the proxy dedupes by exact name).
  function entryName(playerName) {
    const label = (playerName || "Moku").replace(/\*/g, "").slice(0, 12);
    return `${label}#${getDeviceId().slice(0, 6)}`;
  }

  function accountToken() {
    try {
      return localStorage.getItem(ACCOUNT_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  async function submit(score, { playerName, level } = {}) {
    requireConfig();
    const params = new URLSearchParams({
      gameId,
      action: "submit",
      name: entryName(playerName),
      score: String(Math.floor(score)),
      seconds: String(level != null ? Math.max(0, Math.floor(level)) : 0),
    });
    const token = accountToken();
    if (token) params.set("auth", token);
    const res = await fetch(`${proxyBaseUrl}?${params}`);
    if (!res.ok) throw new Error(`MokuScores: submit failed (${res.status})`);
    return true;
  }

  async function fetchTop(limit = 25) {
    requireConfig();
    const params = new URLSearchParams({ gameId, limit: String(limit) });
    const res = await fetch(`${proxyBaseUrl}?${params}`);
    if (!res.ok) throw new Error(`MokuScores: fetch failed (${res.status})`);
    const data = await res.json();
    return (data.ranking || []).map((entry) => {
      const [label, deviceIdSuffix] = String(entry.playerName).split("#");
      // "u…" tags are set by the proxy for logged-in players only.
      const verified = /^u/.test(deviceIdSuffix || "");
      return { ...entry, playerName: label, deviceIdSuffix, verified };
    });
  }

  global.MokuScores = { configure, getDeviceId, submit, fetchTop };
})(window);
