/* Moku Series — Offline Mode (SPEC.md §16).
 *
 * The games are single HTML files, the login check is local (moku-gate.js)
 * and progress lives in localStorage, so a page only needs its files to work
 * on a plane. Offline Mode is a switch the player turns on and off in My Moku
 * (shared/moku-account.js), so the app is always clearly in one of two modes:
 *
 * - Normal (switch off): everything comes from the network, as before. If the
 *   network is gone, a page shows "No internet" with a button to turn
 *   Offline Mode on (when this device has the games saved).
 * - Offline Mode (switch on): every page, script and picture comes from the
 *   "offline pack" saved on this device, without trying the network first.
 *   (Only a file the pack doesn't have is tried online.)
 *
 * The pack is saved by turning the switch on while online. In normal mode,
 * files fetched from the network also refresh a pack that exists.
 * Only same-origin files, the pinned three.js on cdnjs (3D games) and Google
 * Fonts are touched. The game API (another origin, or the dev server's mock
 * without a file extension) never is: an old cloud save from a cache would
 * confuse the sync.
 *
 * Keep the cache name and the two marker entries in sync with
 * shared/moku-account.js (backend/test/pages.test.js checks the cache name).
 */
var OFFLINE_CACHE = 'moku-offline-v1';
var CDN_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
// A finished download leaves this entry in the pack. A cache without it (one
// an earlier sw.js created empty) is not a pack.
var PACK_MARKER = new URL('__moku-offline-pack__', self.registration.scope).href;
// Present while Offline Mode is on (the worker can't read localStorage).
var MODE_MARKER = new URL('__moku-offline-mode__', self.registration.scope).href;

function packReady() {
  return caches.has(OFFLINE_CACHE).then(function (has) {
    if (!has) return false;
    return caches.open(OFFLINE_CACHE).then(function (c) { return c.match(PACK_MARKER); }).then(function (m) { return !!m; });
  });
}

var modeOn = null;   // null = not read yet
function readMode() {
  return caches.has(OFFLINE_CACHE).then(function (has) {
    if (!has) return false;
    return caches.open(OFFLINE_CACHE).then(function (c) { return c.match(MODE_MARKER); }).then(function (m) { return !!m; });
  }).then(function (on) { modeOn = on; return on; }, function () { return false; });
}

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    // Drop packs of an older format; turning Offline Mode on saves a new one.
    return Promise.all(keys.filter(function (k) { return /^moku-offline-/.test(k) && k !== OFFLINE_CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () {
    // The first sw.js (2026-11-21) could leave an empty or half-filled cache on
    // devices that never saved a pack: drop it.
    return packReady().then(function (ok) { if (!ok) return caches.delete(OFFLINE_CACHE); });
  }).then(readMode).then(function () { return self.clients.claim(); }));
});

// The switch was flipped in a page: take it now (the marker is already written).
self.addEventListener('message', function (event) {
  var d = event.data;
  if (d && d.type === 'moku-offline-mode') modeOn = !!d.on;
});

var STATIC_RE = /(\/|\.(html|js|css|png|jpe?g|svg|webp|gif|ico|md|json|woff2?|webmanifest))$/i;
function handled(request, url) {
  if (request.headers.get('Authorization')) return false;
  if (url.origin === self.location.origin) return request.mode === 'navigate' || STATIC_RE.test(url.pathname);
  return CDN_HOSTS.indexOf(url.hostname) >= 0;
}

function isPage(request) {
  return request.mode === 'navigate' || /\.html$/.test(new URL(request.url).pathname);
}

// The pack's copy: the exact URL, else the same page without its query
// (?join=…, ?fresh=…), else the folder's index.html.
function fromPack(request) {
  // caches.open() would create an empty pack on a device that has none: only
  // look inside one that exists.
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

// Normal mode: refresh a pack that exists with what the network just sent.
function keep(request, res) {
  return packReady().then(function (has) {
    if (!has) return;   // no pack on this device: cache nothing
    // A page is kept once, without its query (?fresh=…, ?join=…), so the
    // pack doesn't grow a new copy of the hub with every update.
    var url = new URL(request.url);
    var key = request;
    if (url.origin === self.location.origin && isPage(request)) {
      url.search = '';
      url.hash = '';
      key = url.href;
    }
    return plain(res).then(function (copy) {
      return caches.open(OFFLINE_CACHE).then(function (cache) { return cache.put(key, copy); });
    });
  }).catch(function () {});
}

var PAGE_STYLE = '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
  'background:#0A0B12;color:#EDEEF6;font:600 16px -apple-system,"Segoe UI",Roboto,sans-serif;text-align:center;padding:24px;box-sizing:border-box}' +
  'h1{font-size:22px;font-weight:800;margin:0 0 8px}p{color:rgba(237,238,246,0.65);margin:0 0 18px;line-height:1.5}' +
  'a,button{display:inline-block;margin:4px;padding:11px 20px;border:0;border-radius:999px;background:#2A2E4A;color:#EDEEF6;' +
  'text-decoration:none;font:800 15px -apple-system,"Segoe UI",Roboto,sans-serif;cursor:pointer}' +
  'button{background:linear-gradient(180deg,#7EC8E3,#3F8FA0);color:#0A1A22}</style>';

function htmlResponse(body, status) {
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Offline</title>' + PAGE_STYLE + body, { status: status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// Normal mode, no network: offer to switch (only if the games are saved here).
function noNetworkPage(ready) {
  if (!ready) {
    return htmlResponse('<div><div style="font-size:44px">📴</div><h1>No internet</h1>' +
      '<p>The games aren\'t saved on this device yet.<br>When you\'re online, open My Moku and turn on<br>“✈️ Offline Mode” once.</p>' +
      '<a href="hub.html">↻ Try again</a></div>', 503);
  }
  var script = '<script>document.getElementById("go").onclick=function(){' +
    'caches.open(' + JSON.stringify(OFFLINE_CACHE) + ').then(function(c){return c.put(' + JSON.stringify(MODE_MARKER) +
    ',new Response("on"));}).then(function(){try{localStorage.setItem("mokuhub:offline-mode","1");}catch(e){}' +
    'var w=navigator.serviceWorker&&navigator.serviceWorker.controller;if(w)w.postMessage({type:"moku-offline-mode",on:true});' +
    'location.reload();});};<\/script>';
  return htmlResponse('<div><div style="font-size:44px">✈️</div><h1>No internet</h1>' +
    '<p>Your games are saved on this device.<br>Turn on Offline Mode to play them.</p>' +
    '<button id="go" type="button">✈️ Turn on Offline Mode</button><br><a href="hub.html">↻ Try again</a></div>' + script, 503);
}

// Offline Mode, a page that isn't in the pack.
function notSavedPage() {
  return htmlResponse('<div><div style="font-size:44px">✈️</div><h1>Not saved on this device</h1>' +
    '<p>This page isn\'t in your offline games.<br>Turn Offline Mode off and on again while online to save it.</p>' +
    '<a href="hub.html">🦉 Back to the games</a></div>', 503);
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (!handled(request, url)) return;

  event.respondWith((modeOn === null ? readMode() : Promise.resolve(modeOn)).then(function (on) {
    if (on) {
      // Offline Mode: the pack first, the network only for what it lacks.
      return fromPack(request).then(function (hit) {
        if (hit) return hit;
        return fetch(request).catch(function () { return isPage(request) ? notSavedPage() : Response.error(); });
      });
    }
    // Normal: the network, as before.
    return fetch(request).then(function (res) {
      if (res.ok || res.type === 'opaque') keep(request, res.clone());
      return res;
    }, function () {
      if (!isPage(request)) return Response.error();
      return packReady().then(noNetworkPage, function () { return noNetworkPage(false); });
    });
  }));
});
