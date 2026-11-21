/* Moku Series — offline mode (SPEC.md §16).
 *
 * The games are single HTML files, the login check is local (moku-gate.js)
 * and progress lives in localStorage, so a page only needs its files to work
 * on a plane. This worker is the fallback that hands them out when there is
 * no network:
 *
 * - Online it changes nothing: every request goes to the network first, as
 *   before (updates, "Get the latest games & updates", the API).
 * - Offline (or when the network hangs or a Wi-Fi login page answers instead)
 *   it serves the copy in the "offline pack" cache.
 * - The pack is filled by My Moku's "✈️ Get ready for offline"
 *   (shared/moku-account.js). Once a pack exists, files fetched online are
 *   also kept fresh in it, so it follows updates by itself.
 * - Only same-origin files and the pinned three.js on cdnjs (3D games) and
 *   Google Fonts are touched. The game API (another origin) never is.
 *
 * Keep the cache name in sync with OFFLINE_CACHE in shared/moku-account.js.
 */
var OFFLINE_CACHE = 'moku-offline-v1';
var NET_TIMEOUT_MS = 6000;      // a hanging network (plane Wi-Fi) falls back to the pack
var CDN_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
// A finished "Get ready for offline" leaves this entry in the pack. A cache
// without it (one an earlier sw.js created empty) is not a pack.
var PACK_MARKER = new URL('__moku-offline-pack__', self.registration.scope).href;
function packReady() {
  return caches.has(OFFLINE_CACHE).then(function (has) {
    if (!has) return false;
    return caches.open(OFFLINE_CACHE).then(function (c) { return c.match(PACK_MARKER); }).then(function (m) { return !!m; });
  });
}

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    // Drop packs of an older format; "Get ready for offline" builds a new one.
    return Promise.all(keys.filter(function (k) { return /^moku-offline-/.test(k) && k !== OFFLINE_CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () {
    // The first sw.js (2026-11-21) could leave an empty or half-filled cache on
    // devices that never saved a pack: drop it.
    return packReady().then(function (ok) { if (!ok) return caches.delete(OFFLINE_CACHE); });
  }).then(function () { return self.clients.claim(); }));
});

// Static files only. An API answer (the dev server's mock is on the same
// origin; /save, /rooms …) must never come from a cache: an old cloud save
// would confuse the sync.
var STATIC_RE = /(\/|\.(html|js|css|png|jpe?g|svg|webp|gif|ico|md|json|woff2?|webmanifest))$/i;
function handled(request, url) {
  if (request.headers.get('Authorization')) return false;
  if (url.origin === self.location.origin) return request.mode === 'navigate' || STATIC_RE.test(url.pathname);
  return CDN_HOSTS.indexOf(url.hostname) >= 0;
}

// The pack's copy: the exact URL, else the same page without its query
// (?join=…, ?fresh=…), else the folder's index.html.
function fromPack(request) {
  // caches.open() would create an empty pack on a device that has none (and
  // then everything looks "saved"): only look inside one that exists.
  return caches.has(OFFLINE_CACHE).then(function (has) {
    return has ? caches.open(OFFLINE_CACHE) : null;
  }).then(function (cache) {
    if (!cache) return null;
    return cache.match(request).then(function (hit) {
      if (hit) return hit;
      return cache.match(request, { ignoreSearch: true, ignoreVary: true }).then(function (hit2) {
        if (hit2) return hit2;
        var url = new URL(request.url);
        if (url.origin === self.location.origin && /\/$/.test(url.pathname)) {
          return cache.match(new URL('index.html', url).href, { ignoreSearch: true });
        }
        return null;
      });
    });
  });
}

// A redirected response can't answer a navigation in Safari: keep a plain copy.
function plain(res) {
  if (!res.redirected) return Promise.resolve(res);
  return res.blob().then(function (body) {
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  });
}

function keep(request, res) {
  return packReady().then(function (has) {
    if (!has) return;   // no pack on this device: cache nothing
    // A page is kept once, without its query (?fresh=…, ?join=…), so the
    // pack doesn't grow a new copy of the hub with every update.
    var url = new URL(request.url);
    var key = request;
    if (url.origin === self.location.origin && (request.mode === 'navigate' || /\.html$/.test(url.pathname))) {
      url.search = '';
      url.hash = '';
      key = url.href;
    }
    return plain(res).then(function (copy) {
      return caches.open(OFFLINE_CACHE).then(function (cache) { return cache.put(key, copy); });
    });
  }).catch(function () {});
}

function offlinePage(request) {
  var isPage = request.mode === 'navigate' || /\.html$/.test(new URL(request.url).pathname);
  if (!isPage) return Response.error();
  var html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Offline</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:#0A0B12;color:#EDEEF6;font:600 16px -apple-system,"Segoe UI",Roboto,sans-serif;text-align:center;padding:24px;box-sizing:border-box}' +
    'h1{font-size:22px;font-weight:800;margin:0 0 8px}p{color:rgba(237,238,246,0.65);margin:0 0 18px;line-height:1.5}' +
    'a{display:inline-block;padding:10px 18px;border-radius:999px;background:#2A2E4A;color:#EDEEF6;text-decoration:none;font-weight:800}</style>' +
    '<div><div style="font-size:44px">✈️</div><h1>You\'re offline</h1>' +
    '<p>This page isn\'t saved on this device yet.<br>Next time you\'re online, open My Moku and tap<br>“✈️ Get ready for offline”.</p>' +
    '<a href="hub.html">🦉 Back to the games</a></div>';
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (!handled(request, url)) return;

  event.respondWith(new Promise(function (resolve) {
    var done = false;
    var answer = function (res) { if (!done && res) { done = true; resolve(res); } };
    var fallback = function () {
      return fromPack(request).then(function (hit) { return hit || offlinePage(request); });
    };

    var network = fetch(request).then(function (res) {
      // A Wi-Fi login page (redirected to another site) or a server error is
      // not the file we asked for: prefer the pack's copy if there is one.
      var finalUrl = res.url ? new URL(res.url) : url;
      var foreign = res.type !== 'opaque' && res.type !== 'opaqueredirect' && finalUrl.origin !== url.origin;
      if ((foreign || !res.ok) && res.type !== 'opaque' && res.type !== 'opaqueredirect') {
        return fromPack(request).then(function (hit) { return hit || res; });
      }
      if (res.ok || res.type === 'opaque') keep(request, res.clone());
      return res;
    });

    network.then(answer, function () { fallback().then(answer); });
    // The network is slow: answer from the pack if it has the file (the
    // network reply still refreshes the pack when it comes).
    setTimeout(function () {
      if (done) return;
      fromPack(request).then(function (hit) { if (hit) answer(hit); });
    }, NET_TIMEOUT_MS);
  }));
});
