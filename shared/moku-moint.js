/**
 * Moku Series — Moint, the series-wide coin (SPEC.md §13).
 *
 * Include on a page:
 *   <script src="shared/moku-moint.js"></script>
 *     Full mode (hub.html). Renders the Moint card into [data-moku-moint-card]
 *     (balance, Daily Bonus, a dressed-up Moku), shows the Daily Bonus popup
 *     once a day and opens the Moku Closet from any [data-moku-closet] button.
 *     Load it after shared/moku-account.js: when the player is logged in, the
 *     Daily Bonus waits for the cloud sync so it never causes a save conflict.
 *   <script src="shared/moku-moint.js" data-mode="none"></script>
 *     Game pages. No UI — only the API below (e.g. Moku Bridge draws the
 *     hat Moku is wearing with MokuMoint.layerImage('head')).
 *
 * Save keys (all synced by cloud save / transfer codes, SPEC.md §10–11):
 *   moku:moint:wallet  { version, balance, updatedAt }  — never below 0
 *   moku:moint:daily   { version, last: 'YYYY-MM-DD', days, updatedAt }
 *   moku:moint:closet  { version, owned: [id], equipped: { head, face, neck }, updatedAt }
 *
 * Items are drawn as SVG on a 100×100 grid laid exactly over
 * brand/mokumoku-hero.png (head top ≈ y 8, eyes ≈ (35, 41.5) / (65, 41.5),
 * leaf bow ≈ y 44–58), so the same drawing works on any size of Moku.
 */
(function (global) {
  'use strict';

  var WALLET_KEY = 'moku:moint:wallet';
  var DAILY_KEY = 'moku:moint:daily';
  var CLOSET_KEY = 'moku:moint:closet';
  var DAILY_MOINTS = 100;
  var HERO_SRC = 'brand/mokumoku-hero.png';
  var SLOTS = ['head', 'face', 'neck'];
  var SLOT_LABELS = { head: 'Hats', face: 'Glasses', neck: 'Necklaces' };

  var script = document.currentScript;
  var mode = (script && script.getAttribute('data-mode')) || 'full';

  // ---------- storage ----------

  function readJSON(key) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // 財布は Moku Bridge など他のページも書くので、毎回読み直す
  function readWallet() {
    var w = readJSON(WALLET_KEY);
    if (!w || typeof w.balance !== 'number') w = { version: 1, balance: 0, updatedAt: null };
    return w;
  }
  function balance() { return readWallet().balance; }
  function addMoints(n) {
    var w = readWallet();
    w.balance = Math.max(0, w.balance + n);
    w.updatedAt = new Date().toISOString();
    writeJSON(WALLET_KEY, w);
    changed();
    return w.balance;
  }

  function readDaily() {
    var d = readJSON(DAILY_KEY);
    if (!d || d.version !== 1) d = { version: 1, last: null, days: 0, updatedAt: null };
    return d;
  }
  function canClaimDaily() { return readDaily().last !== todayStr(); }
  function claimDaily() {
    if (!canClaimDaily()) return 0;
    var d = readDaily();
    d.last = todayStr();
    d.days = (d.days || 0) + 1;
    d.updatedAt = new Date().toISOString();
    writeJSON(DAILY_KEY, d);
    addMoints(DAILY_MOINTS);
    return DAILY_MOINTS;
  }

  function readCloset() {
    var c = readJSON(CLOSET_KEY);
    if (!c || c.version !== 1) c = { version: 1, owned: [], equipped: {}, updatedAt: null };
    if (!Array.isArray(c.owned)) c.owned = [];
    if (!c.equipped) c.equipped = {};
    // 知らないアイテム(古い/壊れたデータ)は着せない
    SLOTS.forEach(function (s) {
      var id = c.equipped[s];
      if (id && (!ITEM_BY_ID[id] || ITEM_BY_ID[id].slot !== s || c.owned.indexOf(id) < 0)) c.equipped[s] = null;
    });
    return c;
  }
  function saveCloset(c) {
    c.updatedAt = new Date().toISOString();
    writeJSON(CLOSET_KEY, c);
    changed();
  }
  function owns(id) { return readCloset().owned.indexOf(id) >= 0; }
  // → 'ok' | 'owned' | 'poor' | 'unknown'
  function buy(id) {
    var item = ITEM_BY_ID[id];
    if (!item) return 'unknown';
    var c = readCloset();
    if (c.owned.indexOf(id) >= 0) return 'owned';
    if (balance() < item.price) return 'poor';
    addMoints(-item.price);
    c = readCloset();
    c.owned.push(id);
    c.equipped[item.slot] = id;   // 買ったらすぐ着る
    saveCloset(c);
    return 'ok';
  }
  function equip(id) {
    var item = ITEM_BY_ID[id];
    var c = readCloset();
    if (!item || c.owned.indexOf(id) < 0) return false;
    c.equipped[item.slot] = id;
    saveCloset(c);
    return true;
  }
  function unequip(slot) {
    var c = readCloset();
    c.equipped[slot] = null;
    saveCloset(c);
  }

  var changeListeners = [];
  function changed() {
    changeListeners.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  // ---------- item art (SVG on the hero's 100×100 grid) ----------

  function flower(x, y, r, petal, center) {
    var s = '';
    for (var i = 0; i < 5; i++) {
      var a = i / 5 * Math.PI * 2 - Math.PI / 2;
      s += '<circle cx="' + (x + Math.cos(a) * r * 0.62).toFixed(2) + '" cy="' + (y + Math.sin(a) * r * 0.62).toFixed(2) +
        '" r="' + (r * 0.5).toFixed(2) + '" fill="' + petal + '"/>';
    }
    return s + '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 0.38).toFixed(2) + '" fill="' + center + '"/>';
  }
  function starPath(x, y, r) {
    var d = '';
    for (var i = 0; i < 10; i++) {
      var a = i / 10 * Math.PI * 2 - Math.PI / 2;
      var rr = i % 2 ? r * 0.48 : r;
      d += (i ? 'L' : 'M') + (x + Math.cos(a) * rr).toFixed(2) + ' ' + (y + Math.sin(a) * rr).toFixed(2);
    }
    return d + 'Z';
  }
  function heartPath(x, y, r) {
    return 'M' + x + ' ' + (y + r * 0.9) +
      'C' + (x - r * 1.5) + ' ' + (y - r * 0.1) + ' ' + (x - r * 0.75) + ' ' + (y - r * 1.15) + ' ' + x + ' ' + (y - r * 0.42) +
      'C' + (x + r * 0.75) + ' ' + (y - r * 1.15) + ' ' + (x + r * 1.5) + ' ' + (y - r * 0.1) + ' ' + x + ' ' + (y + r * 0.9) + 'Z';
  }
  // Points along the quadratic curve (x0,y0)→(cx,cy)→(x1,y1)
  function along(x0, y0, cx, cy, x1, y1, n) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var t = n === 1 ? 0.5 : i / (n - 1);
      var u = 1 - t;
      pts.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]);
    }
    return pts;
  }
  var FRAME_ARMS = '<path d="M26.6 40.2 L19 38.6 M73.4 40.2 L81 38.6" stroke="#5A3A22" stroke-width="1.5" stroke-linecap="round" fill="none"/>';

  // box = [x, y, w, h] crop used for the item's icon in the shop
  var ITEMS = [
    { id: 'party-hat', slot: 'head', name: 'Party Hat', price: 120, box: [32, -1, 36, 22],
      svg: function () {
        return '<path d="M38.5 15.6 Q50 19.2 62.5 15.6 L52.4 2.2 Z" fill="#FF8FB8" stroke="#E0628F" stroke-width="0.8" stroke-linejoin="round"/>' +
          '<circle cx="47" cy="12.6" r="1.5" fill="#FFE27A"/><circle cx="53.6" cy="8.4" r="1.3" fill="#5ED6E8"/>' +
          '<circle cx="56" cy="14" r="1.4" fill="#5ED6E8"/><circle cx="50.8" cy="15.6" r="1.1" fill="#FFF6E8"/>' +
          '<circle cx="51.3" cy="5.6" r="1" fill="#FFE27A"/>' +
          '<path d="M38.5 15.6 Q50 19.2 62.5 15.6" stroke="#FFE27A" stroke-width="2" fill="none" stroke-linecap="round"/>' +
          '<circle cx="52.4" cy="2.4" r="2.8" fill="#FFE27A" stroke="#F0B93A" stroke-width="0.6"/>';
      } },
    { id: 'beanie', slot: 'head', name: 'Cozy Beanie', price: 150, box: [26, -2, 48, 22],
      svg: function () {
        return '<path d="M29.5 16.5 Q28.5 3.5 50 3 Q71.5 3.5 70.5 16.5 Z" fill="#E8604C"/>' +
          '<path d="M38 6 Q37 11 37.5 15 M44 4.4 Q43.5 10 43.8 15 M50 4 L50 15 M56 4.4 Q56.5 10 56.2 15 M62 6 Q63 11 62.5 15" stroke="#C94A38" stroke-width="0.8" fill="none"/>' +
          '<path d="M27.5 13.4 Q50 8.6 72.5 13.4 L72.8 19 Q50 14.4 27.2 19 Z" fill="#FFF3E0" stroke="#EAD6BA" stroke-width="0.6"/>' +
          '<circle cx="50" cy="2.6" r="4.2" fill="#FFF3E0" stroke="#EAD6BA" stroke-width="0.6"/>';
      } },
    { id: 'flower-crown', slot: 'head', name: 'Flower Crown', price: 200, box: [24, 4, 52, 16],
      svg: function () {
        var s = '<path d="M27 16.4 Q50 5.4 73 16.4" stroke="#6BA84F" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
        along(27, 16.4, 50, 5.4, 73, 16.4, 9).forEach(function (p, i) {
          if (i % 2) s += '<ellipse cx="' + p[0].toFixed(2) + '" cy="' + (p[1] - 1.2).toFixed(2) + '" rx="1.9" ry="1" fill="#8CC46A" transform="rotate(' + (i < 4 ? -30 : 30) + ' ' + p[0].toFixed(2) + ' ' + (p[1] - 1.2).toFixed(2) + ')"/>';
        });
        var colors = [['#FF8FB8', '#FFE27A'], ['#FFE27A', '#F59E2A'], ['#FFFFFF', '#FFC94A'], ['#C9A0F5', '#FFE27A'], ['#FF8FB8', '#FFE27A']];
        along(28, 16, 50, 6, 72, 16, 5).forEach(function (p, i) {
          s += flower(+p[0].toFixed(2), +p[1].toFixed(2), i === 2 ? 3.4 : 2.9, colors[i][0], colors[i][1]);
        });
        return s;
      } },
    { id: 'wizard-hat', slot: 'head', name: 'Star Wizard Hat', price: 350, box: [25, -2, 50, 24],
      svg: function () {
        return '<ellipse cx="50" cy="15.4" rx="23" ry="4.6" fill="#5B4A9E"/>' +
          '<path d="M37.4 15 Q42 9 47.5 3.5 Q52 -0.6 58 0.6 Q61.5 1.4 63.5 4.5 Q59.8 3.4 58.6 6 Q60.6 10.6 62.6 15 Z" fill="#7562C9"/>' +
          '<path d="M37.3 12.6 Q50 10.6 62.6 12.6 L62.9 15.4 Q50 13.4 37 15.4 Z" fill="#FFD25A"/>' +
          '<path d="' + starPath(52, 7.6, 2.4) + '" fill="#FFE27A"/><path d="' + starPath(45.4, 10.2, 1.4) + '" fill="#FFE27A"/>' +
          '<circle cx="57" cy="10.6" r="0.8" fill="#FFF6E8"/><circle cx="63.6" cy="4.6" r="1.3" fill="#FFE27A"/>';
      } },
    { id: 'crown', slot: 'head', name: 'Royal Crown', price: 600, box: [31, 0, 38, 20],
      svg: function () {
        return '<defs><linearGradient id="mmGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE68A"/><stop offset="1" stop-color="#E0A21B"/></linearGradient></defs>' +
          '<path d="M36.2 17.4 L35 6.4 L42.6 11.8 L50 3.2 L57.4 11.8 L65 6.4 L63.8 17.4 Z" fill="url(#mmGold)" stroke="#C98A14" stroke-width="0.7" stroke-linejoin="round"/>' +
          '<path d="M36.1 14.2 L63.9 14.2 L63.7 17.8 L36.3 17.8 Z" fill="#E8A920"/>' +
          '<circle cx="50" cy="16" r="1.7" fill="#FF5A6E"/><circle cx="42.4" cy="16" r="1.2" fill="#2EC4B6"/><circle cx="57.6" cy="16" r="1.2" fill="#2EC4B6"/>' +
          '<circle cx="35" cy="6.2" r="1.4" fill="#FFF3C4"/><circle cx="50" cy="3" r="1.6" fill="#FFF3C4"/><circle cx="65" cy="6.2" r="1.4" fill="#FFF3C4"/>';
      } },
    { id: 'round-glasses', slot: 'face', name: 'Round Glasses', price: 100, box: [17, 29, 66, 25],
      svg: function () {
        return '<circle cx="35" cy="41.5" r="8.4" fill="rgba(210,235,255,0.18)" stroke="#5A3A22" stroke-width="1.6"/>' +
          '<circle cx="65" cy="41.5" r="8.4" fill="rgba(210,235,255,0.18)" stroke="#5A3A22" stroke-width="1.6"/>' +
          '<path d="M43.4 40.4 Q50 37.4 56.6 40.4" stroke="#5A3A22" stroke-width="1.5" fill="none" stroke-linecap="round"/>' + FRAME_ARMS +
          '<path d="M30.4 37 Q32 35.4 34.2 35" stroke="rgba(255,255,255,0.7)" stroke-width="1" fill="none" stroke-linecap="round"/>';
      } },
    { id: 'star-shades', slot: 'face', name: 'Star Shades', price: 220, box: [17, 29, 66, 25],
      svg: function () {
        return '<path d="' + starPath(35, 42, 10) + '" fill="rgba(255,184,77,0.86)" stroke="#E0861A" stroke-width="1.2" stroke-linejoin="round"/>' +
          '<path d="' + starPath(65, 42, 10) + '" fill="rgba(255,184,77,0.86)" stroke="#E0861A" stroke-width="1.2" stroke-linejoin="round"/>' +
          '<path d="M43.4 39.6 Q50 36.8 56.6 39.6" stroke="#E0861A" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
          '<circle cx="32" cy="39.6" r="1.2" fill="rgba(255,255,255,0.8)"/><circle cx="62" cy="39.6" r="1.2" fill="rgba(255,255,255,0.8)"/>';
      } },
    { id: 'heart-shades', slot: 'face', name: 'Heart Shades', price: 250, box: [17, 29, 66, 25],
      svg: function () {
        return '<path d="' + heartPath(35, 41.4, 8.4) + '" fill="rgba(255,111,145,0.86)" stroke="#D9446C" stroke-width="1.2"/>' +
          '<path d="' + heartPath(65, 41.4, 8.4) + '" fill="rgba(255,111,145,0.86)" stroke="#D9446C" stroke-width="1.2"/>' +
          '<path d="M43.6 38.6 Q50 36.2 56.4 38.6" stroke="#D9446C" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
          '<circle cx="31" cy="38.4" r="1.3" fill="rgba(255,255,255,0.8)"/><circle cx="61" cy="38.4" r="1.3" fill="rgba(255,255,255,0.8)"/>';
      } },
    { id: 'flower-lei', slot: 'neck', name: 'Flower Lei', price: 180, box: [25, 56, 50, 16],
      svg: function () {
        var s = '';
        var colors = ['#FF8FB8', '#FFE27A', '#FFFFFF', '#FFA552', '#C9A0F5'];
        along(29.5, 59, 50, 74, 70.5, 59, 11).forEach(function (p, i) {
          s += flower(+p[0].toFixed(2), +p[1].toFixed(2), 2.7, colors[i % colors.length], i % 2 ? '#F59E2A' : '#FFE27A');
        });
        return s;
      } },
    { id: 'pearls', slot: 'neck', name: 'Pearl Necklace', price: 260, box: [29, 56, 42, 22],
      svg: function () {
        var s = '';
        along(31.5, 59, 50, 74, 68.5, 59, 15).forEach(function (p) {
          s += '<circle cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="1.25" fill="#FFF8EE" stroke="#E4D5C3" stroke-width="0.4"/>';
        });
        return s + '<path d="M50 67 Q47.4 70.4 50 73.6 Q52.6 70.4 50 67 Z" fill="#FF8FB8" stroke="#E0628F" stroke-width="0.5"/>' +
          '<circle cx="49.4" cy="69.8" r="0.6" fill="rgba(255,255,255,0.85)"/>';
      } },
    { id: 'gold-medal', slot: 'neck', name: 'Gold Medal', price: 400, box: [36, 57, 28, 25],
      svg: function () {
        return '<path d="M42 58 L48.6 71 L51.4 71 L45.4 58 Z" fill="#4E7BE0"/><path d="M58 58 L51.4 71 L48.6 71 L54.6 58 Z" fill="#E8604C"/>' +
          '<circle cx="50" cy="74.6" r="5.4" fill="url(#mmMedal)" stroke="#C98A14" stroke-width="0.8"/>' +
          '<defs><linearGradient id="mmMedal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE68A"/><stop offset="1" stop-color="#E0A21B"/></linearGradient></defs>' +
          '<path d="' + starPath(50, 74.8, 3) + '" fill="#FFF3C4"/>';
      } }
  ];
  var ITEM_BY_ID = {};
  ITEMS.forEach(function (it) { ITEM_BY_ID[it.id] = it; });

  function itemSVG(id, viewBox) {
    var it = ITEM_BY_ID[id];
    if (!it) return '';
    var vb = viewBox || '0 0 100 100';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" overflow="visible">' + it.svg() + '</svg>';
  }
  function iconSVG(id) {
    var it = ITEM_BY_ID[id];
    if (!it) return '';
    var b = it.box, pad = 2;
    var size = Math.max(b[2], b[3]) + pad * 2;
    var x = b[0] + b[2] / 2 - size / 2, y = b[1] + b[3] / 2 - size / 2;
    return itemSVG(id, x + ' ' + y + ' ' + size + ' ' + size);
  }
  // All worn items in one layer, neck → face → head (so a hat sits on top)
  function outfitSVG(equipped) {
    var inner = '';
    ['neck', 'face', 'head'].forEach(function (s) {
      var it = equipped && ITEM_BY_ID[equipped[s]];
      if (it) inner += it.svg();
    });
    return '<svg class="mm-outfit" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" overflow="visible" aria-hidden="true">' + inner + '</svg>';
  }

  // For canvas games: an <img> of what Moku wears in one slot (null = nothing).
  // Draw it on the hero's 100×100 grid. Cached per item.
  var imageCache = {};
  function layerImage(slot) {
    var id = readCloset().equipped[slot];
    if (!id) return null;
    if (!imageCache[id]) {
      var img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(itemSVG(id));
      imageCache[id] = img;
    }
    var im = imageCache[id];
    return im.complete && im.naturalWidth ? im : null;
  }

  global.MokuMoint = {
    DAILY_MOINTS: DAILY_MOINTS,
    ITEMS: ITEMS,
    SLOTS: SLOTS,
    balance: balance,
    add: addMoints,
    canClaimDaily: canClaimDaily,
    claimDaily: claimDaily,
    closet: readCloset,
    owns: owns,
    buy: buy,
    equip: equip,
    unequip: unequip,
    itemSVG: itemSVG,
    outfitSVG: outfitSVG,
    layerImage: layerImage,
    onChange: function (fn) { changeListeners.push(fn); },
    openCloset: function () {}
  };

  if (mode !== 'full') return;

  // ================================================================
  // Hub UI: Moint card, Daily Bonus popup, Moku Closet
  // 世界観: 絵本のような温かいクリーム色+木目+夕焼け(CLAUDE.md §4)
  // ================================================================

  var CSS = [
    // ---- hub card (sits on the hub's dark panels) ----
    '.mm-card{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:18px;',
    'background:linear-gradient(135deg,rgba(255,201,74,0.16),rgba(255,143,112,0.10));border:1px solid rgba(255,214,120,0.35)}',
    '.mm-card-doll{flex:none;width:68px;height:68px;border-radius:16px;background:radial-gradient(circle at 50% 70%,#FFF1D6,#F2C98A);',
    'box-shadow:inset 0 0 0 2px rgba(255,255,255,0.5);display:flex;align-items:flex-end;justify-content:center;overflow:visible;cursor:pointer;',
    'border:none;padding:0;-webkit-tap-highlight-color:transparent}',
    '.mm-card-doll .mm-doll{width:62px;height:62px;margin-bottom:2px}',
    '.mm-card-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}',
    '.mm-card-title{font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,230,170,0.85)}',
    '.mm-card-bal{display:flex;align-items:center;gap:7px;font-size:22px;font-weight:900;color:#FFF3D6;line-height:1}',
    '.mm-card-bal small{font-size:13px;font-weight:800;color:rgba(255,230,170,0.75)}',
    '.mm-card-actions{display:flex;gap:8px;flex-wrap:wrap}',
    '.mm-pill{appearance:none;border:none;font:inherit;font-size:13px;font-weight:800;padding:8px 13px;border-radius:999px;cursor:pointer;',
    'display:inline-flex;align-items:center;gap:6px;-webkit-tap-highlight-color:transparent;transition:transform .12s}',
    '.mm-pill:active{transform:translateY(2px)}',
    '.mm-pill.is-gold{background:linear-gradient(180deg,#FFE7A3,#F5B83D);color:#5A3A0A;box-shadow:0 3px 0 #9A6512}',
    '.mm-pill.is-gold:active{box-shadow:0 1px 0 #9A6512}',
    '.mm-pill.is-soft{background:rgba(255,255,255,0.1);color:#FFF3D6;border:1px solid rgba(255,255,255,0.18)}',
    '.mm-pill.is-done{background:rgba(255,255,255,0.06);color:rgba(255,243,214,0.6);cursor:default}',
    '.mm-pill.is-glow{animation:mmGlow 1.6s ease-in-out infinite}',
    '@keyframes mmGlow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.15) drop-shadow(0 0 8px rgba(255,214,120,0.7))}}',
    // ---- coin ----
    '.mm-coin{flex:none;display:inline-flex;align-items:center;justify-content:center;width:1.15em;height:1.15em;border-radius:50%;',
    'background:radial-gradient(circle at 35% 30%,#FFE7A3,#F5B83D 60%,#D9931E);box-shadow:inset 0 -1.5px 0 rgba(154,101,18,0.6);',
    'color:#7A4A0C;font-size:0.72em;font-weight:900;font-style:normal;line-height:1}',
    // ---- dressed-up Moku ----
    '.mm-doll{position:relative;display:block;aspect-ratio:1/1}',
    '.mm-doll img,.mm-doll .mm-outfit{position:absolute;inset:0;width:100%;height:100%;display:block}',
    '.mm-doll img{object-fit:contain}',
    // ---- overlays ----
    '.mm-overlay{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:16px;',
    'background:rgba(30,18,10,0.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:mmFade .2s ease-out}',
    '@keyframes mmFade{from{opacity:0}to{opacity:1}}',
    '.mm-panel{position:relative;width:100%;max-width:400px;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow:auto;',
    'background:#FFF6E8;color:#4A2F1A;border-radius:22px;box-shadow:0 18px 50px rgba(40,20,5,0.45),inset 0 0 0 3px #F1D9B5;',
    'animation:mmPop .32s cubic-bezier(.2,1.4,.4,1);font-family:-apple-system,"Segoe UI",Roboto,sans-serif}',
    '@keyframes mmPop{from{transform:scale(.86);opacity:0}to{transform:none;opacity:1}}',
    '.mm-close{position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;border:none;cursor:pointer;z-index:2;',
    'background:rgba(255,255,255,0.75);color:#7A4F2E;font-size:16px;font-weight:900;box-shadow:0 2px 0 rgba(122,79,46,0.25)}',
    '.mm-head{position:relative;padding:20px 18px 0;text-align:center;border-radius:22px 22px 0 0;',
    'background:linear-gradient(180deg,#FFB36B 0%,#FFCF8F 55%,#FFF6E8 100%)}',
    '.mm-head h2{margin:0;font-size:22px;font-weight:900;letter-spacing:0.02em;color:#6B3A12;text-shadow:0 2px 0 rgba(255,255,255,0.6)}',
    '.mm-head p{margin:4px 0 0;font-size:13.5px;font-weight:700;color:#8A5A2E}',
    // daily
    '.mm-daily .mm-head{padding-bottom:6px}',
    '.mm-daily-coin{width:96px;height:96px;margin:14px auto 4px;font-size:52px;display:flex;animation:mmSpin 2.4s ease-in-out infinite}',
    '.mm-daily-coin .mm-coin{width:100%;height:100%;font-size:46px;box-shadow:inset 0 -5px 0 rgba(154,101,18,0.55),0 6px 18px rgba(245,184,61,0.55)}',
    '@keyframes mmSpin{0%,100%{transform:translateY(0) rotateY(0)}50%{transform:translateY(-8px) rotateY(180deg)}}',
    '.mm-daily-amt{text-align:center;font-size:34px;font-weight:900;color:#C9781A;margin:2px 0 4px}',
    '.mm-daily-sub{text-align:center;font-size:13.5px;font-weight:700;color:#8A5A2E;margin:0 22px 16px}',
    '.mm-big{display:block;width:calc(100% - 44px);margin:0 auto 20px;appearance:none;border:none;border-radius:16px;padding:14px;cursor:pointer;',
    'font:inherit;font-size:18px;font-weight:900;color:#5A3A0A;background:linear-gradient(180deg,#FFE7A3,#F5B83D);box-shadow:0 4px 0 #9A6512}',
    '.mm-big:active{transform:translateY(3px);box-shadow:0 1px 0 #9A6512}',
    '.mm-big[disabled]{background:#EADBC4;color:#A88B6A;box-shadow:0 4px 0 #C9B28F;cursor:default}',
    '.mm-burst{position:absolute;left:50%;top:150px;width:0;height:0;pointer-events:none}',
    '.mm-burst i{position:absolute;width:18px;height:18px;margin:-9px;animation:mmBurst .9s cubic-bezier(.2,.8,.3,1) forwards}',
    '@keyframes mmBurst{0%{transform:translate(0,0) scale(.4);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(1);opacity:0}}',
    // closet
    '.mm-stage{position:relative;width:190px;height:190px;margin:6px auto 0}',
    '.mm-stage::before{content:"";position:absolute;left:12%;right:12%;bottom:2px;height:26px;border-radius:50%;',
    'background:radial-gradient(ellipse at center,#B9834F 0%,#9A6A3C 70%);box-shadow:0 4px 0 #7A4F2E}',
    '.mm-stage .mm-doll{position:absolute;left:10px;right:10px;bottom:12px;animation:mmBob 2.6s ease-in-out infinite}',
    '@keyframes mmBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}',
    '.mm-stage .mm-doll.is-new{animation:mmHop .5s cubic-bezier(.2,1.6,.4,1)}',
    '@keyframes mmHop{0%{transform:scale(1,1)}30%{transform:scale(1.08,.9)}60%{transform:translateY(-10px) scale(.96,1.05)}100%{transform:none}}',
    '.mm-bal{display:inline-flex;align-items:center;gap:6px;margin:10px auto 0;padding:6px 14px;border-radius:999px;background:#FFFFFF;',
    'font-size:16px;font-weight:900;color:#7A4A0C;box-shadow:inset 0 0 0 2px #F1D9B5}',
    '.mm-tabs{display:flex;gap:6px;justify-content:center;margin:14px 14px 0}',
    '.mm-tab{flex:1;appearance:none;border:none;font:inherit;font-size:13.5px;font-weight:800;padding:9px 6px;border-radius:12px;cursor:pointer;',
    'background:#F3E3CB;color:#8A5A2E}',
    '.mm-tab.is-on{background:#7A4F2E;color:#FFF6E8;box-shadow:0 3px 0 #4A2F1A}',
    '.mm-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:14px}',
    '.mm-item{position:relative;appearance:none;border:none;font:inherit;cursor:pointer;background:#FFFFFF;border-radius:16px;padding:8px 6px 9px;',
    'box-shadow:0 3px 0 #EAD6BA,inset 0 0 0 2px #F6E8D3;display:flex;flex-direction:column;align-items:center;gap:4px;color:#4A2F1A;',
    'transition:transform .12s}',
    '.mm-item:active{transform:translateY(2px)}',
    '.mm-item.is-sel{box-shadow:0 3px 0 #C9781A,inset 0 0 0 3px #F5B83D;background:#FFFBF2}',
    '.mm-item svg{width:56px;height:56px}',
    '.mm-item-name{font-size:11.5px;font-weight:800;line-height:1.15;text-align:center;min-height:2.3em;display:flex;align-items:center}',
    '.mm-price{display:inline-flex;align-items:center;gap:4px;font-size:12.5px;font-weight:900;color:#9A6512}',
    '.mm-tag{font-size:11px;font-weight:900;padding:2px 8px;border-radius:999px;background:#E6F4D9;color:#4E7A2E}',
    '.mm-tag.is-wear{background:#7A4F2E;color:#FFF6E8}',
    '.mm-none svg{opacity:0.5}',
    '.mm-action{position:sticky;bottom:0;padding:10px 14px 14px;background:linear-gradient(180deg,rgba(255,246,232,0),#FFF6E8 30%)}',
    '.mm-action .mm-big{width:100%;margin:0}',
    '.mm-note{text-align:center;font-size:12px;font-weight:700;color:#A0764A;margin:6px 0 0}',
    '.mm-toast{position:fixed;left:50%;top:calc(16px + env(safe-area-inset-top));transform:translate(-50%,-20px);z-index:80;opacity:0;',
    'background:#4A2F1A;color:#FFF6E8;padding:10px 16px;border-radius:999px;font-size:14px;font-weight:800;transition:opacity .2s,transform .2s;pointer-events:none}',
    '.mm-toast.is-on{opacity:1;transform:translate(-50%,0)}'
  ].join('');

  var styled = false;
  function injectStyle() {
    if (styled) return;
    styled = true;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
  var COIN = '<i class="mm-coin">M</i>';
  function dollHTML(equipped, cls) {
    return '<span class="mm-doll' + (cls ? ' ' + cls : '') + '"><img src="' + HERO_SRC + '" alt="Moku">' + outfitSVG(equipped) + '</span>';
  }

  // ---------- sound (Web Audio, no files) ----------
  var audio = null;
  function tone(freq, dur, delay, type, vol) {
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      if (!audio) audio = new AC();
      if (audio.state === 'suspended') audio.resume();
      var t = audio.currentTime + (delay || 0);
      var o = audio.createOscillator(), g = audio.createGain();
      o.type = type || 'triangle';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(audio.destination);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) {}
  }
  function sfxCoins() { [1568, 2093, 1760, 2349, 2637].forEach(function (f, i) { tone(f, 0.16, i * 0.07, 'square', 0.035); }); }
  function sfxTap() { tone(660, 0.07, 0, 'triangle', 0.08); }
  function sfxBuy() { [784, 988, 1318, 1568].forEach(function (f, i) { tone(f, 0.22, i * 0.08, 'triangle', 0.09); }); }
  function sfxNope() { tone(330, 0.15, 0, 'triangle', 0.09); tone(262, 0.2, 0.1, 'triangle', 0.09); }

  var toastEl = null, toastTimer = 0;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'mm-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 1800);
  }

  // ---------- overlay helper ----------
  var openOverlay = null;
  var lastFocus = null;
  function showOverlay(cls, html, label) {
    closeOverlay();
    lastFocus = document.activeElement;
    var ov = document.createElement('div');
    ov.className = 'mm-overlay';
    ov.innerHTML = '<div class="mm-panel ' + cls + '" role="dialog" aria-modal="true" aria-label="' + label + '">' +
      '<button class="mm-close" type="button" aria-label="Close">✕</button>' + html + '</div>';
    ov.addEventListener('click', function (e) {
      if (e.target === ov || (e.target.closest && e.target.closest('.mm-close'))) closeOverlay();
    });
    document.body.appendChild(ov);
    openOverlay = ov;
    var btn = ov.querySelector('.mm-big:not([disabled])') || ov.querySelector('.mm-close');
    if (btn) btn.focus();
    return ov;
  }
  function closeOverlay() {
    if (!openOverlay) return;
    openOverlay.remove();
    openOverlay = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openOverlay) closeOverlay();
  });

  // ---------- Daily Bonus ----------
  function countUp(node, from, to) {
    var start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / 700);
      node.textContent = fmt(Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  function burst(panel) {
    var b = document.createElement('div');
    b.className = 'mm-burst';
    for (var i = 0; i < 14; i++) {
      var a = i / 14 * Math.PI * 2;
      var d = 90 + Math.random() * 50;
      var c = document.createElement('i');
      c.innerHTML = COIN;
      c.firstChild.style.width = c.firstChild.style.height = '100%';
      c.style.setProperty('--dx', Math.round(Math.cos(a) * d) + 'px');
      c.style.setProperty('--dy', Math.round(Math.sin(a) * d) + 'px');
      c.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's';
      b.appendChild(c);
    }
    panel.appendChild(b);
    setTimeout(function () { b.remove(); }, 1200);
  }
  function openDaily() {
    injectStyle();
    var ready = canClaimDaily();
    var days = readDaily().days || 0;
    var ov = showOverlay('mm-daily',
      '<div class="mm-head"><h2>Daily Bonus</h2><p>' + (ready ? 'Welcome back! Here is a gift for you.' : 'You already got today\'s gift.') + '</p></div>' +
      '<div class="mm-daily-coin">' + COIN + '</div>' +
      '<div class="mm-daily-amt">+' + DAILY_MOINTS + ' Moints</div>' +
      '<p class="mm-daily-sub">' + (ready
        ? 'Come back every day to get ' + DAILY_MOINTS + ' more. Spend them on Hints in Moku Bridge or cute outfits in the Moku Closet!'
        : 'Come back tomorrow for ' + DAILY_MOINTS + ' more Moints!' + (days ? ' Days collected: ' + days + '.' : '')) + '</p>' +
      '<button class="mm-big" type="button" data-mm-claim' + (ready ? '' : ' disabled') + '>' + (ready ? 'Get ' + COIN + ' ' + DAILY_MOINTS : 'See You Tomorrow') + '</button>',
      'Daily Bonus');
    var btn = ov.querySelector('[data-mm-claim]');
    btn.addEventListener('click', function () {
      if (!canClaimDaily()) return;
      var before = balance();
      claimDaily();
      sfxCoins();
      burst(ov.querySelector('.mm-panel'));
      btn.disabled = true;
      btn.innerHTML = COIN + ' <span data-mm-count>' + fmt(before) + '</span>';
      countUp(btn.querySelector('[data-mm-count]'), before, balance());
      ov.querySelector('.mm-head p').textContent = 'Yay! See you tomorrow!';
      renderCards();
      afterChange();
      setTimeout(function () { if (openOverlay === ov) closeOverlay(); }, 1900);
    });
  }

  // ログイン中は、増えた Moint をすぐクラウドへ(別の端末で同じ日にもう一度もらえないように)
  function afterChange() {
    var acc = global.MokuAccount;
    if (acc && acc.getUser && acc.getUser() && acc.syncNow) acc.syncNow();
  }

  // ---------- Moku Closet ----------
  var closetState = { tab: 'head', sel: null };
  function openCloset(slot) {
    injectStyle();
    closetState.tab = slot || closetState.tab || 'head';
    closetState.sel = null;
    var ov = showOverlay('mm-closet',
      '<div class="mm-head"><h2>Moku Closet</h2><p>Dress up your own Moku!</p>' +
      '<div class="mm-stage" data-mm-stage></div>' +
      '<div class="mm-bal">' + COIN + '<span data-mm-bal></span></div></div>' +
      '<div class="mm-tabs" role="tablist">' + SLOTS.map(function (s) {
        return '<button class="mm-tab" type="button" role="tab" data-mm-tab="' + s + '">' + SLOT_LABELS[s] + '</button>';
      }).join('') + '</div>' +
      '<div class="mm-grid" data-mm-grid></div>' +
      '<div class="mm-action"><button class="mm-big" type="button" data-mm-act></button>' +
      '<p class="mm-note">Earn Moints from the Daily Bonus and Moku Bridge.</p></div>',
      'Moku Closet');
    ov.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-mm-tab],[data-mm-item],[data-mm-act]') : null;
      if (!t) return;
      if (t.hasAttribute('data-mm-tab')) {
        sfxTap();
        closetState.tab = t.getAttribute('data-mm-tab');
        closetState.sel = null;
        renderCloset(false);
      } else if (t.hasAttribute('data-mm-item')) {
        sfxTap();
        var id = t.getAttribute('data-mm-item');
        closetState.sel = id;
        // 持っている服はタップですぐ着替える。持っていない服は試着(プレビュー)だけ
        if (id === 'none') unequip(closetState.tab);
        else if (owns(id)) equip(id);
        renderCloset(true);
      } else {
        closetAction();
      }
    });
    renderCloset(false);
  }
  // What Moku shows on the stage: what he wears, plus the item being tried on
  function previewOutfit() {
    var eq = Object.assign({}, readCloset().equipped);
    var sel = closetState.sel && ITEM_BY_ID[closetState.sel];
    if (sel) eq[sel.slot] = sel.id;
    return eq;
  }
  function renderCloset(hop) {
    if (!openOverlay || !openOverlay.querySelector('.mm-closet')) return;
    var ov = openOverlay;
    var c = readCloset();
    ov.querySelector('[data-mm-stage]').innerHTML = dollHTML(previewOutfit(), hop ? 'is-new' : '');
    ov.querySelector('[data-mm-bal]').textContent = fmt(balance());
    Array.prototype.forEach.call(ov.querySelectorAll('[data-mm-tab]'), function (b) {
      var on = b.getAttribute('data-mm-tab') === closetState.tab;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var worn = c.equipped[closetState.tab];
    var html = '<button class="mm-item mm-none' + (!worn && (!closetState.sel || closetState.sel === 'none') ? ' is-sel' : '') + '" type="button" data-mm-item="none">' +
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="#C9A27C" stroke-width="2"/><path d="M6.5 17.5 L17.5 6.5" stroke="#C9A27C" stroke-width="2"/></svg>' +
      '<span class="mm-item-name">Nothing</span>' + (!worn ? '<span class="mm-tag is-wear">Wearing</span>' : '<span class="mm-tag">Take off</span>') + '</button>';
    ITEMS.filter(function (it) { return it.slot === closetState.tab; }).forEach(function (it) {
      var have = c.owned.indexOf(it.id) >= 0;
      var wearing = worn === it.id;
      var sel = closetState.sel ? closetState.sel === it.id : wearing;
      html += '<button class="mm-item' + (sel ? ' is-sel' : '') + '" type="button" data-mm-item="' + it.id + '" aria-label="' + it.name +
        (have ? (wearing ? ', wearing' : ', owned') : ', ' + it.price + ' Moints') + '">' + iconSVG(it.id) +
        '<span class="mm-item-name">' + it.name + '</span>' +
        (wearing ? '<span class="mm-tag is-wear">Wearing</span>' : have ? '<span class="mm-tag">Owned</span>' :
          '<span class="mm-price">' + COIN + fmt(it.price) + '</span>') + '</button>';
    });
    ov.querySelector('[data-mm-grid]').innerHTML = html;
    var act = ov.querySelector('[data-mm-act]');
    var sel = closetState.sel && ITEM_BY_ID[closetState.sel];
    if (sel && c.owned.indexOf(sel.id) < 0) {
      var short = sel.price - balance();
      act.disabled = false;
      act.innerHTML = short > 0 ? 'Need ' + COIN + ' ' + fmt(short) + ' more' : 'Buy for ' + COIN + ' ' + fmt(sel.price);
      act.setAttribute('data-mm-act', short > 0 ? 'poor' : 'buy');
    } else {
      act.disabled = true;
      act.innerHTML = 'Looking good, Moku!';
      act.setAttribute('data-mm-act', '');
    }
  }
  function closetAction() {
    var sel = closetState.sel && ITEM_BY_ID[closetState.sel];
    if (!sel) return;
    var res = buy(sel.id);
    if (res === 'ok') {
      sfxBuy();
      toast('You got the ' + sel.name + '!');
      renderCloset(true);
      renderCards();
      afterChange();
    } else if (res === 'poor') {
      sfxNope();
      toast('Not enough Moints yet');
    }
  }

  // ---------- hub card ----------
  function renderCards() {
    var nodes = document.querySelectorAll('[data-moku-moint-card]');
    if (!nodes.length) return;
    var ready = canClaimDaily();
    var eq = readCloset().equipped;
    Array.prototype.forEach.call(nodes, function (node) {
      node.classList.add('mm-card');
      node.innerHTML =
        '<button class="mm-card-doll" type="button" data-moku-closet aria-label="Open the Moku Closet">' + dollHTML(eq) + '</button>' +
        '<div class="mm-card-main">' +
        '<div class="mm-card-title">My Moints</div>' +
        '<div class="mm-card-bal">' + COIN + '<span>' + fmt(balance()) + '</span><small>Moints</small></div>' +
        '<div class="mm-card-actions">' +
        (ready
          ? '<button class="mm-pill is-gold is-glow" type="button" data-mm-daily>🎁 Daily +' + DAILY_MOINTS + '</button>'
          : '<button class="mm-pill is-done" type="button" data-mm-daily>✓ Daily bonus</button>') +
        '<button class="mm-pill is-soft" type="button" data-moku-closet>👒 Moku Closet</button>' +
        '</div></div>';
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-moku-closet],[data-mm-daily]') : null;
    if (!t || (openOverlay && openOverlay.contains(t))) return;
    if (t.hasAttribute('data-mm-daily')) openDaily();
    else openCloset();
  });

  // Daily Bonus pops up by itself once a day — but only after the cloud sync
  // settles, so the new Moints never collide with a download from the cloud.
  var dailyAsked = false;
  function maybeAutoDaily() {
    if (dailyAsked || !canClaimDaily()) return;
    var acc = global.MokuAccount;
    if (acc && acc.isEnabled && acc.isEnabled() && acc.getUser && acc.getUser()) {
      var st = acc.getStatus();
      if (st === 'syncing' || st === 'idle') return;   // まだ同期中 → onStatusChange で再挑戦
      if (st === 'conflict') return;                   // 「どちらを残す?」を選んでから
    }
    dailyAsked = true;
    setTimeout(openDaily, 600);
  }

  function boot() {
    injectStyle();
    renderCards();
    var acc = global.MokuAccount;
    if (acc && acc.onStatusChange) acc.onStatusChange(function () { renderCards(); maybeAutoDaily(); });
    // 同期が始まる前に判定しないよう、ほんの少し待つ
    setTimeout(maybeAutoDaily, 400);
  }

  global.MokuMoint.openCloset = openCloset;
  global.MokuMoint.openDaily = openDaily;
  // 別タブ(Moku Bridge など)で Moint や服が変わったら表示を合わせる
  global.addEventListener('storage', function (e) {
    if (!e.key || e.key.indexOf('moku:moint:') === 0) { renderCards(); renderCloset(false); }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { renderCards(); maybeAutoDaily(); }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
