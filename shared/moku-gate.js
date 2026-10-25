/**
 * Moku Series — login gate (SPEC.md §10).
 *
 * Games and the hub are for logged-in players only. Load in <head>, right
 * after shared/moku-errors.js and before anything else:
 *   <script src="shared/moku-gate.js"></script>
 *
 * Without a valid session it sends the player to index.html?next=<this page>,
 * where they log in and come straight back. It runs before the page draws,
 * so the game never flashes on screen.
 *
 * The check is local (the saved session token and its expiry), so a logged-in
 * player can still play offline. It only runs where the account API runs
 * (aohaus.github.io and `npm run dev`); a file opened straight from disk
 * still works for development. GitHub Pages is a static host, so this keeps
 * casual visitors out but cannot stop someone who reads the page source.
 */
(function () {
  'use strict';

  // Same hosts as resolveBase() in shared/moku-account.js — keep in sync.
  var host = location.hostname;
  var gated = host === 'aohaus.github.io' ||
    (/^(localhost|127\.0\.0\.1)$/.test(host) && location.port === '3000');
  if (!gated) return;

  // Token = base64url(JSON payload) + "." + signature (backend/src/token.js).
  // The signature is checked by the server; here we only read the expiry.
  function hasSession() {
    try {
      var token = localStorage.getItem('moku:account:token');
      if (!token || !localStorage.getItem('moku:account:user')) return false;
      var body = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
      var payload = JSON.parse(decodeURIComponent(escape(atob(body))));
      return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
    } catch (e) {
      return false;
    }
  }

  function toLogin() {
    var page = location.pathname.split('/').pop() || 'index.html';
    location.replace('index.html?next=' + encodeURIComponent(page + location.search + location.hash));
  }

  if (!hasSession()) return toLogin();

  // Session ended while the page is open: the server refused the token
  // (PIN or ID changed by the admin), or the player logged out in another tab.
  window.addEventListener('storage', function (e) {
    if ((e.key === null || e.key === 'moku:account:token') && !hasSession()) toLogin();
  });
  // DOMContentLoaded: moku-account.js is loaded by then, and this handler
  // (added from <head>) runs before its boot sync, so no status change is missed.
  document.addEventListener('DOMContentLoaded', function () {
    var acc = window.MokuAccount;
    if (acc && acc.onStatusChange) acc.onStatusChange(function () { if (!hasSession()) toLogin(); });
    if (!hasSession()) toLogin();
  });
})();
