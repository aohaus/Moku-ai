/**
 * Moku Series — error reporter (SPEC.md §12).
 *
 * Load first in <head>, before any other script, so it also catches scripts
 * that fail to load (e.g. three.js from the CDN):
 *   <script src="shared/moku-errors.js"></script>
 *
 * Sends uncaught errors, unhandled promise rejections and failed <script>
 * loads to POST /errors, where the same error is grouped and shown on the
 * admin page (🚨 エラー). Never sends save data or PINs. If the player is
 * logged in, their session token rides along so the admin can see who was
 * affected. At most MAX_REPORTS per page load; the same error only once.
 *
 * The body is JSON sent as text/plain, so the request is a simple CORS
 * request (no preflight) and can use keepalive.
 */
(function (global) {
  'use strict';

  // Same API as shared/moku-account.js (API_BASE_URL) — keep in sync.
  var API_BASE_URL = 'https://d6hl1cxi0i.execute-api.ap-southeast-5.amazonaws.com';
  var MAX_REPORTS = 5;
  var TOKEN_KEY = 'moku:account:token';

  function resolveBase() {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port === '3000') return '';
    // The published sites (backend/template.yaml AllowedOrigin / ExtraAllowedOrigin).
    if (/^(aohaus\.github\.io|dechatgpt\.com)$/.test(location.hostname)) return API_BASE_URL;
    return null; // elsewhere (file://, previews) the API wouldn't accept us anyway
  }
  var base = resolveBase();
  if (base === null || typeof fetch !== 'function') return;

  var sent = 0;
  var seen = {};

  function page() {
    return (location.pathname.split('/').pop() || 'index.html');
  }

  // Noise we can't act on: cross-origin "Script error." with no details,
  // browser extensions, and the harmless ResizeObserver warning.
  function ignorable(message, source) {
    if (/^Script error\.?$/i.test(message) && !source) return true;
    if (/^(chrome|moz|safari|safari-web)-extension:/.test(source || '')) return true;
    if (/ResizeObserver loop/.test(message)) return true;
    return false;
  }

  function report(r) {
    if (sent >= MAX_REPORTS || ignorable(r.message, r.source)) return;
    var key = r.message + '|' + r.source + '|' + r.line;
    if (seen[key]) return;
    seen[key] = true;
    sent++;
    var build = document.getElementById && document.getElementById('buildInfo');
    var token = null;
    try { token = localStorage.getItem(TOKEN_KEY); } catch (e) {}
    var body = {
      page: page(),
      message: String(r.message || '').slice(0, 500),
      source: String(r.source || '').slice(0, 300),
      line: r.line || 0,
      col: r.col || 0,
      stack: String(r.stack || '').slice(0, 4000),
      kind: r.kind,
      version: build ? build.textContent.trim().slice(0, 60) : '',
      url: location.href.split('#')[0].slice(0, 300)
    };
    if (token) body.auth = token;
    try {
      fetch(base + '/errors', {
        method: 'POST',
        headers: { 'content-type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(body),
        keepalive: true,
        credentials: 'omit'
      }).catch(function () {});
    } catch (e) {}
  }

  // Capture phase: also sees failed <script src> loads, which don't bubble.
  global.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== global && t.tagName === 'SCRIPT') {
      report({ kind: 'resource', message: 'Failed to load script: ' + (t.src || '(inline)'), source: t.src || '' });
      return;
    }
    if (t && t !== global) return; // images / audio: not fatal
    report({
      kind: 'error',
      message: e.message || (e.error && String(e.error)) || 'Unknown error',
      source: e.filename || '',
      line: e.lineno,
      col: e.colno,
      stack: e.error && e.error.stack
    });
  }, true);

  global.addEventListener('unhandledrejection', function (e) {
    var reason = e.reason;
    report({
      kind: 'rejection',
      message: 'Unhandled promise rejection: ' + (reason && reason.message ? reason.message : String(reason)),
      source: '',
      stack: reason && reason.stack
    });
  });
})(window);
