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
 * player can still play offline. It runs on every web address the pages are
 * served from (aohaus.github.io, dechatgpt.com via Cloudflare, `npm run dev`,
 * and any future one), so a new domain can't skip it. Only a file opened
 * straight from disk, or a local server other than `npm run dev`, is left
 * open for development. GitHub Pages is a static host, so this keeps casual
 * visitors out but cannot stop someone who reads the page source.
 *
 * Preview mode (*.pages.dev, Cloudflare Pages — one address per branch, for
 * trying a change on a phone before it is merged): no login, and
 * moku-account.js turns the cloud save off, so nothing reaches the real
 * accounts. A small "PREVIEW" badge shows it is not the real site.
 */
(function () {
  'use strict';

  if (/\.pages\.dev$/.test(location.hostname)) return showPreviewBadge();

  var isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (location.protocol === 'file:' || (isLocal && location.port !== '3000')) return;

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

  function showPreviewBadge() {
    function add() {
      if (document.getElementById('moku-preview-badge')) return;
      var b = document.createElement('div');
      b.id = 'moku-preview-badge';
      b.textContent = 'PREVIEW';
      b.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top, 0px) + 2px);transform:translateX(-50%);' +
        'z-index:2147483647;pointer-events:none;padding:2px 10px;border-radius:999px;background:rgba(232,92,154,0.88);' +
        'color:#fff;font:800 10px/1.4 -apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:0.12em;box-shadow:0 1px 4px rgba(0,0,0,0.25)';
      document.body.appendChild(b);
    }
    if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
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
