/**
 * Moku Series — player accounts + cloud save (SPEC.md §10).
 *
 * Include on a page:
 *   <script src="shared/moku-account.js"></script>
 *     Full mode (hub pages). Renders a Log In / account chip into every
 *     [data-moku-account] element. A button marked data-moku-account="nav"
 *     (e.g. a bottom-nav tab) keeps its own markup instead: the script
 *     enables it and fills its [data-moku-account-icon] and
 *     [data-moku-account-label] children. data-moku-account="wide" renders a
 *     full-width call-to-action card instead of the small chip (index.html);
 *     add data-moku-new-until="YYYY-MM-DD" to show a NEW pill until that day.
 *     The hub has a full "My Moku" page (window.MOKU_PROFILE_PAGE = { open,
 *     isOpen }). Account buttons open it there; other pages send logged-in
 *     players to hub.html#me and show guests the login form. The page owns
 *     its layout; this script fills these slots on it:
 *       [data-moku-name] / [data-moku-tag]   who is playing (guests keep the page's text)
 *       [data-moku-profile="account"]        cloud-save status + Save now / Change PIN /
 *                                            Log Out (/ Admin), or Log In for guests
 *       [data-moku-profile="players"]        everyone with an account (GET /players)
 *     Swaps the text of [data-moku-greeting]
 *     to "Hello, <name>!", and syncs progress with the cloud on load.
 *   <script src="shared/moku-account.js" data-mode="none"></script>
 *     admin.html. Nothing runs; only MokuAccount.apiBase() is used.
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
  // A merged save being uploaded (see keepMerged). Never synced (moku:sync:).
  var PENDING_KEY = 'moku:sync:pending';
  // Every save key the games use today. moku:deviceId stays per-device.
  var SYNC_PREFIXES = ['moku:', 'moku_', 'moyomoyo-', 'amoku-'];
  var NO_SYNC = ['moku:deviceId', 'moku:account:', 'moku:sync:'];
  // Written by the hub itself on every visit — doesn't count as "progress"
  // when deciding whether a fresh device has anything worth keeping.
  // moku:meta:saved-at maps each save key to when it last changed (stamped
  // at sync time). It travels with the save, so every device shows the same
  // "saved" times in the profile.
  var SAVED_AT_KEY = 'moku:meta:saved-at';
  var NOT_PROGRESS = ['moku:stats:streak', SAVED_AT_KEY];
  // The series-wide Moint wallet (shared/moku-moint.js). When both this
  // device and the cloud changed it, the two changes are added together.
  var WALLET_KEY = 'moku:moint:wallet';
  var CLOSET_KEY = 'moku:moint:closet';
  // Bookkeeping (visit streak, "last played" times, completed flags, the
  // Daily Bonus record): if both sides changed one, keep this device's —
  // nobody loses progress over these.
  var SOFT_PREFIXES = ['moku:stats:', 'moku:played:', 'moku:completed:', 'moku:meta:', 'moku:moint:daily'];
  var HEARTBEAT_MS = 2 * 60 * 1000; // keeps "online" in the players list fresh
  var PLAYERS_TTL_MS = 60 * 1000;
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

  // An expired token counts as logged out (same rule as shared/moku-gate.js,
  // so the gate and index.html never send the player back and forth).
  function tokenExpired(token) {
    try {
      var body = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
      var exp = JSON.parse(decodeURIComponent(escape(atob(body)))).exp;
      return typeof exp !== 'number' || exp * 1000 <= Date.now();
    } catch (e) {
      return true;
    }
  }
  function getToken() {
    var token = lsGet(TOKEN_KEY);
    return token && !tokenExpired(token) ? token : null;
  }
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

  // FNV-1a: cheap change detection, not security.
  function hashStr(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16) + ':' + str.length;
  }
  // Hash of the game data only: the saved-at stamps don't count, so two
  // copies of the same progress match even if they were stamped separately.
  function hashData(data) {
    var keys = Object.keys(data).filter(function (k) { return k !== SAVED_AT_KEY; }).sort();
    return hashStr(JSON.stringify(keys.map(function (k) { return [k, data[k]]; })));
  }
  function keyHashes(data) {
    var out = {};
    Object.keys(data).forEach(function (k) { if (k !== SAVED_AT_KEY) out[k] = hashStr(data[k]); });
    return out;
  }

  function getSyncState(user) {
    var st = readJson(SYNC_KEY);
    return st && user && st.lid === user.loginId ? st : null;
  }
  // `data` is what this device and the cloud now agree on; its per-key
  // hashes let the next sync tell which saves changed in between.
  function setSyncState(user, rev, data) {
    lsSet(SYNC_KEY, JSON.stringify({
      lid: user.loginId, rev: rev, hash: hashData(data), keys: keyHashes(data),
      wallet: data[WALLET_KEY] || null, at: new Date().toISOString()
    }));
  }

  function walletBalance(raw) {
    try { var w = JSON.parse(raw); return w && typeof w.balance === 'number' ? w.balance : null; } catch (e) { return null; }
  }
  // Moints earned or spent on this device since the last sync are added to
  // the cloud's balance, so playing on two devices never loses coins.
  function mergeWallet(localRaw, remoteRaw, baseRaw) {
    var l = walletBalance(localRaw), r = walletBalance(remoteRaw), b = walletBalance(baseRaw);
    if (l === null) return remoteRaw;
    if (r === null) return localRaw;
    var w = JSON.parse(remoteRaw);
    w.balance = Math.max(0, b === null ? Math.max(l, r) : r + (l - b));
    w.updatedAt = new Date().toISOString();
    return JSON.stringify(w);
  }
  // Moku Closet: keep every outfit bought on either device; wear this device's.
  function mergeCloset(localRaw, remoteRaw) {
    try {
      var l = JSON.parse(localRaw), r = JSON.parse(remoteRaw);
      (r.owned || []).forEach(function (id) { if (l.owned.indexOf(id) < 0) l.owned.push(id); });
      l.updatedAt = new Date().toISOString();
      return JSON.stringify(l);
    } catch (e) { return localRaw; }
  }
  function isSoftKey(key) {
    return SOFT_PREFIXES.some(function (p) { return key.indexOf(p) === 0; });
  }

  // "moku:moku-bridge:progress" → "Moku Bridge" (older key styles too).
  var LEGACY_GAMES = { 'amoku-': 'Angry Mokumoku', 'moyomoyo-': 'Moyomoyo', 'moku:save': 'Battle Royal',
    'moku_drop_': 'Moku Drop', 'moku_bento_': 'Moku Bento', 'moku_fishing_': 'Moku Fishing Pond',
    'moku_kart_': 'Moku Kart Dash', 'moku_rhythm_': 'Moku Rhythm Cafe', 'moku_wolf_': 'Moku Wolf', 'moku:mr:': 'Moku-rane' };
  // Which game a save key belongs to ("moku:moku-bridge:", "moku_kart_" …).
  // A game may spread one save over several keys (Moku Kart: bank, unlocked
  // karts, chosen kart), so a conflict is settled for the whole group.
  function saveGroup(key) {
    var legacy = Object.keys(LEGACY_GAMES).filter(function (p) { return key.indexOf(p) === 0; })[0];
    if (legacy) return legacy;
    var m = /^moku:([a-z0-9-]+):/.exec(key);
    return m ? 'moku:' + m[1] + ':' : key;
  }
  function gameNames(keys) {
    var names = [];
    keys.forEach(function (k) {
      var g = saveGroup(k);
      var m = /^moku:([a-z0-9-]+):$/.exec(g);
      var name = LEGACY_GAMES[g] ||
        (m ? m[1].split('-').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ') : null);
      if (name && names.indexOf(name) < 0) names.push(name);
    });
    return names;
  }

  // Three-way merge against what this device and the cloud last agreed on
  // (st.keys). A save changed on one side only is taken from that side; the
  // wallet and hub bookkeeping settle themselves; only a save changed on
  // both sides (the same game played on two devices) is a real conflict.
  // Returns { data, conflicts: [key], pickedLocal: { key: true } }.
  function mergeSaves(local, remote, st) {
    var base = st.keys || {};
    var data = {}, conflicts = [], pickedLocal = {};
    var seen = {};
    Object.keys(local).concat(Object.keys(remote)).forEach(function (k) {
      if (seen[k] || k === SAVED_AT_KEY) return;
      seen[k] = true;
      var l = local[k], r = remote[k];
      var localChanged = (l === undefined ? undefined : hashStr(l)) !== base[k];
      var remoteChanged = (r === undefined ? undefined : hashStr(r)) !== base[k];
      var v;
      if (!remoteChanged) { v = l; pickedLocal[k] = localChanged; }
      else if (!localChanged || l === r) v = r;
      else if (k === WALLET_KEY) {
        // No wallet at the last sync = it started at 0. A sync state saved
        // before balances were recorded (no st.wallet) can't tell → max.
        v = mergeWallet(l, r, base[k] === undefined ? '{"balance":0}' : st.wallet);
        pickedLocal[k] = true;
      }
      else if (k === CLOSET_KEY && l !== undefined && r !== undefined) { v = mergeCloset(l, r); pickedLocal[k] = true; }
      else if (isSoftKey(k)) { v = l !== undefined ? l : r; pickedLocal[k] = true; }
      else { conflicts.push(k); return; }
      if (v !== undefined) data[k] = v;
    });
    return { data: data, conflicts: conflicts, pickedLocal: pickedLocal };
  }

  function readSavedAt(data) {
    try { return JSON.parse((data || {})[SAVED_AT_KEY] || lsGet(SAVED_AT_KEY) || '{}') || {}; } catch (e) { return {}; }
  }

  // Stamps "now" on every save key that changed since the last sync (or
  // that has no stamp yet), writes the stamps back, and returns `local`
  // including them.
  function stampChanges(local, st) {
    var prev = st && st.keys;
    var stamps = readSavedAt(local);
    var now = new Date().toISOString();
    var changed = false;
    Object.keys(local).forEach(function (k) {
      if (k === SAVED_AT_KEY) return;
      if (prev ? prev[k] !== hashStr(local[k]) : !stamps[k]) {
        stamps[k] = now;
        changed = true;
      }
    });
    Object.keys(stamps).forEach(function (k) {
      if (!(k in local)) { delete stamps[k]; changed = true; }
    });
    if (changed) {
      local[SAVED_AT_KEY] = JSON.stringify(stamps);
      lsSet(SAVED_AT_KEY, local[SAVED_AT_KEY]);
    }
    return local;
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
      setSyncState(user, res.rev, data);
      return res;
    });
  }

  function adoptRemote(user, remote) {
    replaceLocal(remote.data);
    setSyncState(user, remote.rev, remote.data);
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
      var st = getSyncState(user);
      var local = collectLocal();
      var localHash = hashData(local);
      // Stamp just before uploading, so the stamps record real changes only.
      function send(baseRev) {
        return upload(user, stampChanges(local, st), baseRev).then(function () { return 'ok'; });
      }

      return api('GET', '/save').then(function (res) {
        var remote = res.save;
        var pending = readJson(PENDING_KEY);
        if (pending) {
          if (remote && pending.lid === user.loginId && remote.rev === pending.rev && hashData(remote.data) === pending.hash) {
            // Our last merged upload reached the cloud but its reply got lost.
            // Compare against the device save that merge was made from, so
            // nothing (Moints above all) is added a second time.
            st = { lid: pending.lid, rev: -1, hash: pending.localHash, keys: pending.keys, wallet: pending.wallet };
            lsSet(SYNC_KEY, JSON.stringify(st));
          }
          lsRemove(PENDING_KEY);
        }
        if (!remote) return send(0);

        var remoteHash = hashData(remote.data);
        if (remoteHash === localHash) {
          // Same progress (e.g. this device's own upload as the page closed):
          // take the cloud's stamps so every device shows the same times.
          if (remote.data[SAVED_AT_KEY]) lsSet(SAVED_AT_KEY, remote.data[SAVED_AT_KEY]);
          setSyncState(user, remote.rev, remote.data);
          return 'ok';
        }
        if (st && st.rev === remote.rev) {
          // Cloud unchanged since our last sync → our edits win.
          return send(remote.rev);
        }
        var localUntouched = st ? st.hash === localHash : !hasProgress(local);
        if (localUntouched) {
          adoptRemote(user, remote);
          return 'ok';
        }
        if (st) {
          // Both sides changed since the last sync: combine them instead of
          // making the player throw one side away.
          var merged = mergeSaves(local, remote.data, st);
          if (!merged.conflicts.length) return keepMerged(user, merged, local, remote, interactive);
          if (!interactive) return 'conflict';
          return chooseSave(remote, local, merged.conflicts).then(function (choice) {
            if (choice !== 'cloud' && choice !== 'device') return 'conflict';
            // The chosen side's save for each of these games, all of its keys
            // together, so e.g. a kart bought here never sticks to the
            // cloud's coin bank.
            var groups = {};
            merged.conflicts.forEach(function (k) { groups[saveGroup(k)] = true; });
            var picked = choice === 'cloud' ? remote.data : local;
            Object.keys(local).concat(Object.keys(remote.data)).forEach(function (k) {
              if (k === SAVED_AT_KEY || k === WALLET_KEY || !groups[saveGroup(k)]) return;
              if (picked[k] === undefined) delete merged.data[k];
              else merged.data[k] = picked[k];
              merged.pickedLocal[k] = choice === 'device';
            });
            return keepMerged(user, merged, local, remote, true);
          });
        }
        if (!interactive) return 'conflict';
        return chooseSave(remote, local).then(function (choice) {
          if (choice === 'cloud') {
            adoptRemote(user, remote);
            return 'ok';
          }
          if (choice === 'device') return send(remote.rev);
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

  // Uploads a merged save, then puts it on this device. Nothing local is
  // written until the cloud has it, so a failed try can simply run again
  // (re-merging a half-written result would count Moints twice).
  function keepMerged(user, merged, local, remote, interactive) {
    var data = merged.data;
    var changesHere = Object.keys(data).some(function (k) { return data[k] !== local[k]; }) ||
      Object.keys(local).some(function (k) { return k !== SAVED_AT_KEY && !(k in data); });
    // Pages read localStorage once on load; only the hub (interactive) may
    // rewrite it and reload. Background calls leave it for the next visit.
    if (changesHere && !interactive) return Promise.resolve('conflict');
    // "Saved at" stamps: the cloud's, plus "now" for what this device adds.
    var stamps = readSavedAt(remote.data);
    var now = new Date().toISOString();
    Object.keys(stamps).forEach(function (k) { if (!(k in data)) delete stamps[k]; });
    Object.keys(data).forEach(function (k) { if (merged.pickedLocal[k] || !stamps[k]) stamps[k] = now; });
    data[SAVED_AT_KEY] = JSON.stringify(stamps);
    // If the upload lands but its reply is lost, the next sync can tell from
    // this record and won't merge the same changes again.
    lsSet(PENDING_KEY, JSON.stringify({
      lid: user.loginId, rev: remote.rev + 1, hash: hashData(data),
      localHash: hashData(local), keys: keyHashes(local), wallet: local[WALLET_KEY] || null
    }));
    return upload(user, data, remote.rev).then(function () {
      lsRemove(PENDING_KEY);
      if (changesHere) {
        replaceLocal(data);
        location.reload();
      } else {
        lsSet(SAVED_AT_KEY, data[SAVED_AT_KEY]);
      }
      return 'ok';
    });
  }

  // Best-effort upload when the page goes away. Only when this device is
  // known to be up to date with the cloud — anything trickier waits for
  // the next hub visit, which can ask the player.
  function flushOnHide() {
    var user = getUser();
    var st = getSyncState(user);
    if (!enabled || !user || !st || running) return;
    var local = collectLocal();
    if (hashData(local) === st.hash) return;
    stampChanges(local, st);
    var body = JSON.stringify({ data: local, baseRev: st.rev, device: deviceLabel() });
    if (body.length > KEEPALIVE_MAX_BYTES) return;
    api('PUT', '/save', { data: local, baseRev: st.rev, device: deviceLabel() }, { keepalive: true })
      .then(function (res) { setSyncState(user, res.rev, local); })
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
      lsRemove(PENDING_KEY);
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
    '.mka-avatar-wrap{position:relative;display:inline-flex}',
    '.mka-avatar-wrap .mka-avatar{width:20px;height:20px;font-size:11px}',
    '.mka-avatar-wrap .mka-dot{position:absolute;right:-2px;bottom:-1px;box-shadow:0 0 0 2px rgba(12,13,22,0.95)}',
    '.mka-nav-label{max-width:76px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mka-section{margin-top:18px}',
    '.mka-section-h{display:flex;align-items:baseline;justify-content:space-between;margin:0 2px 8px;',
    'font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:rgba(237,238,246,0.6)}',
    '.mka-section-h small{font-size:12px;letter-spacing:0;text-transform:none;font-weight:700;color:#6EE7A8}',
    '.mka-list{display:flex;flex-direction:column;gap:2px;padding:4px;border-radius:14px;',
    'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)}',
    '.mka-row{display:flex;align-items:center;gap:11px;padding:8px;border-radius:10px;min-width:0}',
    '.mka-row + .mka-row{border-top:1px solid rgba(255,255,255,0.05)}',
    '.mka-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
    '.mka-row-main b{font-size:14px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mka-row-main span{font-size:12px;font-weight:600;color:rgba(237,238,246,0.62);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mka-row-side{flex:none;font-size:11.5px;font-weight:700;color:rgba(237,238,246,0.5);text-align:right}',
    '.mka-row-side.is-online{color:#6EE7A8}',
    '.mka-row .mka-avatar{width:32px;height:32px;font-size:14px}',
    '.mka-you{margin-left:6px;font-size:10px;font-weight:800;letter-spacing:0.06em;color:#10121E;background:#6EE7A8;',
    'padding:2px 6px;border-radius:999px;vertical-align:2px}',
    '.mka-empty{padding:12px;font-size:13px;font-weight:600;color:rgba(237,238,246,0.55);text-align:center}',
    '.mka-more{display:block;margin:6px auto 0}',
    'a.mka-secondary{display:flex;align-items:center;justify-content:center;text-decoration:none}',
    '.mka-wide{position:relative;display:flex;align-items:center;gap:14px;width:100%;max-width:380px;margin:0 auto;',
    'padding:14px 18px;border-radius:20px;overflow:hidden;text-align:left;cursor:pointer;font:inherit;color:#EDEEF6;',
    'border:1.5px solid rgba(255,201,74,0.55);background:linear-gradient(135deg,rgba(255,201,74,0.16),rgba(110,231,168,0.12));',
    'box-shadow:0 0 26px rgba(255,201,74,0.22),0 8px 22px rgba(0,0,0,0.3);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);',
    '-webkit-tap-highlight-color:transparent;transition:transform .15s,box-shadow .15s,border-color .15s}',
    '.mka-wide:hover,.mka-wide:focus-visible{outline:none;border-color:#FFC94A;box-shadow:0 0 34px rgba(255,201,74,0.38),0 8px 22px rgba(0,0,0,0.3)}',
    '.mka-wide:active{transform:translateY(1px) scale(.99)}',
    '.mka-wide::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:40%;pointer-events:none;',
    'background:linear-gradient(100deg,transparent,rgba(255,255,255,0.18),transparent);animation:mka-shine 4.5s ease-in-out infinite}',
    '@keyframes mka-shine{0%,55%{left:-60%}100%{left:130%}}',
    '.mka-wide.is-in{border-color:rgba(110,231,168,0.45);background:rgba(255,255,255,0.07);box-shadow:0 8px 22px rgba(0,0,0,0.3)}',
    '.mka-wide.is-in::after{display:none}',
    '.mka-wide-icon{flex:none;width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;',
    'font-size:24px;background:rgba(255,255,255,0.1)}',
    '.mka-wide .mka-avatar{width:44px;height:44px;font-size:20px}',
    '.mka-wide-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}',
    '.mka-wide-title{display:flex;align-items:center;gap:8px;font-size:17px;font-weight:800;letter-spacing:0.01em}',
    '.mka-wide-title span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mka-wide-sub{font-size:12.5px;font-weight:600;color:rgba(237,238,246,0.7);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mka-new{flex:none;font-style:normal;font-size:10px;font-weight:800;letter-spacing:0.08em;background:#FFF4D6;color:#7A4A00;padding:3px 8px;border-radius:999px}',
    '.mka-wide-arrow{flex:none;font-size:22px;font-weight:700;color:rgba(237,238,246,0.55)}',
    '@media (prefers-reduced-motion:reduce){.mka-wide::after{animation:none;display:none}}',
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
    '.mka-status{display:flex;align-items:center;gap:8px}',
    '.mka-status .mka-dot{flex:none}',
    '.mka-profile-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.mka-profile-actions .mka-secondary{height:42px;font-size:14px;padding:0 8px}',
    '.mka-profile-actions .is-wide{grid-column:1/-1}',
    '.mka-id{margin:10px 2px 0;font-size:11.5px;font-weight:600;color:rgba(237,238,246,0.45);text-align:center}',
    '.mka-actions{display:flex;flex-direction:column;gap:10px}',
    '.mka-choice{display:flex;align-items:center;gap:12px;width:100%;padding:14px;border-radius:14px;text-align:left;',
    'border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);color:#EDEEF6;font:inherit;cursor:pointer}',
    '.mka-choice:hover,.mka-choice:focus-visible{border-color:#6EE7A8;background:rgba(110,231,168,0.08);outline:none}',
    '.mka-choice .mka-icon{font-size:26px;flex:none}',
    '.mka-choice b{display:block;font-size:15px;font-weight:800}',
    '.mka-choice span span{display:block;margin-top:2px;font-size:12.5px;font-weight:600;color:rgba(237,238,246,0.6)}',
    '.mka-toast{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 86px);z-index:9100;transform:translate(-50%,20px);',
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

  function relTime(iso) {
    var t = Date.parse(iso || '');
    if (!t) return '';
    var min = Math.floor((Date.now() - t) / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return min + ' min ago';
    if (min < 24 * 60) return Math.floor(min / 60) + ' h ago';
    if (min < 48 * 60) return 'Yesterday';
    return fmtDate(iso).split(',')[0];
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

  // Full-width call to action (index.html). Logged out it advertises the
  // feature; logged in it shows who is playing and the cloud-save status.
  function renderWideButton(slot, user) {
    var until = slot.getAttribute('data-moku-new-until');
    var isNew = !user && until && new Date() < new Date(until + 'T23:59:59');
    slot.innerHTML = user
      ? '<button class="mka-wide is-in" type="button" aria-label="Account: ' + esc(user.displayName) + '">' +
        '<span class="mka-avatar-wrap"><span class="mka-avatar">' + esc(Array.from(user.displayName)[0] || '?') + '</span>' +
        '<span class="mka-dot" data-status="' + status + '"></span></span>' +
        '<span class="mka-wide-text"><span class="mka-wide-title"><span>' + esc(user.displayName) + '</span></span>' +
        '<span class="mka-wide-sub">' + esc(statusText()) + '</span></span>' +
        '<span class="mka-wide-arrow" aria-hidden="true">›</span></button>'
      : '<button class="mka-wide" type="button">' +
        '<span class="mka-wide-icon" aria-hidden="true">☁️</span>' +
        '<span class="mka-wide-text"><span class="mka-wide-title"><span>Log In</span>' +
        (isNew ? '<em class="mka-new">NEW</em>' : '') + '</span>' +
        '<span class="mka-wide-sub">Log in to play · saved on every device</span></span>' +
        '<span class="mka-wide-arrow" aria-hidden="true">›</span></button>';
    slot.firstChild.addEventListener('click', openProfile);
  }

  // A page-owned button (the hub's bottom-nav Profile tab). It ships
  // disabled as "Coming soon", so it stays that way when accounts are off.
  function renderNavButton(btn, user) {
    btn.disabled = false;
    btn.removeAttribute('title');
    btn.setAttribute('aria-label', user ? 'Account: ' + user.displayName : 'Log In');
    var icon = btn.querySelector('[data-moku-account-icon]');
    var label = btn.querySelector('[data-moku-account-label]');
    if (icon) {
      icon.innerHTML = user
        ? '<span class="mka-avatar-wrap"><span class="mka-avatar">' + esc(Array.from(user.displayName)[0] || '?') + '</span>' +
          '<span class="mka-dot" data-status="' + status + '"></span></span>'
        : '👤';
    }
    if (label) {
      label.classList.add('mka-nav-label');
      label.textContent = user ? user.displayName : 'Log In';
    }
    if (!btn.__mokuAccount) {
      btn.__mokuAccount = true;
      btn.addEventListener('click', openProfile);
    }
  }

  function renderAll() {
    if (mode !== 'full' || !enabled || !document.body) return;
    injectStyle();
    var user = getUser();

    Array.prototype.forEach.call(document.querySelectorAll('[data-moku-account]'), function (slot) {
      var kind = slot.getAttribute('data-moku-account');
      if (kind === 'nav') return renderNavButton(slot, user);
      if (kind === 'wide') return renderWideButton(slot, user);
      slot.innerHTML = user
        ? '<button class="mka-chip" type="button" aria-label="Account: ' + esc(user.displayName) + '">' +
          '<span class="mka-avatar" aria-hidden="true">' + esc(Array.from(user.displayName)[0] || '?') + '</span>' +
          '<span class="mka-name">' + esc(user.displayName) + '</span>' +
          '<span class="mka-dot" data-status="' + status + '" aria-hidden="true"></span></button>'
        : '<button class="mka-chip" type="button"><span aria-hidden="true">👤</span>Log In</button>';
      slot.firstChild.addEventListener('click', openProfile);
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-moku-greeting]'), function (el) {
      if (greetingDefaults && !greetingDefaults.has(el)) greetingDefaults.set(el, el.textContent);
      if (user) el.textContent = 'Hello, ' + user.displayName + '!';
      else if (greetingDefaults) el.textContent = greetingDefaults.get(el);
    });

    renderProfile();
  }

  // The player's own page: the hub's "My Moku" page when there is one.
  // Elsewhere logged-in players go to it; guests get the login form.
  function openProfile() {
    var page = global.MOKU_PROFILE_PAGE;
    if (page) page.open();
    else if (getUser()) location.href = 'hub.html#me';
    else openModal('login');
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
    // "Back" from Change PIN / Log Out returns to the player's page.
    if (view === 'account') {
      closeModal();
      if (global.MOKU_PROFILE_PAGE) renderProfile();
      else if (getUser()) location.href = 'hub.html#me';
      return;
    }
    modalView = view;
    var user = getUser();
    var html = '<div class="mka-panel" role="dialog" aria-modal="true" aria-labelledby="mkaTitle">';
    if (view !== 'conflict') html += '<button class="mka-close" type="button" aria-label="Close">×</button>';

    if (view === 'login' || view === 'register') {
      var isLogin = view === 'login';
      html += HERO + '<h2 class="mka-title" id="mkaTitle">' + (isLogin ? 'Welcome back!' : 'Join Moku Series') + '</h2>' +
        '<p class="mka-sub">' + (isLogin
          ? 'Log in to play. Your progress is saved on every device.'
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
      var games = data.games && data.games.length ? data.games : null;
      html += HERO + '<h2 class="mka-title" id="mkaTitle">Which save should we use?</h2>' +
        (games
          ? '<p class="mka-sub">You played <b>' + esc(games.join(', ')) + '</b> here and on another device. ' +
            'Everything else is already saved together. Pick which progress to keep for ' + (games.length > 1 ? 'these games' : 'this game') + '.</p></div>'
          : '<p class="mka-sub">This device and the cloud have different progress. The one you don’t pick will be replaced.</p></div>') +
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
      // Don't steal focus if the player already tapped into another field.
      if (first) setTimeout(function () { if (!form.contains(document.activeElement)) first.focus(); }, 30);
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

  // ---------- "My Moku" page: account box + players ----------

  var expanded = {};
  var LIST_PREVIEW = 5;

  function moreButton(name, total) {
    if (expanded[name] || total <= LIST_PREVIEW) return '';
    return '<button class="mka-link mka-more" type="button" data-more="' + name + '">Show all (' + total + ')</button>';
  }

  // { at, players } | { at, hidden: true } (failed; retried after the TTL)
  // | { unsupported: true } (backend has no /players) | null (not loaded yet)
  var playersCache = null;
  var playersLoading = false;

  function loadPlayers() {
    if (playersLoading || (playersCache && (playersCache.unsupported || Date.now() - playersCache.at < PLAYERS_TTL_MS))) return;
    var hadList = !!(playersCache && playersCache.players);
    playersLoading = true;
    api('GET', '/players').then(function (res) {
      playersCache = { at: Date.now(), players: res.players || [] };
    }, function (err) {
      if (handleAuthError(err)) return;
      // Older backend without /players: leave the section out. Other
      // failures (offline …) keep the last list, or hide the section, until
      // the next try after the TTL.
      if (err.status === 404) playersCache = { unsupported: true };
      else if (hadList) playersCache.at = Date.now();
      else playersCache = { at: Date.now(), hidden: true };
    }).then(function () {
      playersLoading = false;
      if (playersCache) renderProfile();
    });
  }

  function playersSection() {
    if (playersCache && (playersCache.unsupported || playersCache.hidden)) return '';
    var head = '<div class="mka-section"><h3 class="mka-section-h">Players';
    if (!playersCache) return head + '</h3><div class="mka-list"><div class="mka-empty">Loading…</div></div></div>';
    var players = playersCache.players;
    var online = players.filter(function (p) { return p.online; }).length;
    var shown = expanded.players ? players : players.slice(0, LIST_PREVIEW);
    return head + ' <small>' + online + ' online</small></h3><div class="mka-list">' + shown.map(function (p) {
      return '<div class="mka-row">' +
        '<span class="mka-avatar-wrap"><span class="mka-avatar">' + esc(Array.from(p.displayName)[0] || '?') + '</span>' +
        (p.online ? '<span class="mka-dot" data-status="ok"></span>' : '') + '</span>' +
        '<span class="mka-row-main"><b>' + esc(p.displayName) + (p.you ? '<em class="mka-you">YOU</em>' : '') + '</b>' +
        '<span>#' + esc(p.tag) + '</span></span>' +
        '<span class="mka-row-side' + (p.online ? ' is-online' : '') + '">' +
        (p.online ? '● Online' : esc(p.lastSeenAt ? relTime(p.lastSeenAt) : '')) + '</span></div>';
    }).join('') + '</div>' + moreButton('players', players.length) + '</div>';
  }

  function profileOpen() {
    var page = global.MOKU_PROFILE_PAGE;
    return !!(page && page.isOpen && page.isOpen());
  }

  var nameDefaults = typeof WeakMap === 'function' ? new WeakMap() : null;

  // Fills the "My Moku" page slots (see the header). Safe to call any time.
  function renderProfile() {
    if (mode !== 'full' || !document.body) return;
    var user = enabled ? getUser() : null;
    Array.prototype.forEach.call(document.querySelectorAll('[data-moku-name]'), function (el) {
      if (nameDefaults && !nameDefaults.has(el)) nameDefaults.set(el, el.textContent);
      if (user) el.textContent = user.displayName;
      else if (nameDefaults) el.textContent = nameDefaults.get(el);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-moku-tag]'), function (el) {
      el.textContent = user ? '#' + user.tag : '';
      el.hidden = !user;
    });
    if (!enabled) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-moku-profile]'), function (el) { el.hidden = true; });
      return;
    }
    injectStyle();
    Array.prototype.forEach.call(document.querySelectorAll('[data-moku-profile="account"]'), function (el) {
      el.hidden = false;
      el.innerHTML = user
        ? '<div class="mka-meta"><span class="mka-status"><span class="mka-dot" data-status="' + status + '"></span>' + esc(statusText()) + '</span></div>' +
          '<div class="mka-profile-actions">' +
          '<button class="mka-secondary is-wide" type="button" data-act="sync">☁️ Save now</button>' +
          '<button class="mka-secondary" type="button" data-go="pin">🔑 Change PIN</button>' +
          '<button class="mka-secondary" type="button" data-go="logout">👋 Log Out</button>' +
          (user.admin ? '<a class="mka-secondary is-wide" href="admin.html">🛠 Admin</a>' : '') + '</div>' +
          '<p class="mka-id">Player ID: ' + esc(user.loginId) + ' · keep it secret</p>'
        : '<button class="mka-wide" type="button" data-act="login">' +
          '<span class="mka-wide-icon" aria-hidden="true">☁️</span>' +
          '<span class="mka-wide-text"><span class="mka-wide-title"><span>Log In</span></span>' +
          '<span class="mka-wide-sub">Save your Moku on every device</span></span>' +
          '<span class="mka-wide-arrow" aria-hidden="true">›</span></button>';
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-moku-profile="players"]'), function (el) {
      var html = user ? playersSection() : '';
      el.innerHTML = html;
      el.hidden = !html;
    });
    if (user && profileOpen()) loadPlayers();
  }

  if (mode === 'full') {
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-moku-profile] [data-act],[data-moku-profile] [data-go],[data-moku-profile] [data-more]') : null;
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'sync') syncNow({ interactive: true });
      else if (act === 'login') openModal('login');
      else if (b.hasAttribute('data-go')) openModal(b.getAttribute('data-go'));
      else if (b.hasAttribute('data-more')) {
        expanded[b.getAttribute('data-more')] = true;
        renderProfile();
      }
    });
  }

  // `keys` (optional) = the saves changed on both sides; everything else is
  // already combined, so the question is only about these games.
  function chooseSave(remote, local, keys) {
    return new Promise(function (resolve) {
      if (conflictResolve) conflictResolve(null);
      openModal('conflict', { remote: remote, local: local, games: keys ? gameNames(keys) : null });
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
    if (mode === 'full') {
      syncNow({ interactive: true });
    }
  }

  // Tells the server this player is still around (GET /players "online").
  // Also picks up a rename by the admin: the server sends a fresh token then.
  function heartbeat() {
    if (!getUser() || document.visibilityState !== 'visible') return;
    api('GET', '/auth/me').then(function (res) {
      if (res.token) {
        setSession(res.token, res.user);
        renderAll();
      }
    }, handleAuthError);
  }

  if (enabled && mode !== 'none') {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushOnHide();
    });
    global.addEventListener('pagehide', flushOnHide);
    setInterval(heartbeat, HEARTBEAT_MS);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  global.MokuAccount = {
    isEnabled: function () { return enabled; },
    apiBase: function () { return base; },
    getUser: getUser,
    getToken: getToken,
    getStatus: function () { return status; },
    statusText: statusText,
    getSavedAt: function () { return readSavedAt(); },
    onStatusChange: function (fn) { listeners.push(fn); },
    openLogin: function () { if (enabled) openModal('login'); },
    renderProfile: renderProfile,
    syncNow: syncNow,
    logout: logout
  };
})(window);
