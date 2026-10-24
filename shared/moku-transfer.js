/**
 * Moku Series — transfer code (SPEC.md §11).
 *
 * Moves a player's progress to another device with no server and no
 * account: "Send" packs every Moku localStorage key into one text code,
 * "Receive" on the other device unpacks it and replaces that device's
 * progress. The code travels however the family likes — copy & paste,
 * the share sheet (AirDrop, LINE, Messages …) or a saved file.
 *
 * Include on a page and give any button the data-moku-transfer attribute:
 *   <script src="shared/moku-transfer.js"></script>
 *   <button type="button" data-moku-transfer>🔁 Transfer Progress</button>
 *
 * Code format: "MOKU1-" + base64url(zlib-deflate(JSON)), or "MOKU0-" +
 * base64url(JSON) on browsers without CompressionStream. The JSON is
 * { v: 1, at, device, data: { "<key>": "<value>", … } }. zlib's checksum
 * catches a code that got cut off or mangled while pasting.
 */
(function (global) {
  'use strict';

  // Same key selection as shared/moku-account.js (cloud save) — keep in sync.
  var SYNC_PREFIXES = ['moku:', 'moku_', 'moyomoyo-', 'amoku-'];
  var NO_SYNC = ['moku:deviceId', 'moku:account:', 'moku:sync:'];
  // Written by the hub on every visit; not "progress" on its own.
  var NOT_PROGRESS = ['moku:stats:streak'];

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

  function progressCount(data) {
    return Object.keys(data).filter(function (k) { return NOT_PROGRESS.indexOf(k) < 0; }).length;
  }

  // Replaces this device's Moku progress with `data`.
  function replaceLocal(data) {
    try {
      Object.keys(collectLocal()).forEach(function (k) { if (!(k in data)) localStorage.removeItem(k); });
      Object.keys(data).forEach(function (k) { localStorage.setItem(k, data[k]); });
    } catch (e) {
      throw new Error("Couldn't save on this device. Is private browsing on?");
    }
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

  // ---------- encoding ----------

  var canCompress = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

  function streamBytes(bytes, stream) {
    var piped = new Blob([bytes]).stream().pipeThrough(stream);
    return new Response(piped).arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
  }

  function toBase64Url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(text) {
    var b64 = text.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function encode(payload) {
    var bytes = new TextEncoder().encode(JSON.stringify(payload));
    if (!canCompress) return Promise.resolve('MOKU0-' + toBase64Url(bytes));
    return streamBytes(bytes, new CompressionStream('deflate')).then(function (z) {
      return 'MOKU1-' + toBase64Url(z);
    });
  }

  // Errors meant for the player carry `friendly`; anything else (bad
  // base64, zlib checksum, JSON) is reported as a broken code.
  function friendly(message) {
    var err = new Error(message);
    err.friendly = true;
    return err;
  }
  function badCode() {
    return friendly("That code doesn't look right. Copy the whole code and try again.");
  }

  // Resolves to { at, device, data } with only Moku save keys and string values.
  function decode(code) {
    var clean = String(code || '').replace(/\s+/g, '');
    var m = /^MOKU([01])-([A-Za-z0-9_-]+)$/.exec(clean);
    if (!m) return Promise.reject(badCode());
    var bytes;
    try { bytes = fromBase64Url(m[2]); } catch (e) { return Promise.reject(badCode()); }

    var unpack;
    if (m[1] === '0') unpack = Promise.resolve(bytes);
    else if (!canCompress) return Promise.reject(friendly('This browser is too old to read the code. Please update it.'));
    else unpack = streamBytes(bytes, new DecompressionStream('deflate'));

    return unpack.then(function (raw) {
      var payload = JSON.parse(new TextDecoder().decode(raw));
      if (!payload || payload.v !== 1 || !payload.data || typeof payload.data !== 'object') throw badCode();
      // Never let a code write anything but Moku save data (e.g. a login token).
      var data = {};
      Object.keys(payload.data).forEach(function (k) {
        if (isSyncKey(k) && typeof payload.data[k] === 'string') data[k] = payload.data[k];
      });
      return { at: payload.at, device: payload.device, data: data };
    }).catch(function (err) {
      throw err && err.friendly ? err : badCode();
    });
  }

  function exportCode() {
    return encode({ v: 1, at: new Date().toISOString(), device: deviceLabel(), data: collectLocal() });
  }

  // ---------- UI ----------

  var CSS = [
    '.mkt-overlay{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;',
    'padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));',
    'background:rgba(5,6,12,0.62);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:mkt-fade .18s ease}',
    '.mkt-panel{position:relative;width:100%;max-width:380px;max-height:100%;overflow:auto;padding:24px 22px 20px;',
    'border-radius:20px;background:linear-gradient(180deg,#1A1D30,#10121E);border:1px solid rgba(255,255,255,0.12);',
    'box-shadow:0 18px 50px rgba(0,0,0,0.5);color:#EDEEF6;font-family:-apple-system,"Segoe UI",Roboto,sans-serif;',
    'text-align:left;animation:mkt-pop .22s cubic-bezier(.2,1.3,.4,1)}',
    '@keyframes mkt-fade{from{opacity:0}}',
    '@keyframes mkt-pop{from{transform:translateY(10px) scale(.97);opacity:0}}',
    '.mkt-close{position:absolute;top:10px;right:10px;width:34px;height:34px;border:0;border-radius:50%;',
    'background:transparent;color:rgba(237,238,246,0.55);font-size:20px;cursor:pointer}',
    '.mkt-close:hover{background:rgba(255,255,255,0.08);color:#EDEEF6}',
    '.mkt-hero{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:16px;text-align:center}',
    '.mkt-hero .mkt-emoji{font-size:40px;line-height:1}',
    '.mkt-title{margin:0;font-size:20px;font-weight:800;letter-spacing:0.02em}',
    '.mkt-sub{margin:0;font-size:13px;color:rgba(237,238,246,0.6);font-weight:600;line-height:1.45}',
    '.mkt-actions{display:flex;flex-direction:column;gap:10px}',
    '.mkt-choice{display:flex;align-items:center;gap:12px;width:100%;padding:14px;border-radius:14px;text-align:left;',
    'border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);color:#EDEEF6;font:inherit;cursor:pointer}',
    '.mkt-choice:hover,.mkt-choice:focus-visible{border-color:#6EE7A8;background:rgba(110,231,168,0.08);outline:none}',
    '.mkt-choice .mkt-icon{font-size:26px;flex:none}',
    '.mkt-choice b{display:block;font-size:15px;font-weight:800}',
    '.mkt-choice span span{display:block;margin-top:2px;font-size:12.5px;font-weight:600;color:rgba(237,238,246,0.6)}',
    '.mkt-code{width:100%;height:96px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,0.14);',
    'background:rgba(0,0,0,0.25);color:#EDEEF6;font:600 12px/1.4 ui-monospace,Menlo,Consolas,monospace;',
    'resize:none;outline:none;word-break:break-all;box-sizing:border-box}',
    '.mkt-code:focus{border-color:#6EE7A8;box-shadow:0 0 0 3px rgba(110,231,168,0.18)}',
    '.mkt-meta{margin:8px 0 14px;font-size:12px;font-weight:700;color:rgba(237,238,246,0.5)}',
    '.mkt-note{margin:0 0 14px;padding:10px 12px;border-radius:12px;background:rgba(255,201,74,0.08);',
    'border:1px solid rgba(255,201,74,0.28);font-size:12.5px;font-weight:600;line-height:1.45;color:rgba(255,236,190,0.9)}',
    '.mkt-error{min-height:18px;margin:8px 0;font-size:13px;font-weight:700;color:#FF8A8A}',
    '.mkt-primary,.mkt-secondary{height:48px;border-radius:14px;font:inherit;font-size:15.5px;font-weight:800;cursor:pointer;',
    'letter-spacing:0.02em;transition:transform .1s,filter .15s;width:100%}',
    '.mkt-primary{border:0;background:linear-gradient(180deg,#7EF0B4,#3FBF85);color:#0E1A14;box-shadow:0 6px 18px rgba(63,191,133,0.3)}',
    '.mkt-primary:active,.mkt-secondary:active{transform:scale(.98)}',
    '.mkt-primary:disabled{filter:grayscale(.6) brightness(.8);cursor:wait}',
    '.mkt-secondary{border:1px solid rgba(255,255,255,0.16);background:rgba(255,255,255,0.06);color:#EDEEF6}',
    '.mkt-secondary:hover{background:rgba(255,255,255,0.11)}',
    '.mkt-link{border:0;background:none;color:rgba(237,238,246,0.55);font:inherit;font-size:12.5px;font-weight:700;',
    'cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:6px}'
  ].join('');

  var styleInjected = false;
  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    var el = document.createElement('style');
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  var overlay = null;

  function close() {
    if (overlay) overlay.remove();
    overlay = null;
  }

  function open() {
    injectStyle();
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'mkt-overlay';
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
      document.body.appendChild(overlay);
    }
    render('home');
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay) close();
  });

  function hero(emoji, title, sub) {
    return '<div class="mkt-hero"><span class="mkt-emoji" aria-hidden="true">' + emoji + '</span>' +
      '<h2 class="mkt-title" id="mktTitle">' + title + '</h2>' + (sub ? '<p class="mkt-sub">' + sub + '</p>' : '') + '</div>';
  }

  function show(html) {
    overlay.innerHTML = '<div class="mkt-panel" role="dialog" aria-modal="true" aria-labelledby="mktTitle">' +
      '<button class="mkt-close" type="button" aria-label="Close">×</button>' + html + '</div>';
    var panel = overlay.firstChild;
    panel.querySelector('.mkt-close').addEventListener('click', close);
    Array.prototype.forEach.call(panel.querySelectorAll('[data-go]'), function (b) {
      b.addEventListener('click', function () { render(b.getAttribute('data-go')); });
    });
    return panel;
  }

  function loggedIn() {
    return !!(global.MokuAccount && global.MokuAccount.isEnabled() && global.MokuAccount.getUser());
  }

  function render(view, info) {
    var panel;
    if (view === 'home') {
      show(hero('🔁', 'Transfer Progress', 'Move your games to another phone, tablet or computer.') +
        (loggedIn() ? '<p class="mkt-note">You’re logged in, so your progress already saves to the cloud. ' +
          'Just log in on the other device!</p>' : '') +
        '<div class="mkt-actions">' +
        '<button class="mkt-choice" type="button" data-go="send"><span class="mkt-icon">📤</span>' +
        '<span><b>Send from this device</b><span>Make a code with your progress</span></span></button>' +
        '<button class="mkt-choice" type="button" data-go="receive"><span class="mkt-icon">📥</span>' +
        '<span><b>Receive on this device</b><span>Paste a code to load progress</span></span></button></div>');
      return;
    }

    if (view === 'send') {
      if (!progressCount(collectLocal())) {
        show(hero('🐣', 'Nothing to send yet', 'Play a game first, then come back!') +
          '<button class="mkt-link" type="button" data-go="home">Back</button>');
        return;
      }
      panel = show(hero('📤', 'Your transfer code', 'Send this code to your other device, then choose ' +
          '<b>Receive</b> there.') +
        '<textarea class="mkt-code" readonly aria-label="Transfer code">Making your code…</textarea>' +
        '<p class="mkt-meta"></p>' +
        '<p class="mkt-note">🔒 Anyone with this code can copy your progress. Only send it to yourself or your family.</p>' +
        '<div class="mkt-actions">' +
        '<button class="mkt-primary" type="button" data-act="copy" disabled>Copy Code</button>' +
        (navigator.share ? '<button class="mkt-secondary" type="button" data-act="share" disabled>Share…</button>' : '') +
        '<button class="mkt-secondary" type="button" data-act="file" disabled>Save as File</button>' +
        '<button class="mkt-link" type="button" data-go="home">Back</button></div>');
      exportCode().then(function (code) {
        if (!overlay || !panel.isConnected) return;
        var box = panel.querySelector('.mkt-code');
        box.value = code;
        panel.querySelector('.mkt-meta').textContent = code.length.toLocaleString() + ' characters · ' +
          progressCount(collectLocal()) + ' saves';
        Array.prototype.forEach.call(panel.querySelectorAll('[data-act]'), function (b) { b.disabled = false; });
        wireSend(panel, code);
      }, function () {
        panel.querySelector('.mkt-code').value = '';
        panel.querySelector('.mkt-meta').textContent = 'Sorry, the code could not be made on this browser.';
      });
      return;
    }

    if (view === 'receive') {
      panel = show(hero('📥', 'Receive progress', 'Paste the code from your other device.') +
        '<textarea class="mkt-code" aria-label="Transfer code" placeholder="MOKU1-…" ' +
        'autocapitalize="off" autocorrect="off" spellcheck="false"></textarea>' +
        '<p class="mkt-error" role="alert"></p>' +
        '<div class="mkt-actions">' +
        '<button class="mkt-primary" type="button" data-act="check">Next</button>' +
        '<button class="mkt-secondary" type="button" data-act="open">Open a Saved File</button>' +
        '<input type="file" accept=".txt,text/plain" hidden>' +
        '<button class="mkt-link" type="button" data-go="home">Back</button></div>');
      wireReceive(panel);
      return;
    }

    if (view === 'confirm') {
      var when = fmtDate(info.at);
      panel = show(hero('⚠️', 'Replace progress here?', 'The progress on this device will be replaced by the code’s progress.') +
        '<p class="mkt-note">From: <b>' + esc(info.device || 'another device') + '</b>' +
        (when ? ' · made ' + esc(when) : '') + '<br>' + progressCount(info.data) + ' saves</p>' +
        '<p class="mkt-error" role="alert"></p>' +
        '<div class="mkt-actions">' +
        '<button class="mkt-primary" type="button" data-act="apply">Replace &amp; Load</button>' +
        '<button class="mkt-link" type="button" data-go="receive">Cancel</button></div>');
      panel.querySelector('[data-act="apply"]').addEventListener('click', function () {
        try {
          replaceLocal(info.data);
        } catch (err) {
          panel.querySelector('.mkt-error').textContent = err.message;
          return;
        }
        // Pages read localStorage on load, so reload to show the new progress.
        location.reload();
      });
    }
  }

  function wireSend(panel, code) {
    var copyBtn = panel.querySelector('[data-act="copy"]');
    copyBtn.addEventListener('click', function () {
      var box = panel.querySelector('.mkt-code');
      var done = function () {
        copyBtn.textContent = 'Copied! ✓';
        setTimeout(function () { copyBtn.textContent = 'Copy Code'; }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(done, function () { box.select(); });
      } else {
        box.select();
        try { if (document.execCommand('copy')) done(); } catch (e) {}
      }
    });

    var shareBtn = panel.querySelector('[data-act="share"]');
    if (shareBtn) shareBtn.addEventListener('click', function () {
      navigator.share({ title: 'Moku Series progress', text: code }).catch(function () {});
    });

    panel.querySelector('[data-act="file"]').addEventListener('click', function () {
      var url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
      var a = document.createElement('a');
      a.href = url;
      a.download = 'moku-progress-' + new Date().toISOString().slice(0, 10) + '.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  }

  function wireReceive(panel) {
    var box = panel.querySelector('.mkt-code');
    var errorEl = panel.querySelector('.mkt-error');
    var checkBtn = panel.querySelector('[data-act="check"]');
    var fileInput = panel.querySelector('input[type=file]');
    setTimeout(function () { box.focus(); }, 30);

    function check(code) {
      errorEl.textContent = '';
      checkBtn.disabled = true;
      decode(code).then(function (info) {
        if (!progressCount(info.data)) throw friendly('That code has no game progress in it.');
        render('confirm', info);
      }).catch(function (err) {
        errorEl.textContent = err.message;
        checkBtn.disabled = false;
      });
    }

    checkBtn.addEventListener('click', function () { check(box.value); });
    panel.querySelector('[data-act="open"]').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      file.text().then(function (text) {
        box.value = text.trim();
        check(text);
      });
    });
  }

  function wireButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-moku-transfer]'), function (btn) {
      if (btn.__mokuTransfer) return;
      btn.__mokuTransfer = true;
      btn.addEventListener('click', open);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireButtons);
  else wireButtons();

  global.MokuTransfer = { open: open, exportCode: exportCode, decode: decode };
})(window);
