/**
 * Moku Series — player accounts + cloud save (SPEC.md §10).
 *
 * Include on a page:
 *   <script src="shared/moku-account.js"></script>
 *     Full mode (hub pages). Renders a Log In / account chip into every
 *     [data-moku-account] element, swaps the text of [data-moku-greeting]
 *     to "Hello, <name>!", and syncs progress with the cloud on load.
 *   <script src="shared/moku-account.js" data-mode="background"></script>
 *     Game pages. No UI — only uploads progress when the page is hidden or
 *     closed, so playing a game and closing the tab still reaches the cloud.
 *
 * How sync works:
 * - The cloud save is a snapshot of every Moku localStorage key (see
 *   SYNC_PREFIXES) with a revision number. Each device remembers the rev and
 *   a hash of what it last synced (moku:sync:state).
 * - On load: if only this device changed → upload. If only the cloud changed
 *   → download and reload the page. If both changed (or this device had guest
 *   progress before logging in) → ask the player which one to keep.
 * - Logging out uploads first, then removes that player's progress from this
 *   device, so the next kid on a shared iPad starts clean.
 *
 * Nothing here blocks play: if the API is unreachable, the game keeps using
 * localStorage as before (SPEC.md §2).
 */
(function (global) {
  'use strict';

  // ApiUrl output of `sam deploy` in backend/ (stack moku-backend,
  // ap-southeast-5). Only origins listed in the stack's AllowedOrigin can
  // call it. On http://localhost:3000 (npm run dev) the server.js mock is
  // used instead, so local testing never touches real accounts.
  // Empty = login stays "Coming Soon".
  var API_BASE_URL = 'https://d6hl1cxi0i.execute-api.ap-southeast-5.amazonaws.com';

  var TOKEN_KEY = 'moku:account:token';
  var USER_KEY = 'moku:account:user';
  var SYNC_KEY = 'moku:sync:state';
  // Every save key the games use today. moku:deviceId stays per-device.
  var SYNC_PREFIXES = ['moku:', 'moku_', 'moyomoyo-', 'amoku-'];
  var NO_SYNC = ['moku:deviceId', 'moku:account:', 'moku:sync:'];
  // Written by the hub itself on every visit — doesn't count as "progress"
  // when deciding whether a fresh device has anything worth keeping.
  var NOT_PROGRESS = ['moku:stats:streak'];
  var KEEPALIVE_MAX_BYTES = 60000; // browsers cap keepalive bodies at 64 KB

  var script = document.currentScript;
  var mode = (script && script.getAttribute('data-mode')) || 'full';

  function resolveBase() {
    if (typeof global.MOKU_ACCOUNT_API === 'string') return global.MOKU_ACCOUNT_API.replace(/\/$/, '');
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port === '3000') return '';
    if (API_BASE_URL) return API_BASE_URL.replace(/\/$/, '');
    return null;
  }
  var base = resolveBase();
  var enabled = base !== null;

  // ---------- storage helpers ----------

  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
  function readJson(key) {
    try { return JSON.parse(lsGet(key) || 'null'); } catch (e) { return null; }
  }

  function getToken() { return lsGet(TOKEN_KEY); }
  function getUser() { return getToken() ? readJson(USER_KEY) : null; }

  function setSession(token, user) {
    lsSet(TOKEN_KEY, token);
    lsSet(USER_KEY, JSON.stringify(user));
  }
  function clearSession() {
    lsRemove(TOKEN_KEY);
    lsRemove(USER_KEY);
  }

  function isSyncKey(key) {
    var i;
    for (i = 0; i < NO_SYNC.length; i++) if (key.indexOf(NO_SYNC[i]) === 0) return false;
    for (i = 0; i < SYNC_PREFIXES.length; i++) if (key.indexOf(SYNC_PREFIXES[i]) === 0) return true;
    return false;
  }

  function collectLocal() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && isSyncKey(key)) out[key] = localStorage.getItem(key);
      }
    } catch (e) {}
    return out;
  }

  function hasProgress(data) {
    return Object.keys(data).some(function (k) { return NOT_PROGRESS.indexOf(k) < 0; });
  }

  // Replaces this device's Moku progress with `data` (null = wipe it).
  function replaceLocal(data) {
    var existing = Object.keys(collectLocal());
    existing.forEach(function (k) { if (!data || !(k in data)) lsRemove(k); });
    if (data) Object.keys(data).forEach(function (k) { lsSet(k, data[k]); });
  }

  // FNV-1a over key-sorted JSON: cheap change detection, not security.
  function hashData(data) {
    var keys = Object.keys(data).sort();
    var str = JSON.stringify(keys.map(function (k) { return [k, data[k]]; }));
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16) + ':' + str.length;
  }

  function getSyncState(user) {
    var st = readJson(SYNC_KEY);
    return st && user && st.lid === user.loginId ? st : null;
  }
  function setSyncState(user, rev, hash) {
    lsSet(SYNC_KEY, JSON.stringify({ lid: user.loginId, rev: rev, hash: hash, at: new Date().toISOString() }));
  }

  function deviceLabel() {
    var ua = navigator.userAgent || '';
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
    if (/iPhone|iPod/.test(ua)) return 'iPhone';
    if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
    if (/CrOS/.test(ua)) return 'Chromebook';
    if (/Macintosh/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows PC';
    return 'Browser';
  }

  // ---------- API ----------

  function api(method, path, body, opts) {
    var headers = {};
    if (body) headers['content-type'] = 'application/json';
    var token = getToken();
    if (token) headers.authorization = 'Bearer ' + token;
    return fetch(base + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
      keepalive: !!(opts && opts.keepalive)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.ok) return data;
        var err = new Error(data.message || 'Something went wrong.');
        err.code = data.error || 'http_' + res.status;
        err.status = res.status;
        err.data = data;
        throw err;
      });
    }, function () {
      var err = new Error("Can't reach the Moku server. Check your internet.");
      err.code = 'offline';
      throw err;
    });
  }

  // Token rejected (expired, or PIN changed on another device).
  function handleAuthError(err) {
    if (err && err.code === 'unauthorized') {
      clearSession();
      setStatus('idle');
      renderAll();
      toast('Please log in again.');
      return true;
    }
    return false;
  }

  // ---------- sync ----------

  var status = 'idle'; // idle | syncing | ok | offline | conflict | error
  var listeners = [];
  var running = null;

  function setStatus(next) {
    status = next;
    renderAll();
    listeners.forEach(function (fn) { try { fn(status); } catch (e) {} });
  }

  function upload(user, data, baseRev) {
    return api('PUT', '/save', { data: data, baseRev: baseRev, device: deviceLabel() }).then(function (res) {
      setSyncState(user, res.rev, hashData(data));
      return res;
    });
  }

  function adoptRemote(user, remote) {
    replaceLocal(remote.data);
    setSyncState(user, remote.rev, hashData(remote.data));
    // Every page reads localStorage on load, so reload to show the new progress.
    location.reload();
  }

  // Resolves to the final status. `interactive` = the player is looking
  // (shows the conflict chooser); background calls never ask.
  function syncNow(opts) {
    var interactive = !!(opts && opts.interactive);
    if (!enabled || !getUser()) return Promise.resolve('idle');
    if (running) return running;

    function attempt(retried) {
      var user = getUser();
      var local = collectLocal();
      var localHash = hashData(local);
      var st = getSyncState(user);

      return api('GET', '/save').then(function (res) {
        var remote = res.save;
        if (!remote) return upload(user, local, 0).then(function () { return 'ok'; });

        var remoteHash = hashData(remote.data);
        if (remoteHash === localHash) {
          setSyncState(user, remote.rev, localHash);
          return 'ok';
        }
        if (st && st.rev === remote.rev) {
          // Cloud unchanged since our last sync → our edits win.
          return upload(user, local, remote.rev).then(function () { return 'ok'; });
        }
        var localUntouched = st ? st.hash === localHash : !hasProgress(local);
        if (localUntouched) {
          adoptRemote(user, remote);
          return 'ok';
        }
        if (!interactive) return 'conflict';
        return chooseSave(remote, local).then(function (choice) {
          if (choice === 'cloud') {
            adoptRemote(user, remote);
            return 'ok';
          }
          if (choice === 'device') return upload(user, local, remote.rev).then(function () { return 'ok'; });
          return 'conflict';
        });
      }).catch(function (err) {
        if (err.code === 'conflict' && !retried) return attempt(true);
        if (handleAuthError(err)) return 'idle';
        if (err.code === 'offline') return 'offline';
        if (err.code === 'too_large') toast('Your save is too big to upload.');
        return 'error';
      });
    }

    setStatus('syncing');
    running = attempt(false).then(function (result) {
      running = null;
      setStatus(result);
      return result;
    });
    return running;
  }

  // Best-effort upload when the page goes away. Only when this device is
  // known to be up to date with the cloud — anything trickier waits for
  // the next hub visit, which can ask the player.
  function flushOnHide() {
    var user = getUser();
    var st = getSyncState(user);
    if (!enabled || !user || !st || running) return;
    var local = collectLocal();
    var hash = hashData(local);
    if (hash === st.hash) return;
    var body = JSON.stringify({ data: local, baseRev: st.rev, device: deviceLabel() });
    if (body.length > KEEPALIVE_MAX_BYTES) return;
    api('PUT', '/save', { data: local, baseRev: st.rev, device: deviceLabel() }, { keepalive: true })
      .then(function (res) { setSyncState(user, res.rev, hash); })
      .catch(function () {});
  }

  // ---------- account actions ----------

  function finishLogin(res) {
    setSession(res.token, res.user);
    closeModal();
    renderAll();
    toast('Welcome, ' + res.user.displayName + '!');
    return syncNow({ interactive: true });
  }

  function login(loginId, pin) {
    return api('POST', '/auth/login', { loginId: loginId, pin: pin }).then(finishLogin);
  }

  function register(fields) {
    return api('POST', '/auth/register', fields).then(finishLogin);
  }

  function changePin(currentPin, newPin) {
    return api('POST', '/auth/pin', { currentPin: currentPin, newPin: newPin }).then(function (res) {
      setSession(res.token, res.user);
      return res;
    });
  }

  // Uploads first; only wipes this device's progress once it's safe in the cloud.
  function logout(opts) {
    var force = !!(opts && opts.force);
    var ready = force ? Promise.resolve('ok') : syncNow({ interactive: true });
    return ready.then(function (result) {
      if (result !== 'ok') return result;
      if (!force) replaceLocal(null);
      clearSession();
      lsRemove(SYNC_KEY);
      location.reload();
      return 'ok';
    });
  }

  // ---------- UI ----------

  var CSS = [
    '.mka-chip{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px 0 11px;border-radius:999px;',
    'border:1px solid rgba(255,255,255,0.16);background:rgba(255,255,255,0.07);color:#EDEEF6;font:inherit;',
    'font-size:13px;font-weight:800;letter-spacing:0.01em;cursor:pointer;white-space:nowrap;max-width:46vw;',
    '-webkit-tap-highlight-color:transparent;transition:background .15s,border-color .15s}',
    '.mka-chip:hover,.mka-chip:focus-visible{background:rgba(255,255,255,0.13);border-color:rgba(110,231,168,0.55);outline:none}',
    '.mka-chip .mka-name{overflow:hidden;text-overflow:ellipsis}',
    '.mka-avatar{flex:none;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;',
    'background:linear-gradient(135deg,#6EE7A8,#FFC94A);color:#10121E;font-size:12px;font-weight:900}',
    '.mka-dot{flex:none;width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,0.3)}',
    '.mka-dot[data-status="ok"]{background:#6EE7A8}',
    '.mka-dot[data-status="syncing"]{background:#FFC94A;animation:mka-pulse 1s ease-in-out infinite}',
    '.mka-dot[data-status="conflict"]{background:#FFC94A}',
    '.mka-dot[data-status="error"]{background:#FF8A8A}',
    '@keyframes mka-pulse{50%{opacity:.3}}',
    '.mka-overlay{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;',
    'padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));',
    'background:rgba(5,6,12,0.62);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:mka-fade .18s ease}',
    '.mka-panel{position:relative;width:100%;max-width:360px;max-height:100%;overflow:auto;padding:24px 22px 20px;',
    'border-radius:20px;background:linear-gradient(180deg,#1A1D30,#10121E);border:1px solid rgba(255,255,255,0.12);',
    'box-shadow:0 18px 50px rgba(0,0,0,0.5);color:#EDEEF6;font-family:-apple-system,"Segoe UI",Roboto,sans-serif;',
    'animation:mka-pop .22s cubic-bezier(.2,1.3,.4,1)}',
    '@keyframes mka-fade{from{opacity:0}}',
    '@keyframes mka-pop{from{transform:translateY(10px) scale(.97);opacity:0}}',
    '.mka-close{position:absolute;top:10px;right:10px;width:34px;height:34px;border:0;border-radius:50%;',
    'background:transparent;color:rgba(237,238,246,0.55);font-size:20px;cursor:pointer}',
    '.mka-close:hover{background:rgba(255,255,255,0.08);color:#EDEEF6}',
    '.mka-hero{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:16px;text-align:center}',
    '.mka-hero img{width:58px;height:58px;border-radius:50%;object-fit:cover;padding:2.5px;',
    'background:conic-gradient(#7C3AED,#3B82F6,#22D3EE,#22C55E,#EAB308,#F97316,#EF4444,#EC4899,#7C3AED)}',
    '.mka-title{margin:0;font-size:20px;font-weight:800;letter-spacing:0.02em}',
    '.mka-sub{margin:0;font-size:13px;color:rgba(237,238,246,0.6);font-weight:600;line-height:1.45}',
    '.mka-tabs{display:flex;gap:4px;padding:4px;margin-bottom:16px;border-radius:12px;background:rgba(255,255,255,0.06)}',
    '.mka-tab{flex:1;height:34px;border:0;border-radius:9px;background:transparent;color:rgba(237,238,246,0.6);',
    'font:inherit;font-size:13.5px;font-weight:800;cursor:pointer}',
    '.mka-tab[aria-selected="true"]{background:rgba(255,255,255,0.12);color:#EDEEF6}',
    '.mka-form{display:flex;flex-direction:column;gap:12px}',
    '.mka-field{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:rgba(237,238,246,0.7);letter-spacing:0.02em}',
    '.mka-field small{font-weight:600;color:rgba(237,238,246,0.42);letter-spacing:0}',
    '.mka-input{height:46px;padding:0 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.14);',
    'background:rgba(0,0,0,0.25);color:#EDEEF6;font:inherit;font-size:16px;font-weight:700;outline:none}',
    '.mka-input:focus{border-color:#6EE7A8;box-shadow:0 0 0 3px rgba(110,231,168,0.18)}',
    '.mka-input.is-pin{letter-spacing:0.4em;font-size:20px}',
    '.mka-error{min-height:18px;margin:0;font-size:13px;font-weight:700;color:#FF8A8A}',
    '.mka-primary,.mka-secondary{height:48px;border-radius:14px;font:inherit;font-size:15.5px;font-weight:800;cursor:pointer;',
    'letter-spacing:0.02em;transition:transform .1s,filter .15s}',
    '.mka-primary{border:0;background:linear-gradient(180deg,#7EF0B4,#3FBF85);color:#0E1A14;box-shadow:0 6px 18px rgba(63,191,133,0.3)}',
    '.mka-primary:active,.mka-secondary:active{transform:scale(.98)}',
    '.mka-primary:disabled{filter:grayscale(.6) brightness(.8);cursor:wait}',
    '.mka-secondary{border:1px solid rgba(255,255,255,0.16);background:rgba(255,255,255,0.06);color:#EDEEF6}',
    '.mka-secondary:hover{background:rgba(255,255,255,0.11)}',
    '.mka-link{border:0;background:none;color:rgba(237,238,246,0.55);font:inherit;font-size:12.5px;font-weight:700;',
    'cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:6px}',
    '.mka-meta{display:flex;flex-direction:column;gap:6px;padding:12px 14px;margin-bottom:14px;border-radius:14px;',
    'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);font-size:13px;font-weight:600;color:rgba(237,238,246,0.75)}',
    '.mka-meta b{color:#EDEEF6}',
    '.mka-actions{display:flex;flex-direction:column;gap:10px}',
    '.mka-choice{display:flex;align-items:center;gap:12px;width:100%;padding:14px;border-radius:14px;text-align:left;',
    'border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);color:#EDEEF6;font:inherit;cursor:pointer}',
    '.mka-choice:hover,.mka-choice:focus-visible{border-color:#6EE7A8;background:rgba(110,231,168,0.08);outline:none}',
    '.mka-choice .mka-icon{font-size:26px;flex:none}',
    '.mka-choice b{display:block;font-size:15px;font-weight:800}',
    '.mka-choice span span{display:block;margin-top:2px;font-size:12.5px;font-weight:600;color:rgba(237,238,246,0.6)}',
    '.mka-toast{position:fixed;left:50%;bottom:max(22px,env(safe-area-inset-bottom));z-index:9100;transform:translate(-50%,20px);',
    'padding:10px 16px;border-radius:999px;background:rgba(16,18,30,0.94);border:1px solid rgba(110,231,168,0.4);',
    'color:#EDEEF6;font:800 13.5px -apple-system,"Segoe UI",Roboto,sans-serif;opacity:0;pointer-events:none;',
    'transition:opacity .25s,transform .25s;max-width:calc(100vw - 32px)}',
    '.mka-toast.is-visible{opacity:1;transform:translate(-50%,0)}'
  ].join('');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + hh + ':' + mm;
  }

  function statusText() {
    var st = getSyncState(getUser());
    switch (status) {
      case 'syncing': return '☁️ Saving…';
      case 'offline': return "📴 Offline — we'll save when you're back online";
      case 'conflict': return '⚠️ Choose which save to keep';
      case 'error': return '⚠️ Couldn’t save to the cloud';
      default: return st ? '☁️ Saved · ' + fmtDate(st.at) : '☁️ Not synced yet';
    }
  }

  var styleInjected = false;
  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    var el = document.createElement('style');
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  var greetingDefaults = typeof WeakMap === 'function' ? new WeakMap() : null;

  function renderAll() {
    if (mode !== 'full' || !enabled || !document.body) return;
    injectStyle();
    var user = getUser();

    Array.prototype.forEach.call(document.querySelectorAll('[data-moku-account]'), function (slot) {
      slot.innerHTML = user
        ? '<button class="mka-chip" type="button" aria-label="Account: ' + esc(user.displayName) + '">' +
          '<span class="mka-avatar" aria-hidden="true">' + esc(Array.from(user.displayName)[0] || '?') + '</span>' +
          '<span class="mka-name">' + esc(user.displayName) + '</span>' +
          '<span class="mka-dot" data-status="' + status + '" aria-hidden="true"></span></button>'
        : '<button class="mka-chip" type="button"><span aria-hidden="true">👤</span>Log In</button>';
      slot.firstChild.addEventListener('click', function () { openModal(user ? 'account' : 'login'); });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-moku-greeting]'), function (el) {
      if (greetingDefaults && !greetingDefaults.has(el)) greetingDefaults.set(el, el.textContent);
      if (user) el.textContent = 'Hello, ' + user.displayName + '!';
      else if (greetingDefaults) el.textContent = greetingDefaults.get(el);
    });

    if (modalView === 'account') renderModal('account');
  }

  var overlay = null;
  var modalView = null;
  var conflictResolve = null;

  function closeModal() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    modalView = null;
    if (conflictResolve) {
      conflictResolve(null);
      conflictResolve = null;
    }
  }

  function openModal(view, data) {
    injectStyle();
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'mka-overlay';
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
      document.body.appendChild(overlay);
    }
    renderModal(view, data);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay) closeModal();
  });

  var HERO = '<div class="mka-hero"><img src="brand/mokumoku-hero.png" alt="">';

  function field(label, name, attrs, hint) {
    return '<label class="mka-field">' + label + (hint ? ' <small>' + hint + '</small>' : '') +
      '<input class="mka-input' + (/pin/i.test(name) ? ' is-pin' : '') + '" name="' + name + '" ' + attrs + '></label>';
  }
  var ID_ATTRS = 'autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="16" required';
  function pinAttrs(autocomplete) {
    return 'type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="' + autocomplete + '" required';
  }

  function renderModal(view, data) {
    modalView = view;
    var user = getUser();
    var html = '<div class="mka-panel" role="dialog" aria-modal="true" aria-labelledby="mkaTitle">';
    if (view !== 'conflict') html += '<button class="mka-close" type="button" aria-label="Close">×</button>';

    if (view === 'login' || view === 'register') {
      var isLogin = view === 'login';
      html += HERO + '<h2 class="mka-title" id="mkaTitle">' + (isLogin ? 'Welcome back!' : 'Join Moku Series') + '</h2>' +
        '<p class="mka-sub">' + (isLogin
          ? 'Log in to keep your progress on every device.'
          : 'Ask a grown-up for the invite code.') + '</p></div>' +
        '<div class="mka-tabs" role="tablist">' +
        '<button class="mka-tab" type="button" role="tab" data-go="login" aria-selected="' + isLogin + '">Log In</button>' +
        '<button class="mka-tab" type="button" role="tab" data-go="register" aria-selected="' + !isLogin + '">New Account</button></div>' +
        '<form class="mka-form" novalidate>' +
        (isLogin ? '' : field('Invite code', 'inviteCode', 'autocomplete="off" autocapitalize="none" spellcheck="false" required')) +
        field('Player ID', 'loginId', ID_ATTRS, isLogin ? '' : 'letters & numbers, 3–16') +
        (isLogin ? '' : field('Name on the leaderboard', 'displayName', 'autocomplete="nickname" maxlength="12"', 'up to 12')) +
        field('PIN', 'pin', pinAttrs(isLogin ? 'current-password' : 'new-password'), isLogin ? '' : '4–6 numbers') +
        '<p class="mka-error" role="alert"></p>' +
        '<button class="mka-primary" type="submit">' + (isLogin ? 'Log In' : 'Create Account') + '</button>' +
        (isLogin ? '<p class="mka-sub" style="text-align:center">Forgot your PIN? Ask a grown-up to reset it.</p>' : '') +
        '</form>';
    } else if (view === 'account' && user) {
      html += HERO + '<h2 class="mka-title" id="mkaTitle">' + esc(user.displayName) + '</h2>' +
        '<p class="mka-sub">Player ID: ' + esc(user.loginId) + '</p></div>' +
        '<div class="mka-meta"><span>' + esc(statusText()) + '</span>' +
        '<span>Leaderboard name: <b>' + esc(user.displayName) + '</b> #' + esc(user.tag) + '</span></div>' +
        '<div class="mka-actions">' +
        '<button class="mka-secondary" type="button" data-act="sync">☁️ Save now</button>' +
        '<button class="mka-secondary" type="button" data-go="pin">🔑 Change PIN</button>' +
        '<button class="mka-secondary" type="button" data-go="logout">👋 Log Out</button></div>';
    } else if (view === 'pin') {
      html += HERO + '<h2 class="mka-title" id="mkaTitle">Change PIN</h2>' +
        '<p class="mka-sub">Your other devices will need the new PIN.</p></div>' +
        '<form class="mka-form" novalidate>' +
        field('Current PIN', 'currentPin', pinAttrs('current-password')) +
        field('New PIN', 'newPin', pinAttrs('new-password'), '4–6 numbers') +
        '<p class="mka-error" role="alert"></p>' +
        '<button class="mka-primary" type="submit">Change PIN</button>' +
        '<button class="mka-link" type="button" data-go="account">Back</button></form>';
    } else if (view === 'logout') {
      html += HERO + '<h2 class="mka-title" id="mkaTitle">Log out?</h2>' +
        '<p class="mka-sub">We’ll save your progress to the cloud, then clear it from this device. ' +
        'Log in again any time to get it back.</p></div>' +
        '<p class="mka-error" role="alert"></p>' +
        '<div class="mka-actions"><button class="mka-primary" type="button" data-act="logout">Save & Log Out</button>' +
        '<button class="mka-link" type="button" data-go="account">Cancel</button></div>';
    } else if (view === 'logout-offline') {
      html += HERO + '<h2 class="mka-title" id="mkaTitle">Can’t save right now</h2>' +
        '<p class="mka-sub">The cloud isn’t reachable, so your newest progress isn’t saved yet. ' +
        'You can log out anyway — your progress stays on this device.</p></div>' +
        '<div class="mka-actions"><button class="mka-secondary" type="button" data-act="logout-force">Log Out & Keep Progress Here</button>' +
        '<button class="mka-link" type="button" data-go="account">Cancel</button></div>';
    } else if (view === 'conflict') {
      html += HERO + '<h2 class="mka-title" id="mkaTitle">Which save should we use?</h2>' +
        '<p class="mka-sub">This device and the cloud have different progress. The one you don’t pick will be replaced.</p></div>' +
        '<div class="mka-actions">' +
        '<button class="mka-choice" type="button" data-pick="cloud"><span class="mka-icon">☁️</span><span><b>Cloud save</b>' +
        '<span>Saved ' + esc(fmtDate(data.remote.updatedAt)) + (data.remote.device ? ' on ' + esc(data.remote.device) : '') + '</span></span></button>' +
        '<button class="mka-choice" type="button" data-pick="device"><span class="mka-icon">📱</span><span><b>This ' + esc(deviceLabel()) + '</b>' +
        '<span>The progress you have here now</span></span></button>' +
        '<button class="mka-link" type="button" data-pick="later">Decide later</button></div>';
    }
    html += '</div>';
    overlay.innerHTML = html;
    wireModal(view);
  }

  function wireModal(view) {
    var panel = overlay.firstChild;
    var close = panel.querySelector('.mka-close');
    if (close) close.addEventListener('click', closeModal);
    Array.prototype.forEach.call(panel.querySelectorAll('[data-go]'), function (b) {
      b.addEventListener('click', function () { renderModal(b.getAttribute('data-go')); });
    });
    Array.prototype.forEach.call(panel.querySelectorAll('[data-pick]'), function (b) {
      b.addEventListener('click', function () {
        var resolve = conflictResolve;
        conflictResolve = null;
        var pick = b.getAttribute('data-pick');
        closeModal();
        if (resolve) resolve(pick === 'later' ? null : pick);
      });
    });

    var errorEl = panel.querySelector('.mka-error');
    function showError(err) {
      if (!errorEl) return;
      var msg = err.message;
      if (err.code === 'locked' && err.data && err.data.retryAfterSec) {
        msg = 'Too many tries. Try again in ' + Math.ceil(err.data.retryAfterSec / 60) + ' min.';
      }
      errorEl.textContent = msg;
    }

    var syncBtn = panel.querySelector('[data-act="sync"]');
    if (syncBtn) syncBtn.addEventListener('click', function () { syncNow({ interactive: true }); });

    var logoutBtn = panel.querySelector('[data-act="logout"]');
    if (logoutBtn) logoutBtn.addEventListener('click', function () {
      logoutBtn.disabled = true;
      logoutBtn.textContent = 'Saving…';
      logout().then(function (result) {
        if (result === 'ok' || !overlay) return;
        if (result === 'offline' || result === 'error') renderModal('logout-offline');
        else renderModal('logout'); // conflict left undecided — stay put
      });
    });
    var forceBtn = panel.querySelector('[data-act="logout-force"]');
    if (forceBtn) forceBtn.addEventListener('click', function () { logout({ force: true }); });

    var form = panel.querySelector('form');
    if (form) {
      var first = form.querySelector('input');
      if (first) setTimeout(function () { first.focus(); }, 30);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = {};
        Array.prototype.forEach.call(form.querySelectorAll('input'), function (i) { v[i.name] = i.value.trim(); });
        var submit = form.querySelector('.mka-primary');
        submit.disabled = true;
        errorEl.textContent = '';
        var p;
        if (view === 'login') p = login(v.loginId, v.pin);
        else if (view === 'register') p = register(v);
        else p = changePin(v.currentPin, v.newPin).then(function () {
          renderModal('account');
          toast('PIN changed!');
        });
        p.catch(function (err) {
          if (handleAuthError(err)) return closeModal();
          showError(err);
        }).then(function () { submit.disabled = false; });
      });
    }
  }

  function chooseSave(remote, local) {
    return new Promise(function (resolve) {
      if (conflictResolve) conflictResolve(null);
      openModal('conflict', { remote: remote, local: local });
      conflictResolve = resolve;
    });
  }

  var toastEl = null;
  var toastTimer = null;
  function toast(msg) {
    if (mode !== 'full' || !document.body) return;
    injectStyle();
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'mka-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 2600);
  }

  // ---------- boot ----------

  function boot() {
    renderAll();
    if (mode === 'full') syncNow({ interactive: true });
  }

  if (enabled) {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushOnHide();
    });
    global.addEventListener('pagehide', flushOnHide);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  global.MokuAccount = {
    isEnabled: function () { return enabled; },
    getUser: getUser,
    getToken: getToken,
    getStatus: function () { return status; },
    onStatusChange: function (fn) { listeners.push(fn); },
    openLogin: function () { if (enabled) openModal(getUser() ? 'account' : 'login'); },
    syncNow: syncNow,
    logout: logout
  };
})(window);
