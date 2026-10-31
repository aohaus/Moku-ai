/**
 * Moku Series — Moint, the series-wide coin (SPEC.md §13).
 *
 * Include on a page:
 *   <script src="shared/moku-moint.js"></script>
 *     Full mode (hub.html). Fills these slots and keeps them up to date:
 *       [data-moku-moint-bar]   one line: balance + Daily Bonus + Closet
 *       [data-moku-doll]        the dressed-up Moku alone (avatar); add data-moku-scene
 *                               to put the chosen background card behind him
 *     shows the Daily Bonus popup once a day and opens the Moku Closet from
 *     any [data-moku-closet] button.
 *     Load it after shared/moku-account.js: when the player is logged in, the
 *     Daily Bonus waits for the cloud sync so it never causes a save conflict.
 *   <script src="shared/moku-moint.js" data-mode="none"></script>
 *     Game pages. No UI — only the API below (e.g. Moku Bridge draws the
 *     hat Moku is wearing with MokuMoint.layerImage('head')).
 *
 * Save keys (all synced by cloud save / transfer codes, SPEC.md §10–11):
 *   moku:moint:wallet  { version, balance, updatedAt }  — never below 0
 *   moku:moint:daily   { version, last: 'YYYY-MM-DD', days, updatedAt }
 *   moku:moint:earned  { version, day: 'YYYY-MM-DD', games: { gameId: n }, updatedAt }
 *                      — what each game paid out today, for the daily cap
 *
 * Games hand out Moints with MokuMoint.earn(gameId, amount):
 *   repeatable rewards (a win, a clear) count toward DAILY_GAME_CAP per game;
 *   one-time achievements pass { capped: false }. The game itself remembers
 *   which achievements it already paid (in its own moku:<gameId>: save).
 *   moku:moint:closet  { version, owned: [id], equipped: { head, mood, face, neck, bg }, updatedAt }
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
  var EARNED_KEY = 'moku:moint:earned';
  var DAILY_GAME_CAP = 500;     // 1ゲームで1日にもらえる「毎回もらえる分」の上限(実績は別)
  var HERO_SRC = 'brand/mokumoku-hero.png';
  var SLOTS = ['head', 'mood', 'face', 'neck'];  // what Moku wears (mood = his expression)
  var TABS = SLOTS.concat('bg');                 // Closet tabs (bg = background card behind Moku)
  var SLOT_LABELS = { head: 'Hats', mood: 'Moods', face: 'Face', neck: 'Necklaces', bg: 'Backgrounds' };

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

  function readEarned() {
    var e = readJSON(EARNED_KEY);
    if (!e || e.version !== 1 || e.day !== todayStr()) e = { version: 1, day: todayStr(), games: {}, updatedAt: null };
    if (!e.games) e.games = {};
    return e;
  }
  function earnedToday(gameId) { return readEarned().games[gameId] || 0; }
  // Moints from a game. Returns how many were really added (less than asked,
  // or 0, once the game's daily cap is used up).
  function earn(gameId, amount, opts) {
    amount = Math.max(0, Math.floor(amount || 0));
    if (!amount) return 0;
    if (!(opts && opts.capped === false)) {
      var e = readEarned();
      amount = Math.min(amount, Math.max(0, DAILY_GAME_CAP - (e.games[gameId] || 0)));
      if (!amount) return 0;
      e.games[gameId] = (e.games[gameId] || 0) + amount;
      e.updatedAt = new Date().toISOString();
      writeJSON(EARNED_KEY, e);
    }
    addMoints(amount);
    return amount;
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
    TABS.forEach(function (s) {
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
      } },
    // ---- more hats (2026-10-26) ----
    { id: 'top-hat', slot: 'head', name: 'Top Hat', price: 220, box: [30, -1, 40, 20],
      svg: function () {
        return '<ellipse cx="50" cy="15.6" rx="18" ry="3.4" fill="#2E2A3A"/>' +
          '<path d="M39.2 15 L40.2 1.6 Q50 0 59.8 1.6 L60.8 15 Z" fill="#3A3548"/>' +
          '<path d="M39.6 10.8 L60.4 10.8 L60.7 14.4 L39.3 14.4 Z" fill="#E8473C"/>' +
          '<path d="M43 3 L42.4 9.6" stroke="rgba(255,255,255,0.25)" stroke-width="1.2" stroke-linecap="round"/>';
      } },
    { id: 'cowboy-hat', slot: 'head', name: 'Cowboy Hat', price: 240, box: [22, 1, 56, 20],
      svg: function () {
        return '<path d="M38 14 Q37 3 44 3 Q50 5.6 56 3 Q63 3 62 14 Z" fill="#C98A4E"/>' +
          '<path d="M38.2 10.8 Q50 12.4 61.8 10.8 L61.9 13.8 Q50 15.2 38.1 13.8 Z" fill="#7A4F2E"/>' +
          '<path d="M23 14 Q30 20 50 18.6 Q70 20 77 14 Q72 11.6 63 13.6 Q50 15.4 37 13.6 Q28 11.6 23 14 Z" fill="#B9783F" stroke="#8E5A2C" stroke-width="0.6"/>';
      } },
    { id: 'chef-hat', slot: 'head', name: 'Chef Hat', price: 160, box: [31, -5, 38, 24],
      svg: function () {
        return '<circle cx="40" cy="5.6" r="6.4" fill="#FFFFFF" stroke="#E2D6C4" stroke-width="0.7"/>' +
          '<circle cx="60" cy="5.6" r="6.4" fill="#FFFFFF" stroke="#E2D6C4" stroke-width="0.7"/>' +
          '<circle cx="50" cy="2.8" r="7.4" fill="#FFFFFF" stroke="#E2D6C4" stroke-width="0.7"/>' +
          '<path d="M37 9.4 L63 9.4 L63 16.4 Q50 18 37 16.4 Z" fill="#FFFFFF" stroke="#E2D6C4" stroke-width="0.7"/>' +
          '<path d="M43 10.6 L43 16 M50 10.6 L50 16.8 M57 10.6 L57 16" stroke="#EFE6D8" stroke-width="0.7"/>';
      } },
    { id: 'pirate-hat', slot: 'head', name: 'Pirate Hat', price: 260, box: [25, 0, 50, 18],
      svg: function () {
        return '<path d="M26.5 15.4 Q34 3.6 50 2.6 Q66 3.6 73.5 15.4 Q62 11 50 12.6 Q38 11 26.5 15.4 Z" fill="#2E2A3A"/>' +
          '<path d="M26.5 15.4 Q38 11 50 12.6 Q62 11 73.5 15.4" stroke="#FFD25A" stroke-width="1.2" fill="none"/>' +
          '<path d="' + starPath(50, 8.2, 3) + '" fill="#FFF6E8"/>';
      } },
    { id: 'blue-cap', slot: 'head', name: 'Blue Cap', price: 140, box: [28, 1, 54, 21],
      svg: function () {
        return '<path d="M30 16 Q30 3 50 3 Q70 3 70 16 Z" fill="#4E7BE0"/>' +
          '<path d="M50 3.2 L50 15.6 M40 4.6 Q38.6 10 38.6 15.6 M60 4.6 Q61.4 10 61.4 15.6" stroke="#3A63C4" stroke-width="0.7" fill="none"/>' +
          '<path d="M47 15 Q66 12.6 81 17.6 Q66 20.8 47 18 Z" fill="#3A63C4"/>' +
          '<circle cx="50" cy="3.4" r="1.6" fill="#FFD25A"/>';
      } },
    { id: 'sun-hat', slot: 'head', name: 'Straw Sun Hat', price: 200, box: [22, 2, 56, 19],
      svg: function () {
        return '<ellipse cx="50" cy="15.2" rx="26" ry="5" fill="#F2D27A" stroke="#D9B055" stroke-width="0.6"/>' +
          '<path d="M36 14.6 Q36 4 50 4 Q64 4 64 14.6 Z" fill="#EBC45E"/>' +
          '<path d="M36.1 11.4 Q50 13 63.9 11.4 L64 14.4 Q50 16 36 14.4 Z" fill="#FF8FB8"/>' +
          flower(62.4, 11.4, 3, '#FFFFFF', '#FFC94A');
      } },
    { id: 'bunny-ears', slot: 'head', name: 'Bunny Ears', price: 180, box: [28, -10, 44, 27],
      svg: function () {
        return '<g transform="rotate(-12 40 3)"><ellipse cx="40" cy="1" rx="4.2" ry="9.4" fill="#FFF6F0" stroke="#F2C7D6" stroke-width="0.7"/>' +
          '<ellipse cx="40" cy="1.6" rx="2" ry="6.6" fill="#FFB3CA"/></g>' +
          '<g transform="rotate(12 60 3)"><ellipse cx="60" cy="1" rx="4.2" ry="9.4" fill="#FFF6F0" stroke="#F2C7D6" stroke-width="0.7"/>' +
          '<ellipse cx="60" cy="1.6" rx="2" ry="6.6" fill="#FFB3CA"/></g>' +
          '<path d="M29 15.4 Q50 5.4 71 15.4" stroke="#FF8FB8" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
      } },
    { id: 'cat-ears', slot: 'head', name: 'Cat Ears', price: 160, box: [28, -1, 44, 18],
      svg: function () {
        return '<path d="M29.6 15.6 L32.6 0.8 L43.4 9 Z" fill="#4A3A35" stroke-linejoin="round"/>' +
          '<path d="M32.6 12.6 L34.2 4.8 L40 9.6 Z" fill="#FF9FB8"/>' +
          '<path d="M70.4 15.6 L67.4 0.8 L56.6 9 Z" fill="#4A3A35"/>' +
          '<path d="M67.4 12.6 L65.8 4.8 L60 9.6 Z" fill="#FF9FB8"/>';
      } },
    { id: 'bear-ears', slot: 'head', name: 'Bear Ears', price: 160, box: [24, 1, 52, 16],
      svg: function () {
        return '<circle cx="31.6" cy="9.4" r="6.2" fill="#8A5A3A"/><circle cx="31.6" cy="9.4" r="3.4" fill="#E8B48A"/>' +
          '<circle cx="68.4" cy="9.4" r="6.2" fill="#8A5A3A"/><circle cx="68.4" cy="9.4" r="3.4" fill="#E8B48A"/>';
      } },
    { id: 'big-bow', slot: 'head', name: 'Big Bow', price: 150, box: [26, 0, 28, 18],
      svg: function () {
        return '<g transform="rotate(-15 40 9)">' +
          '<path d="M40 9 Q30 0.6 28.6 9 Q30 17.4 40 9 Z" fill="#FF6F91" stroke="#E0466F" stroke-width="0.6"/>' +
          '<path d="M40 9 Q50 0.6 51.4 9 Q50 17.4 40 9 Z" fill="#FF6F91" stroke="#E0466F" stroke-width="0.6"/>' +
          '<path d="M38.6 10 L35.6 16.4 M41.4 10 L44.4 16.4" stroke="#FF6F91" stroke-width="1.6" stroke-linecap="round"/>' +
          '<circle cx="40" cy="9" r="2.4" fill="#E0466F"/></g>';
      } },
    { id: 'halo', slot: 'head', name: 'Halo', price: 300, box: [33, -6, 34, 12],
      svg: function () {
        return '<ellipse cx="50" cy="0" rx="14" ry="3.4" fill="none" stroke="rgba(255,230,140,0.45)" stroke-width="4.4"/>' +
          '<ellipse cx="50" cy="0" rx="14" ry="3.4" fill="none" stroke="#FFD54A" stroke-width="2"/>';
      } },
    { id: 'tiara', slot: 'head', name: 'Silver Tiara', price: 280, box: [32, 2, 36, 15],
      svg: function () {
        return '<path d="M34 15.2 Q42 9 50 3.6 Q58 9 66 15.2 Q58 12 50 12 Q42 12 34 15.2 Z" fill="#E4E8F0" stroke="#A9B2C3" stroke-width="0.7"/>' +
          '<circle cx="50" cy="8" r="1.9" fill="#5ED6E8"/><circle cx="43.4" cy="11.2" r="1.1" fill="#FF8FB8"/><circle cx="56.6" cy="11.2" r="1.1" fill="#FF8FB8"/>';
      } },
    { id: 'propeller-cap', slot: 'head', name: 'Propeller Cap', price: 180, box: [28, -4, 44, 21],
      svg: function () {
        return '<path d="M30 16 Q30 4 50 4 Q70 4 70 16 Z" fill="#FFD25A"/>' +
          '<path d="M50 4 Q42 6 38.4 16 L44 16 Q46 7 50 4 Z" fill="#E8473C"/>' +
          '<path d="M50 4 Q58 6 61.6 16 L56 16 Q54 7 50 4 Z" fill="#4E7BE0"/>' +
          '<rect x="49.3" y="-1" width="1.4" height="5.2" fill="#5A3A22"/>' +
          '<ellipse cx="43.6" cy="-1.4" rx="6.2" ry="1.6" fill="#E8473C"/><ellipse cx="56.4" cy="-1.4" rx="6.2" ry="1.6" fill="#4E7BE0"/>' +
          '<circle cx="50" cy="-1.4" r="1.2" fill="#FFD25A"/>';
      } },
    { id: 'viking-helmet', slot: 'head', name: 'Viking Helmet', price: 320, box: [19, -2, 62, 20],
      svg: function () {
        return '<path d="M32.4 12.4 Q22 10.6 20.6 -0.4 Q27 6 34.4 7 Z" fill="#FFF3DC" stroke="#D9C7A3" stroke-width="0.7"/>' +
          '<path d="M67.6 12.4 Q78 10.6 79.4 -0.4 Q73 6 65.6 7 Z" fill="#FFF3DC" stroke="#D9C7A3" stroke-width="0.7"/>' +
          '<path d="M31 16.4 Q31 3 50 3 Q69 3 69 16.4 Z" fill="#B8C2CF"/>' +
          '<path d="M50 3.2 L50 16 M30.8 13.8 Q50 10.6 69.2 13.8" stroke="#8A94A3" stroke-width="1.4" fill="none"/>' +
          '<circle cx="40" cy="12.6" r="0.8" fill="#8A94A3"/><circle cx="60" cy="12.6" r="0.8" fill="#8A94A3"/>';
      } },
    { id: 'grad-cap', slot: 'head', name: 'Graduation Cap', price: 260, box: [24, 0, 52, 19],
      svg: function () {
        return '<path d="M37 9 L63 9 L62 16 Q50 18 38 16 Z" fill="#2E2A3A"/>' +
          '<path d="M50 1 L74 7 L50 13 L26 7 Z" fill="#3A3548" stroke="#2E2A3A" stroke-width="0.6"/>' +
          '<path d="M50 7 L68 8.2 L68 14" stroke="#FFD25A" stroke-width="0.8" fill="none"/>' +
          '<path d="M66.6 13.6 L69.4 13.6 L70 18 L66 18 Z" fill="#FFD25A"/><circle cx="50" cy="7" r="1.1" fill="#FFD25A"/>';
      } },
    { id: 'santa-hat', slot: 'head', name: 'Santa Hat', price: 200, box: [26, -1, 50, 20],
      svg: function () {
        return '<path d="M30 15.6 Q32 2 50 2.4 Q63 2.6 69.6 9.6 Q64 8.8 61 10 Q66.4 12 70 15.6 Z" fill="#E8473C"/>' +
          '<path d="M28.4 13.4 Q50 9.4 71.6 13.4 L71.6 18.2 Q50 14.2 28.4 18.2 Z" fill="#FFFFFF" stroke="#EADFD3" stroke-width="0.6"/>' +
          '<circle cx="70.4" cy="9.6" r="3.3" fill="#FFFFFF" stroke="#EADFD3" stroke-width="0.6"/>';
      } },
    { id: 'sprout', slot: 'head', name: 'Leaf Sprout', price: 120, box: [40, -5, 20, 14],
      svg: function () {
        return '<path d="M50 9.4 Q49.4 4.6 50.4 0.6" stroke="#6BA84F" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
          '<ellipse cx="45.6" cy="1.8" rx="4.6" ry="2.4" fill="#8CC46A" transform="rotate(-25 45.6 1.8)"/>' +
          '<ellipse cx="54.8" cy="0" rx="4.6" ry="2.4" fill="#6BB34E" transform="rotate(25 54.8 0)"/>';
      } },
    { id: 'headphones', slot: 'head', name: 'Headphones', price: 240, box: [14, 0, 72, 34],
      svg: function () {
        return '<path d="M21 24 Q21 2 50 2 Q79 2 79 24" stroke="#4A4A5A" stroke-width="3" fill="none" stroke-linecap="round"/>' +
          '<rect x="15.4" y="19" width="10" height="15" rx="4.4" fill="#FF8FB8" stroke="#4A4A5A" stroke-width="1.2"/>' +
          '<rect x="74.6" y="19" width="10" height="15" rx="4.4" fill="#FF8FB8" stroke="#4A4A5A" stroke-width="1.2"/>';
      } },
    { id: 'beret', slot: 'head', name: 'Red Beret', price: 150, box: [27, -1, 46, 18],
      svg: function () {
        return '<path d="M30 13.4 Q27.6 3 48 2.6 Q71 2 70.6 10 Q66.6 15.2 50 15.2 Q36 15.6 30 13.4 Z" fill="#D9465A"/>' +
          '<path d="M33 12.4 Q50 15 67 9.6" stroke="#B83246" stroke-width="0.8" fill="none"/>' +
          '<circle cx="51" cy="2.2" r="1.5" fill="#B83246"/>';
      } },
    // ---- more glasses & face (2026-10-26) ----
    { id: 'cool-shades', slot: 'face', name: 'Cool Shades', price: 180, box: [17, 29, 66, 25],
      svg: function () {
        return '<path d="M26 36 Q35 34 43.6 36 Q44 45 36 48 Q27 47 26 36 Z" fill="#2E2A3A"/>' +
          '<path d="M74 36 Q65 34 56.4 36 Q56 45 64 48 Q73 47 74 36 Z" fill="#2E2A3A"/>' +
          '<path d="M43.6 37.4 Q50 35.4 56.4 37.4" stroke="#2E2A3A" stroke-width="1.6" fill="none"/>' +
          '<path d="M26 36.4 L19 35 M74 36.4 L81 35" stroke="#2E2A3A" stroke-width="1.5" stroke-linecap="round"/>' +
          '<path d="M29 38 L33 37.4 M59 38 L63 37.4" stroke="rgba(255,255,255,0.6)" stroke-width="1.2" stroke-linecap="round"/>';
      } },
    { id: 'monocle', slot: 'face', name: 'Monocle', price: 160, box: [54, 31, 26, 36],
      svg: function () {
        return '<circle cx="65" cy="41.5" r="8.6" fill="rgba(220,240,255,0.2)" stroke="#C98A14" stroke-width="1.6"/>' +
          '<path d="M65 50.1 Q69 60 76 64" stroke="#C98A14" stroke-width="0.8" fill="none"/>' +
          '<path d="M60.4 37.4 Q62 36 64 35.6" stroke="rgba(255,255,255,0.75)" stroke-width="1" fill="none" stroke-linecap="round"/>';
      } },
    { id: 'ski-goggles', slot: 'face', name: 'Ski Goggles', price: 220, box: [16, 28, 68, 23],
      svg: function () {
        return '<defs><linearGradient id="mmGoggle" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB36B"/><stop offset="1" stop-color="#FF6F91"/></linearGradient></defs>' +
          '<path d="M18 39.4 L82 39.4" stroke="#4E7BE0" stroke-width="4"/>' +
          '<path d="M25 33 Q50 30 75 33 Q77 44 66 48 Q58 47.4 50 43 Q42 47.4 34 48 Q23 44 25 33 Z" fill="url(#mmGoggle)" fill-opacity="0.88" stroke="#3A3A4A" stroke-width="1.4"/>' +
          '<path d="M30 35.6 Q38 34 44 35" stroke="rgba(255,255,255,0.7)" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
      } },
    { id: '3d-glasses', slot: 'face', name: '3D Glasses', price: 140, box: [17, 31, 66, 20],
      svg: function () {
        return '<rect x="27" y="35.6" width="16.4" height="11" rx="2" fill="rgba(232,71,60,0.75)" stroke="#FFFFFF" stroke-width="1.8"/>' +
          '<rect x="56.6" y="35.6" width="16.4" height="11" rx="2" fill="rgba(78,123,224,0.75)" stroke="#FFFFFF" stroke-width="1.8"/>' +
          '<path d="M43.4 38.4 Q50 36.6 56.6 38.4 M27 37.4 L19 36 M73 37.4 L81 36" stroke="#FFFFFF" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
      } },
    { id: 'smart-glasses', slot: 'face', name: 'Smart Glasses', price: 120, box: [17, 30, 66, 22],
      svg: function () {
        return '<rect x="26.8" y="34.4" width="16.6" height="14" rx="3" fill="rgba(210,235,255,0.16)" stroke="#2E2A3A" stroke-width="1.8"/>' +
          '<rect x="56.6" y="34.4" width="16.6" height="14" rx="3" fill="rgba(210,235,255,0.16)" stroke="#2E2A3A" stroke-width="1.8"/>' +
          '<path d="M43.4 38.6 Q50 36.4 56.6 38.6 M26.8 37.4 L19 36 M73.2 37.4 L81 36" stroke="#2E2A3A" stroke-width="1.5" fill="none" stroke-linecap="round"/>';
      } },
    { id: 'cat-eye-glasses', slot: 'face', name: 'Cat-Eye Glasses', price: 200, box: [17, 29, 66, 24],
      svg: function () {
        return '<path d="M26 35.4 Q34 34 43.4 36.8 Q43.4 46 35 48 Q27 47 26.4 40 L23.4 32.6 Z" fill="rgba(255,143,184,0.25)" stroke="#C2185B" stroke-width="1.6" stroke-linejoin="round"/>' +
          '<path d="M74 35.4 Q66 34 56.6 36.8 Q56.6 46 65 48 Q73 47 73.6 40 L76.6 32.6 Z" fill="rgba(255,143,184,0.25)" stroke="#C2185B" stroke-width="1.6" stroke-linejoin="round"/>' +
          '<path d="M43.4 38 Q50 36 56.6 38" stroke="#C2185B" stroke-width="1.5" fill="none"/>' +
          '<circle cx="24" cy="33.6" r="1.2" fill="#FFE27A"/><circle cx="76" cy="33.6" r="1.2" fill="#FFE27A"/>';
      } },
    { id: 'flower-shades', slot: 'face', name: 'Flower Shades', price: 260, box: [17, 29, 66, 25],
      svg: function () {
        var s = '';
        [35, 65].forEach(function (x) {
          for (var i = 0; i < 6; i++) {
            var a = i / 6 * Math.PI * 2;
            s += '<circle cx="' + (x + Math.cos(a) * 5.6).toFixed(2) + '" cy="' + (41.5 + Math.sin(a) * 5.6).toFixed(2) + '" r="4" fill="#FFD25A" stroke="#F0A830" stroke-width="0.6"/>';
          }
          s += '<circle cx="' + x + '" cy="41.5" r="5" fill="rgba(255,143,60,0.88)"/>';
        });
        return s + '<path d="M44.6 39.4 Q50 37 55.4 39.4" stroke="#F0A830" stroke-width="1.5" fill="none"/>';
      } },
    { id: 'rainbow-shades', slot: 'face', name: 'Rainbow Shades', price: 240, box: [17, 29, 66, 25],
      svg: function () {
        return '<defs><linearGradient id="mmRainbow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF6F91"/><stop offset="0.25" stop-color="#FFB36B"/>' +
          '<stop offset="0.5" stop-color="#FFE27A"/><stop offset="0.75" stop-color="#8CC46A"/><stop offset="1" stop-color="#5ED6E8"/></linearGradient></defs>' +
          '<circle cx="35" cy="41.5" r="8.4" fill="url(#mmRainbow)" fill-opacity="0.86" stroke="#FFFFFF" stroke-width="1.6"/>' +
          '<circle cx="65" cy="41.5" r="8.4" fill="url(#mmRainbow)" fill-opacity="0.86" stroke="#FFFFFF" stroke-width="1.6"/>' +
          '<path d="M43.4 40.4 Q50 37.4 56.6 40.4" stroke="#FFFFFF" stroke-width="1.5" fill="none"/>' + FRAME_ARMS;
      } },
    { id: 'diving-mask', slot: 'face', name: 'Diving Mask', price: 280, box: [17, 6, 74, 46],
      svg: function () {
        return '<path d="M18 39 L82 39" stroke="#2EC4B6" stroke-width="3"/>' +
          '<path d="M24 33 Q50 28 76 33 Q78 46 64 49 L56 47 Q50 44 44 47 L36 49 Q22 46 24 33 Z" fill="rgba(150,220,255,0.35)" stroke="#F59E2A" stroke-width="2.4" stroke-linejoin="round"/>' +
          '<path d="M80 36 L84.4 36 L84.4 14 Q84.4 9.6 88.6 9.6" stroke="#F59E2A" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M30 35.4 Q38 33.4 44 34.6" stroke="rgba(255,255,255,0.75)" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
      } },
    { id: 'heart-cheeks', slot: 'face', name: 'Heart Cheeks', price: 100, box: [20, 42, 60, 14],
      svg: function () {
        return '<path d="' + heartPath(26, 50, 3.6) + '" fill="#FF6F91" fill-opacity="0.9"/>' +
          '<path d="' + heartPath(74, 50, 3.6) + '" fill="#FF6F91" fill-opacity="0.9"/>';
      } },
    { id: 'star-cheeks', slot: 'face', name: 'Star Cheeks', price: 100, box: [20, 42, 60, 14],
      svg: function () {
        return '<path d="' + starPath(26, 49.6, 4) + '" fill="#FFD25A" stroke="#F0A830" stroke-width="0.5"/>' +
          '<path d="' + starPath(74, 49.6, 4) + '" fill="#FFD25A" stroke="#F0A830" stroke-width="0.5"/>';
      } },
    { id: 'pirate-patch', slot: 'face', name: 'Pirate Patch', price: 150, box: [20, 28, 62, 26],
      svg: function () {
        return '<path d="M22 31 L78 50" stroke="#2E2A3A" stroke-width="1.2"/>' +
          '<ellipse cx="35" cy="41.8" rx="8.2" ry="8.6" fill="#2E2A3A"/>' +
          '<path d="' + starPath(35, 42, 3) + '" fill="#FFD25A"/>';
      } },
    { id: 'golden-rounds', slot: 'face', name: 'Golden Rounds', price: 300, box: [17, 29, 66, 25],
      svg: function () {
        return '<circle cx="35" cy="41.5" r="8.4" fill="rgba(255,214,120,0.35)" stroke="#E0A21B" stroke-width="2"/>' +
          '<circle cx="65" cy="41.5" r="8.4" fill="rgba(255,214,120,0.35)" stroke="#E0A21B" stroke-width="2"/>' +
          '<path d="M43.4 40.4 Q50 37.4 56.6 40.4 M26.6 40.2 L19 38.6 M73.4 40.2 L81 38.6" stroke="#E0A21B" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
          '<path d="M30.4 37 Q32 35.4 34.2 35" stroke="rgba(255,255,255,0.8)" stroke-width="1" fill="none" stroke-linecap="round"/>';
      } },
    // ---- more necklaces (2026-10-26) ----
    { id: 'cozy-scarf', slot: 'neck', name: 'Cozy Scarf', price: 200, box: [22, 55, 56, 27],
      svg: function () {
        return '<path d="M61 63 L66 80 L57.6 80 L55.4 65 Z" fill="#C93A30"/>' +
          '<path d="M58 80 L58 82 M60.6 80 L60.6 82.4 M63.2 80 L63.2 82.4 M65.6 80 L65.8 82" stroke="#C93A30" stroke-width="0.9"/>' +
          '<path d="M24 58 Q50 70 76 58 L77 64.4 Q50 77 23 64.4 Z" fill="#E8473C"/>' +
          '<path d="M23.6 61.2 Q50 73.6 76.4 61.2" stroke="#FFF6E8" stroke-width="1" fill="none" stroke-dasharray="3 2"/>';
      } },
    { id: 'bell-collar', slot: 'neck', name: 'Bell Collar', price: 160, box: [28, 55, 44, 16],
      svg: function () {
        return '<path d="M30 58 Q50 66 70 58" stroke="#E8473C" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
          '<circle cx="50" cy="65.6" r="3.7" fill="#FFD54A" stroke="#C98A14" stroke-width="0.7"/>' +
          '<path d="M47.2 66.6 L52.8 66.6" stroke="#C98A14" stroke-width="0.7"/><circle cx="50" cy="68" r="0.7" fill="#7A4A0C"/>' +
          '<circle cx="48.8" cy="64.4" r="0.8" fill="rgba(255,255,255,0.8)"/>';
      } },
    { id: 'star-necklace', slot: 'neck', name: 'Star Necklace', price: 200, box: [30, 56, 40, 18],
      svg: function () {
        return '<path d="M32 58 Q50 72 68 58" stroke="#E0A21B" stroke-width="0.7" fill="none"/>' +
          '<path d="' + starPath(50, 67.8, 4) + '" fill="#FFD25A" stroke="#E0A21B" stroke-width="0.6" stroke-linejoin="round"/>';
      } },
    { id: 'heart-locket', slot: 'neck', name: 'Heart Locket', price: 240, box: [30, 56, 40, 18],
      svg: function () {
        return '<path d="M32 58 Q50 72 68 58" stroke="#B8C2CF" stroke-width="0.7" fill="none"/>' +
          '<path d="' + heartPath(50, 67.6, 4.2) + '" fill="#FF6F91" stroke="#D9446C" stroke-width="0.6"/>' +
          '<circle cx="48.4" cy="66.2" r="0.8" fill="rgba(255,255,255,0.85)"/>';
      } },
    { id: 'shell-necklace', slot: 'neck', name: 'Shell Necklace', price: 180, box: [28, 55, 44, 19],
      svg: function () {
        var s = '<path d="M30.5 58 Q50 72 69.5 58" stroke="#C9A27C" stroke-width="0.7" fill="none"/>';
        along(30.5, 58, 50, 72, 69.5, 58, 7).forEach(function (p, i) {
          var x = +p[0].toFixed(2), y = +p[1].toFixed(2), r = i === 3 ? 3.2 : 1.9;
          s += '<path d="M' + (x - r) + ' ' + y + ' Q' + x + ' ' + (y - r * 1.5) + ' ' + (x + r) + ' ' + y + ' Q' + x + ' ' + (y + r * 0.9) + ' ' + (x - r) + ' ' + y + ' Z" fill="' +
            (i % 2 ? '#FFE0C8' : '#FFC9A8') + '" stroke="#E6A07A" stroke-width="0.5"/>';
        });
        return s;
      } },
    { id: 'candy-necklace', slot: 'neck', name: 'Candy Necklace', price: 160, box: [28, 55, 44, 18],
      svg: function () {
        var s = '';
        var colors = ['#FFB3CA', '#FFE27A', '#B5E8D0', '#C9A0F5', '#FFC9A8'];
        along(31, 58, 50, 72, 69, 58, 13).forEach(function (p, i) {
          s += '<circle cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="1.55" fill="' + colors[i % colors.length] + '" stroke="rgba(0,0,0,0.08)" stroke-width="0.3"/>';
        });
        return s;
      } },
    { id: 'red-bandana', slot: 'neck', name: 'Red Bandana', price: 180, box: [28, 55, 44, 25],
      svg: function () {
        return '<path d="M30 57 Q50 63 70 57 L50 78 Z" fill="#E8473C" stroke="#C93A30" stroke-width="0.6" stroke-linejoin="round"/>' +
          '<circle cx="42" cy="62" r="1" fill="#FFF6E8"/><circle cx="50" cy="64.6" r="1" fill="#FFF6E8"/><circle cx="58" cy="62" r="1" fill="#FFF6E8"/>' +
          '<circle cx="46" cy="69" r="1" fill="#FFF6E8"/><circle cx="54" cy="69" r="1" fill="#FFF6E8"/><circle cx="50" cy="74" r="0.9" fill="#FFF6E8"/>';
      } },
    { id: 'silver-medal', slot: 'neck', name: 'Silver Medal', price: 250, box: [36, 57, 28, 25],
      svg: function () {
        return '<defs><linearGradient id="mmSilver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6F8FB"/><stop offset="1" stop-color="#A9B2C3"/></linearGradient></defs>' +
          '<path d="M42 58 L48.6 71 L51.4 71 L45.4 58 Z" fill="#4E7BE0"/><path d="M58 58 L51.4 71 L48.6 71 L54.6 58 Z" fill="#8CC46A"/>' +
          '<circle cx="50" cy="74.6" r="5.4" fill="url(#mmSilver)" stroke="#8A94A3" stroke-width="0.8"/>' +
          '<path d="' + starPath(50, 74.8, 3) + '" fill="#FFFFFF"/>';
      } },
    { id: 'bronze-medal', slot: 'neck', name: 'Bronze Medal', price: 150, box: [36, 57, 28, 25],
      svg: function () {
        return '<defs><linearGradient id="mmBronze" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6C7A0"/><stop offset="1" stop-color="#B5713E"/></linearGradient></defs>' +
          '<path d="M42 58 L48.6 71 L51.4 71 L45.4 58 Z" fill="#E8604C"/><path d="M58 58 L51.4 71 L48.6 71 L54.6 58 Z" fill="#FFD25A"/>' +
          '<circle cx="50" cy="74.6" r="5.4" fill="url(#mmBronze)" stroke="#94582C" stroke-width="0.8"/>' +
          '<path d="' + starPath(50, 74.8, 3) + '" fill="#FFE6CF"/>';
      } },
    { id: 'lucky-clover', slot: 'neck', name: 'Lucky Clover', price: 220, box: [30, 56, 40, 20],
      svg: function () {
        var s = '<path d="M32 58 Q50 72 68 58" stroke="#6BA84F" stroke-width="0.7" fill="none"/>';
        [0, 90, 180, 270].forEach(function (r) {
          s += '<path d="' + heartPath(50, 65.4, 2.7) + '" fill="#5BB55B" transform="rotate(' + (r + 180) + ' 50 68.4)"/>';
        });
        return s + '<circle cx="50" cy="68.4" r="0.8" fill="#3E8E3E"/>';
      } },
    { id: 'rainbow-scarf', slot: 'neck', name: 'Rainbow Scarf', price: 280, box: [22, 55, 56, 27],
      svg: function () {
        var colors = ['#FF6F91', '#FFB36B', '#FFE27A', '#8CC46A', '#5ED6E8'];
        var s = '';
        colors.forEach(function (c, i) {
          s += '<path d="M' + (56 + i * 2) + ' 65 L' + (57.6 + i * 2) + ' 80 L' + (59.6 + i * 2) + ' 80 L' + (58 + i * 2) + ' 65 Z" fill="' + c + '"/>';
        });
        colors.forEach(function (c, i) {
          var y = 58.6 + i * 1.4;
          s += '<path d="M' + (24 - i * 0.2) + ' ' + y + ' Q50 ' + (70.4 + i * 1.4) + ' ' + (76 + i * 0.2) + ' ' + y + '" stroke="' + c + '" stroke-width="1.6" fill="none"/>';
        });
        return s;
      } },
    { id: 'sakura-lei', slot: 'neck', name: 'Sakura Lei', price: 220, box: [25, 56, 50, 16],
      svg: function () {
        var s = '';
        var colors = ['#FFC1D9', '#FF8FB8', '#FFE4EE'];
        along(29.5, 59, 50, 74, 70.5, 59, 11).forEach(function (p, i) {
          s += flower(+p[0].toFixed(2), +p[1].toFixed(2), 2.7, colors[i % colors.length], '#FFE27A');
        });
        return s;
      } }
  ];
  // ---------- moods (expressions, 2026-10-26) ----------
  // Same 100×100 grid as the clothes. Each mood first hides Moku's own eyes
  // and eyebrows under a soft patch of his face color, then draws new eyes.
  // Drawn under the Face items, so glasses still sit on top.
  var FACE_FUR = '#F4E6D7', EYE_INK = '#2A1712';
  var EYE_L = [35, 41], EYE_R = [65, 41];
  function moodPatch() {
    return '<defs><radialGradient id="mmPatch" cx="50%" cy="50%" r="50%"><stop offset="0.74" stop-color="' + FACE_FUR + '"/>' +
      '<stop offset="1" stop-color="' + FACE_FUR + '" stop-opacity="0"/></radialGradient></defs>' +
      '<ellipse cx="34.6" cy="39.2" rx="11.4" ry="13.6" fill="url(#mmPatch)"/><ellipse cx="65.4" cy="39.2" rx="11.4" ry="13.6" fill="url(#mmPatch)"/>';
  }
  function both(fn) { return fn(EYE_L[0], EYE_L[1], -1) + fn(EYE_R[0], EYE_R[1], 1); }
  function eyeBall(x, y, rx, ry) {
    return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="' + EYE_INK + '"/>' +
      '<circle cx="' + (x - rx * 0.32).toFixed(2) + '" cy="' + (y - ry * 0.38).toFixed(2) + '" r="' + (rx * 0.32).toFixed(2) + '" fill="#FFFFFF"/>' +
      '<circle cx="' + (x + rx * 0.3).toFixed(2) + '" cy="' + (y + ry * 0.3).toFixed(2) + '" r="' + (rx * 0.14).toFixed(2) + '" fill="#FFFFFF"/>';
  }
  function line(d, w, color) {
    return '<path d="' + d + '" stroke="' + (color || EYE_INK) + '" stroke-width="' + (w || 2.3) + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function txt(x, y, size, color, s) {
    return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" font-weight="900" fill="' + color + '" font-family="-apple-system,Segoe UI,Roboto,sans-serif" text-anchor="middle">' + s + '</text>';
  }
  function spiralPath(cx, cy, turns, r) {
    var d = '', n = Math.round(turns * 14);
    for (var i = 0; i <= n; i++) {
      var a = i / 14 * Math.PI * 2, rr = 0.3 + i / n * r;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2);
    }
    return d;
  }
  var MOODS = [
    { id: 'mood-happy', name: 'Happy', price: 150, art: function () {
        return both(function (x, y) { return line('M' + (x - 6) + ' ' + (y + 2) + ' Q' + x + ' ' + (y - 6.4) + ' ' + (x + 6) + ' ' + (y + 2), 2.6); });
      } },
    { id: 'mood-wink', name: 'Wink', price: 150, art: function () {
        return eyeBall(35, 41, 5.4, 7) + line('M58.6 42.6 Q65 35.6 71.4 42.6', 2.6) + line('M28 31.4 Q34 29 40.6 31', 2, '#5E2D1E');
      } },
    { id: 'mood-heart-eyes', name: 'Heart Eyes', price: 200, art: function () {
        return both(function (x, y) {
          return '<path d="' + heartPath(x, y, 6.6) + '" fill="#FF4F7A" stroke="#C2185B" stroke-width="0.6"/>' +
            '<circle cx="' + (x - 2.6) + '" cy="' + (y - 2.6) + '" r="1.3" fill="#FFFFFF"/>';
        });
      } },
    { id: 'mood-star-eyes', name: 'Star Eyes', price: 200, art: function () {
        return both(function (x, y) {
          return '<path d="' + starPath(x, y, 7.4) + '" fill="#FFD25A" stroke="#E0A21B" stroke-width="0.8" stroke-linejoin="round"/>' +
            '<circle cx="' + (x - 1.6) + '" cy="' + (y - 1.8) + '" r="1.2" fill="#FFFFFF"/>';
        }) + '<path d="' + starPath(82, 28, 2.4) + '" fill="#FFE27A"/><path d="' + starPath(18, 30, 1.8) + '" fill="#FFE27A"/>';
      } },
    { id: 'mood-sleepy', name: 'Sleepy', price: 150, art: function () {
        return both(function (x, y) { return line('M' + (x - 6) + ' ' + y + ' Q' + x + ' ' + (y + 4.4) + ' ' + (x + 6) + ' ' + y, 2.4); }) +
          txt(80, 22, 9, '#5A7BD8', 'Z') + txt(87, 14, 6.4, '#5A7BD8', 'z');
      } },
    { id: 'mood-surprised', name: 'Surprised', price: 150, art: function () {
        return both(function (x, y) {
          return '<circle cx="' + x + '" cy="' + y + '" r="7" fill="#FFFFFF" stroke="' + EYE_INK + '" stroke-width="1.6"/>' +
            '<circle cx="' + x + '" cy="' + y + '" r="2.6" fill="' + EYE_INK + '"/>';
        }) + line('M28.6 29.4 Q35 25.4 41.4 29.4', 2, '#5E2D1E') + line('M58.6 29.4 Q65 25.4 71.4 29.4', 2, '#5E2D1E');
      } },
    { id: 'mood-shy', name: 'Shy', price: 180, art: function () {
        return both(function (x, y) { return eyeBall(x + 2.4, y + 1, 3.8, 5); }) +
          '<ellipse cx="27" cy="49" rx="6" ry="3.4" fill="#FF8FA3" fill-opacity="0.75"/><ellipse cx="73" cy="49" rx="6" ry="3.4" fill="#FF8FA3" fill-opacity="0.75"/>' +
          line('M23.6 47.4 L25.4 50.4 M27 47 L28.8 50 M71 47 L72.8 50 M74.6 47.4 L76.4 50.4', 0.9, '#E0566F');
      } },
    { id: 'mood-puppy-eyes', name: 'Puppy Eyes', price: 200, art: function () {
        return both(function (x, y) {
          return '<ellipse cx="' + x + '" cy="' + (y + 1) + '" rx="7.2" ry="8.2" fill="' + EYE_INK + '"/>' +
            '<circle cx="' + (x - 2.4) + '" cy="' + (y - 2.2) + '" r="2.6" fill="#FFFFFF"/><circle cx="' + (x + 2.6) + '" cy="' + (y + 3.6) + '" r="1.3" fill="#FFFFFF"/>' +
            '<circle cx="' + (x + 2.8) + '" cy="' + (y - 3.2) + '" r="0.9" fill="#FFFFFF"/>';
        }) + line('M28 31 Q34 31 40.6 27.6', 2, '#5E2D1E') + line('M72 31 Q66 31 59.4 27.6', 2, '#5E2D1E');
      } },
    { id: 'mood-laughing', name: 'Laughing', price: 180, art: function () {
        return line('M30 36.4 L39.6 41 L30 45.6', 2.6) + line('M70 36.4 L60.4 41 L70 45.6', 2.6) +
          '<path d="M82 40 q2 -1 2.4 1.6" stroke="#7FD3FF" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
      } },
    { id: 'mood-cool', name: 'Cool', price: 200, art: function () {
        return both(function (x, y) {
          return '<path d="M' + (x - 6) + ' ' + y + ' L' + (x + 6) + ' ' + y + ' Q' + (x + 6) + ' ' + (y + 7) + ' ' + x + ' ' + (y + 7) + ' Q' + (x - 6) + ' ' + (y + 7) + ' ' + (x - 6) + ' ' + y + ' Z" fill="' + EYE_INK + '"/>' +
            line('M' + (x - 7) + ' ' + y + ' L' + (x + 7) + ' ' + y, 2.2) +
            '<circle cx="' + (x - 2) + '" cy="' + (y + 2.4) + '" r="1.1" fill="#FFFFFF"/>';
        });
      } },
    // ★ funny ones
    { id: 'mood-googly', name: 'Googly Eyes', price: 250, art: function () {
        return '<circle cx="35" cy="41" r="8" fill="#FFFFFF" stroke="' + EYE_INK + '" stroke-width="1.3"/><circle cx="37.8" cy="44.8" r="3.6" fill="' + EYE_INK + '"/>' +
          '<circle cx="65" cy="40" r="9.4" fill="#FFFFFF" stroke="' + EYE_INK + '" stroke-width="1.3"/><circle cx="61" cy="36" r="4.2" fill="' + EYE_INK + '"/>';
      } },
    { id: 'mood-dizzy', name: 'Dizzy', price: 220, art: function () {
        return both(function (x, y) { return line(spiralPath(x, y, 2.6, 6.4), 1.5); }) +
          '<path d="' + starPath(22, 24, 2.2) + '" fill="#FFD25A"/><path d="' + starPath(78, 22, 2.6) + '" fill="#FFD25A"/><path d="' + starPath(50, 18, 1.8) + '" fill="#FFD25A"/>';
      } },
    { id: 'mood-moint-eyes', name: 'Moint Eyes', price: 300, art: function () {
        return both(function (x, y) {
          return '<circle cx="' + x + '" cy="' + y + '" r="7.4" fill="#F5B83D" stroke="#9A6512" stroke-width="1"/>' +
            '<circle cx="' + x + '" cy="' + y + '" r="5.6" fill="none" stroke="#FFE7A3" stroke-width="0.7"/>' + txt(x, y + 3.4, 9.4, '#7A4A0C', 'M');
        });
      } },
    { id: 'mood-crying', name: 'Crying a River', price: 250, art: function () {
        return both(function (x, y, k) {
          return line('M' + (x - 6) + ' ' + (y - 1) + ' Q' + x + ' ' + (y - 6) + ' ' + (x + 6) + ' ' + (y - 1), 2.4) +
            '<path d="M' + (x - 3) + ' ' + (y + 1) + ' Q' + (x - 6 * k) + ' ' + (y + 10) + ' ' + (x - 3) + ' ' + (y + 19) + ' Q' + (x - 6 * k) + ' ' + (y + 27) + ' ' + (x - 2) + ' ' + (y + 36) +
            ' L' + (x + 4) + ' ' + (y + 36) + ' Q' + (x + 1 - 6 * k) + ' ' + (y + 27) + ' ' + (x + 3) + ' ' + (y + 19) + ' Q' + (x + 1 - 6 * k) + ' ' + (y + 10) + ' ' + (x + 3) + ' ' + (y + 1) + ' Z" fill="#7FD3FF" fill-opacity="0.85"/>';
        }) + line('M28 30.6 Q34 33 40.6 34.6', 2, '#5E2D1E') + line('M72 30.6 Q66 33 59.4 34.6', 2, '#5E2D1E');
      } },
    { id: 'mood-derp', name: 'Derp', price: 250, art: function () {
        return '<circle cx="35" cy="41" r="7" fill="#FFFFFF" stroke="' + EYE_INK + '" stroke-width="1.3"/><circle cx="39" cy="42" r="3" fill="' + EYE_INK + '"/>' +
          '<circle cx="65" cy="42" r="5.6" fill="#FFFFFF" stroke="' + EYE_INK + '" stroke-width="1.3"/><circle cx="61.6" cy="41" r="2.4" fill="' + EYE_INK + '"/>' +
          line('M28 31 Q34 27.6 40 31', 1.8, '#5E2D1E') + line('M60 34 Q65 33 70 35', 1.8, '#5E2D1E');
      } },
    { id: 'mood-tongue', name: 'Tongue Out', price: 220, art: function () {
        return eyeBall(35, 41, 5.4, 7) + line('M59 37 L70 41 L59 45', 2.6) +
          '<path d="M46.6 53 Q46 62 50.6 63.4 Q55.6 63 54.4 53 Z" fill="#FF7A93" stroke="#D9446C" stroke-width="0.7"/>' +
          line('M50.4 55 L50.6 60', 0.8, '#D9446C');
      } },
    { id: 'mood-snoring', name: 'Snoring', price: 250, art: function () {
        return both(function (x, y) { return line('M' + (x - 6) + ' ' + y + ' Q' + x + ' ' + (y + 4.4) + ' ' + (x + 6) + ' ' + y, 2.4); }) +
          '<circle cx="60.6" cy="51" r="6" fill="rgba(170,225,255,0.55)" stroke="#7FC4F0" stroke-width="0.8"/>' +
          '<path d="M57.6 48 Q58.6 46.4 60.6 46.2" stroke="#FFFFFF" stroke-width="1.1" fill="none" stroke-linecap="round"/>' + txt(80, 24, 8, '#5A7BD8', 'z');
      } },
    { id: 'mood-side-eye', name: 'Side-Eye', price: 220, art: function () {
        return both(function (x, y) {
          return '<path d="M' + (x - 6.4) + ' ' + (y - 1) + ' L' + (x + 6.4) + ' ' + (y - 1) + ' Q' + (x + 6) + ' ' + (y + 6) + ' ' + x + ' ' + (y + 6) + ' Q' + (x - 6) + ' ' + (y + 6) + ' ' + (x - 6.4) + ' ' + (y - 1) + ' Z" fill="#FFFFFF" stroke="' + EYE_INK + '" stroke-width="1.2"/>' +
            '<circle cx="' + (x - 3.6) + '" cy="' + (y + 2) + '" r="2.6" fill="' + EYE_INK + '"/>' + line('M' + (x - 7.4) + ' ' + (y - 1) + ' L' + (x + 7.4) + ' ' + (y - 1), 2.2);
        });
      } },
    { id: 'mood-sweat', name: 'Sweat Drop', price: 200, art: function () {
        return both(function (x, y) { return eyeBall(x, y + 1, 4.6, 6); }) +
          line('M28 33 Q34 33 40.4 30', 2, '#5E2D1E') + line('M72 33 Q66 33 59.6 30', 2, '#5E2D1E') +
          '<path d="M76 20 Q71 29 74 32 Q78 34 80 30 Q81 26 76 20 Z" fill="#9BDCFF" stroke="#5FB4E6" stroke-width="0.8"/>' +
          '<path d="M74.6 27 Q74.6 29.4 76 30.4" stroke="#FFFFFF" stroke-width="0.9" fill="none" stroke-linecap="round"/>';
      } },
    { id: 'mood-pixel', name: 'Pixel Eyes', price: 300, art: function () {
        var px = function (x, y) {
          var s = '', map = ['0110', '1111', '1111', '0110'];
          map.forEach(function (row, r) {
            row.split('').forEach(function (c, ci) {
              if (c === '1') s += '<rect x="' + (x - 6 + ci * 3) + '" y="' + (y - 6 + r * 3) + '" width="3" height="3" fill="' + EYE_INK + '"/>';
            });
          });
          return s + '<rect x="' + (x - 3) + '" y="' + (y - 3) + '" width="3" height="3" fill="#FFFFFF"/>';
        };
        return px(35, 41) + px(65, 41);
      } },
    // the kids' ideas: food eyes, Show-Off and Meh
    { id: 'mood-cake-eyes', name: 'Cake Eyes', price: 300, art: function () {
        return both(function (x, y) {
          return '<path d="M' + (x - 7) + ' ' + (y + 5) + ' L' + (x + 7) + ' ' + (y + 5) + ' L' + (x + 7) + ' ' + (y - 1) + ' L' + (x - 7) + ' ' + (y - 4) + ' Z" fill="#FFE2A0" stroke="#C99A4A" stroke-width="0.6" stroke-linejoin="round"/>' +
            '<path d="M' + (x - 7) + ' ' + (y + 1) + ' L' + (x + 7) + ' ' + (y + 2.4) + '" stroke="#FFFFFF" stroke-width="1.6"/>' +
            '<path d="M' + (x - 7.4) + ' ' + (y - 4.4) + ' L' + (x + 7.4) + ' ' + (y - 1.2) + '" stroke="#FFFFFF" stroke-width="2"/>' +
            '<path d="M' + (x + 1) + ' ' + (y - 2.6) + ' Q' + (x - 2) + ' ' + (y - 8) + ' ' + (x + 2) + ' ' + (y - 9) + ' Q' + (x + 6) + ' ' + (y - 8) + ' ' + (x + 3) + ' ' + (y - 2.2) + ' Z" fill="#E8473C"/>' +
            '<path d="M' + (x + 1) + ' ' + (y - 9.4) + ' l1.2 -1.6 1.2 1.6" stroke="#6BA84F" stroke-width="0.9" fill="none"/>';
        });
      } },
    { id: 'mood-ice-cream-eyes', name: 'Ice Cream Eyes', price: 300, art: function () {
        return both(function (x, y) {
          return '<path d="M' + (x - 4.6) + ' ' + (y + 1) + ' L' + x + ' ' + (y + 9) + ' L' + (x + 4.6) + ' ' + (y + 1) + ' Z" fill="#E8B06A" stroke="#B97E3A" stroke-width="0.6" stroke-linejoin="round"/>' +
            '<path d="M' + (x - 3) + ' ' + (y + 3) + ' L' + (x + 1.6) + ' ' + (y + 6) + ' M' + (x + 3) + ' ' + (y + 3) + ' L' + (x - 1.6) + ' ' + (y + 6) + '" stroke="#B97E3A" stroke-width="0.5"/>' +
            '<circle cx="' + x + '" cy="' + (y - 2.4) + '" r="5.4" fill="#FFB3CA" stroke="#E57FA0" stroke-width="0.6"/>' +
            '<circle cx="' + (x - 1.8) + '" cy="' + (y - 4.2) + '" r="1.1" fill="#FFFFFF"/><circle cx="' + (x + 1.6) + '" cy="' + (y - 7.4) + '" r="1.1" fill="#E8473C"/>';
        });
      } },
    { id: 'mood-chocolate-eyes', name: 'Chocolate Eyes', price: 280, art: function () {
        return both(function (x, y) {
          return '<rect x="' + (x - 6.6) + '" y="' + (y - 5.6) + '" width="13.2" height="11.2" rx="1.2" fill="#7A4A2E" stroke="#5A3220" stroke-width="0.7"/>' +
            '<path d="M' + x + ' ' + (y - 5.6) + ' L' + x + ' ' + (y + 5.6) + ' M' + (x - 6.6) + ' ' + y + ' L' + (x + 6.6) + ' ' + y + '" stroke="#5A3220" stroke-width="0.8"/>' +
            '<path d="M' + (x + 1.6) + ' ' + (y + 5.6) + ' L' + (x + 6.6) + ' ' + (y + 0.6) + ' L' + (x + 6.6) + ' ' + (y + 5.6) + ' Z" fill="#C9D2DE"/>' +
            '<path d="M' + (x - 5) + ' ' + (y - 4) + ' L' + (x - 2) + ' ' + (y - 4) + '" stroke="rgba(255,255,255,0.4)" stroke-width="0.8" stroke-linecap="round"/>';
        });
      } },
    { id: 'mood-candy-eyes', name: 'Candy Eyes', price: 260, art: function () {
        return both(function (x, y) {
          return '<circle cx="' + x + '" cy="' + y + '" r="6.8" fill="#FFFFFF" stroke="#E8473C" stroke-width="0.8"/>' +
            line(spiralPath(x, y, 2.2, 6), 1.8, '#FF6F91');
        });
      } },
    { id: 'mood-senbei-eyes', name: 'Rice Cracker Eyes', price: 280, art: function () {
        return both(function (x, y) {
          return '<circle cx="' + x + '" cy="' + y + '" r="7" fill="#D9A55A" stroke="#A8732E" stroke-width="0.8"/>' +
            '<circle cx="' + (x - 2.6) + '" cy="' + (y - 3) + '" r="0.8" fill="#B07A36"/><circle cx="' + (x + 3) + '" cy="' + (y - 2.4) + '" r="0.7" fill="#B07A36"/>' +
            '<circle cx="' + (x - 3.4) + '" cy="' + (y + 2.6) + '" r="0.7" fill="#B07A36"/>' +
            '<rect x="' + (x - 1.8) + '" y="' + (y - 7.2) + '" width="3.6" height="14.4" fill="#22302A"/>';
        });
      } },
    { id: 'mood-cookie-eyes', name: 'Cookie Eyes', price: 260, art: function () {
        return both(function (x, y) {
          return '<circle cx="' + x + '" cy="' + y + '" r="7" fill="#E9B97A" stroke="#B9874A" stroke-width="0.8"/>' +
            '<circle cx="' + (x - 2.8) + '" cy="' + (y - 2.4) + '" r="1.2" fill="#5A3220"/><circle cx="' + (x + 2.6) + '" cy="' + (y - 1) + '" r="1.3" fill="#5A3220"/>' +
            '<circle cx="' + (x - 1) + '" cy="' + (y + 3) + '" r="1.1" fill="#5A3220"/><circle cx="' + (x + 3.4) + '" cy="' + (y + 3.6) + '" r="0.8" fill="#5A3220"/>';
        });
      } },
    { id: 'mood-show-off', name: 'Show-Off', price: 320, art: function () {
        // one eyebrow way up, a smug squint, and a twinkle
        return line('M29 41.6 Q35 39.4 41 41.6', 2.6) + line('M29.4 36.6 Q35 37.2 40.6 35', 2, '#5E2D1E') +
          eyeBall(65, 41, 5.4, 6.8) + line('M58.4 28.6 Q65 22.6 71.6 27', 2.2, '#5E2D1E') +
          '<path d="M80 34 L81.4 37.6 L85 39 L81.4 40.4 L80 44 L78.6 40.4 L75 39 L78.6 37.6 Z" fill="#FFE27A" stroke="#F0B93A" stroke-width="0.5"/>';
      } },
    { id: 'mood-meh', name: 'Meh', price: 250, art: function () {
        // droopy flat lids, tiny bored pupils, and a little sigh
        return both(function (x, y) {
          return '<path d="M' + (x - 6.6) + ' ' + (y + 1) + ' L' + (x + 6.6) + ' ' + (y + 1) + ' Q' + (x + 6) + ' ' + (y + 6) + ' ' + x + ' ' + (y + 6) + ' Q' + (x - 6) + ' ' + (y + 6) + ' ' + (x - 6.6) + ' ' + (y + 1) + ' Z" fill="#FFFFFF" stroke="' + EYE_INK + '" stroke-width="1.1"/>' +
            '<circle cx="' + x + '" cy="' + (y + 4) + '" r="1.8" fill="' + EYE_INK + '"/>' + line('M' + (x - 7.4) + ' ' + (y + 1) + ' L' + (x + 7.4) + ' ' + (y + 1), 2.4);
        }) + '<path d="M60 56 Q64 53 67 56 Q71 54 72 58 Q70 61 66 60 Q62 61 60 56 Z" fill="#FFFFFF" fill-opacity="0.85" stroke="#C9D2DE" stroke-width="0.6"/>';
      } }
  ];
  MOODS.forEach(function (m) {
    m.slot = 'mood';
    m.svg = function () { return moodPatch() + m.art(); };
  });

  // ---------- backgrounds (shown behind Moku on My Moku / in the Closet) ----------
  // Pop art: a flat sky, sunburst rays, halftone dots and a landmark in two or
  // three flat colors with a bold outline. Own 100×100 grid (the whole card).
  // Moku stands in the middle, so landmarks sit at the top and both sides.
  var INK = '#2A1F3D';
  function bgDots(id, color) {
    return '<pattern id="' + id + '" width="4" height="4" patternUnits="userSpaceOnUse">' +
      '<circle cx="2" cy="2" r="0.75" fill="' + color + '"/></pattern>';
  }
  function bgRays(cx, cy, color, n) {
    var s = '';
    for (var i = 0; i < n; i++) {
      var a0 = i / n * Math.PI * 2, a1 = (i + 0.5) / n * Math.PI * 2;
      s += '<path d="M' + cx + ' ' + cy + ' L' + (cx + Math.cos(a0) * 160).toFixed(1) + ' ' + (cy + Math.sin(a0) * 160).toFixed(1) +
        ' L' + (cx + Math.cos(a1) * 160).toFixed(1) + ' ' + (cy + Math.sin(a1) * 160).toFixed(1) + ' Z" fill="' + color + '"/>';
    }
    return s;
  }
  function bgBase(id, sky, ray, dot, cx, cy) {
    return '<defs>' + bgDots(id, dot) + '</defs><rect width="100" height="100" fill="' + sky + '"/>' +
      bgRays(cx, cy, ray, 18) + '<rect width="100" height="100" fill="url(#' + id + ')"/>';
  }
  var BACKGROUNDS = [
    { id: 'bg-japan', slot: 'bg', name: 'Japan', price: 300,
      svg: function () {
        return bgBase('mmDotJp', '#FFF1D6', '#FFE3B8', 'rgba(232,71,60,0.18)', 78, 20) +
          '<circle cx="78" cy="20" r="13" fill="#E8473C" stroke="' + INK + '" stroke-width="1.4"/>' +
          // Mt. Fuji on the left
          '<path d="M-4 100 L20 36 Q23 31 26 36 L58 100 Z" fill="#4E6FB8" stroke="' + INK + '" stroke-width="1.4" stroke-linejoin="round"/>' +
          '<path d="M14.6 50 L20 36 Q23 31 26 36 L31.4 50 L27 46.6 L23 51 L19 46.6 Z" fill="#FFFFFF" stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="round"/>' +
          // torii on the right
          '<path d="M74 58 L98 58 M72 54 Q86 51 100 54" stroke="#E8473C" stroke-width="3.2" stroke-linecap="round"/>' +
          '<path d="M78 56 L78 100 M94 56 L94 100" stroke="#E8473C" stroke-width="3"/>' +
          '<path d="M72 54 Q86 51 100 54 M78 58 L78 100 M94 58 L94 100" stroke="' + INK + '" stroke-width="0.6" fill="none"/>' +
          // waves
          '<path d="M0 92 Q6 84 12 92 Q18 84 24 92 Q30 84 36 92 Q42 84 48 92 Q54 84 60 92 Q66 84 72 92 Q78 84 84 92 Q90 84 96 92 Q102 84 108 92 L108 100 L0 100 Z" fill="#2E4A7A" stroke="' + INK + '" stroke-width="1"/>';
      } },
    { id: 'bg-kl', slot: 'bg', name: 'Kuala Lumpur', price: 300,
      svg: function () {
        var tower = function (x) {
          return '<path d="M' + (x - 5) + ' 100 L' + (x - 5) + ' 34 L' + (x - 3.6) + ' 26 L' + (x - 2.4) + ' 18 L' + x + ' 6 L' + (x + 2.4) + ' 18 L' + (x + 3.6) + ' 26 L' + (x + 5) + ' 34 L' + (x + 5) + ' 100 Z" fill="#2D6E8E" stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="round"/>' +
            '<path d="M' + (x - 5) + ' 44 L' + (x + 5) + ' 44 M' + (x - 5) + ' 58 L' + (x + 5) + ' 58 M' + (x - 5) + ' 72 L' + (x + 5) + ' 72 M' + (x - 5) + ' 86 L' + (x + 5) + ' 86" stroke="#7FC4DE" stroke-width="1"/>';
        };
        return bgBase('mmDotKl', '#FFD45A', '#FFE58C', 'rgba(232,96,40,0.22)', 50, 14) +
          '<circle cx="50" cy="14" r="9" fill="#FFF6E0" stroke="' + INK + '" stroke-width="1.2"/>' +
          // Petronas Twin Towers (left)
          tower(8) + tower(24) +
          '<path d="M13 50 L19 50" stroke="' + INK + '" stroke-width="2.4"/>' +
          // KL Tower (right)
          '<path d="M88 100 L89.4 40 L90.6 40 L92 100 Z" fill="#2D6E8E" stroke="' + INK + '" stroke-width="1.2"/>' +
          '<ellipse cx="90" cy="38" rx="6" ry="4" fill="#E8604C" stroke="' + INK + '" stroke-width="1.2"/>' +
          '<path d="M90 34 L90 18" stroke="' + INK + '" stroke-width="1.2"/>' +
          // hibiscus
          flower(80, 90, 7, '#E8473C', '#FFD45A');
      } },
    { id: 'bg-singapore', slot: 'bg', name: 'Singapore', price: 300,
      svg: function () {
        var tree = function (x, h) {
          return '<path d="M' + (x - 1.4) + ' 100 L' + (x - 1.4) + ' ' + h + ' L' + (x - 7) + ' ' + (h - 8) + ' L' + (x + 7) + ' ' + (h - 8) + ' L' + (x + 1.4) + ' ' + h + ' L' + (x + 1.4) + ' 100 Z" fill="#7E4BC4" stroke="' + INK + '" stroke-width="1.1" stroke-linejoin="round"/>' +
            '<path d="M' + (x - 7) + ' ' + (h - 8) + ' L' + (x + 7) + ' ' + (h - 8) + '" stroke="#FFE27A" stroke-width="1.2"/>';
        };
        return bgBase('mmDotSg', '#FF9A8B', '#FFB4A6', 'rgba(126,75,196,0.2)', 50, 12) +
          '<circle cx="50" cy="12" r="8" fill="#FFF6E0" stroke="' + INK + '" stroke-width="1.1"/>' +
          // Supertrees (left)
          tree(8, 46) + tree(22, 60) +
          // Marina Bay Sands (right)
          '<path d="M74 100 L75.4 44 L80.6 44 L81 100 Z M83 100 L83.6 44 L88.6 44 L89.4 100 Z M91.4 100 L92 44 L97 44 L98.6 100 Z" fill="#4A3A78" stroke="' + INK + '" stroke-width="1.1" stroke-linejoin="round"/>' +
          '<path d="M70 41 L100 39.6 L100 44 Q86 45 72 44.6 Z" fill="#2EC4B6" stroke="' + INK + '" stroke-width="1.1" stroke-linejoin="round"/>' +
          '<path d="M0 94 L100 94 L100 100 L0 100 Z" fill="#5ED6E8" stroke="' + INK + '" stroke-width="1"/>';
      } },
    { id: 'bg-vietnam', slot: 'bg', name: 'Vietnam', price: 300,
      svg: function () {
        var lantern = function (x, y) {
          return '<path d="M' + x + ' 0 L' + x + ' ' + (y - 5) + '" stroke="' + INK + '" stroke-width="0.8"/>' +
            '<ellipse cx="' + x + '" cy="' + y + '" rx="4.6" ry="5.6" fill="#E8473C" stroke="' + INK + '" stroke-width="1.1"/>' +
            '<path d="M' + (x - 2) + ' ' + (y - 5.4) + ' L' + (x + 2) + ' ' + (y - 5.4) + ' M' + (x - 2) + ' ' + (y + 5.4) + ' L' + (x + 2) + ' ' + (y + 5.4) + '" stroke="#FFD25A" stroke-width="1.6"/>' +
            '<path d="M' + x + ' ' + (y + 6) + ' L' + x + ' ' + (y + 10) + '" stroke="#FFD25A" stroke-width="0.9"/>';
        };
        return bgBase('mmDotVn', '#8ED8B6', '#A8E4C8', 'rgba(30,110,80,0.18)', 50, 18) +
          lantern(10, 16) + lantern(22, 10) + lantern(78, 10) + lantern(90, 18) +
          // Ha Long Bay islands
          '<path d="M-4 100 L-4 70 Q2 54 8 64 Q12 50 18 58 Q22 72 26 100 Z" fill="#2F7A55" stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="round"/>' +
          '<path d="M74 100 Q76 76 82 70 Q86 58 92 66 Q98 56 104 72 L104 100 Z" fill="#2F7A55" stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="round"/>' +
          // junk boat with a red sail
          '<path d="M78 84 L78 66 L90 82 Z" fill="#E8604C" stroke="' + INK + '" stroke-width="1"/>' +
          '<path d="M70 85 L94 85 L90 90 L74 90 Z" fill="#8A5A3A" stroke="' + INK + '" stroke-width="1"/>' +
          '<path d="M0 92 L100 92 L100 100 L0 100 Z" fill="#3FA6A0" stroke="' + INK + '" stroke-width="1"/>';
      } },
    { id: 'bg-indonesia', slot: 'bg', name: 'Indonesia', price: 300,
      svg: function () {
        return bgBase('mmDotId', '#FFA45A', '#FFBD80', 'rgba(200,60,40,0.2)', 20, 18) +
          '<circle cx="20" cy="18" r="10" fill="#FFE27A" stroke="' + INK + '" stroke-width="1.2"/>' +
          // volcano with a puff of smoke (right)
          '<circle cx="86" cy="22" r="5" fill="#FFFFFF" stroke="' + INK + '" stroke-width="1"/><circle cx="92" cy="16" r="4" fill="#FFFFFF" stroke="' + INK + '" stroke-width="1"/>' +
          '<path d="M64 100 L80 34 L92 34 L108 100 Z" fill="#7A4A6A" stroke="' + INK + '" stroke-width="1.3" stroke-linejoin="round"/>' +
          '<path d="M80 34 L92 34 L89 40 L83 40 Z" fill="#E8473C"/>' +
          // Borobudur-style stupa (left)
          '<path d="M2 100 L2 86 L24 86 L24 100 Z M5 86 L5 78 L21 78 L21 86 Z" fill="#B9906A" stroke="' + INK + '" stroke-width="1.1"/>' +
          '<path d="M7 78 Q7 66 13 64 Q19 66 19 78 Z" fill="#C9A27C" stroke="' + INK + '" stroke-width="1.1"/>' +
          '<path d="M13 64 L13 56" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>' +
          // rice terraces
          '<path d="M0 100 L0 94 Q50 88 100 94 L100 100 Z" fill="#6BB34E" stroke="' + INK + '" stroke-width="1"/>' +
          '<path d="M0 97 Q50 92 100 97" stroke="#A8DB6A" stroke-width="1" fill="none"/>';
      } },
    { id: 'bg-thailand', slot: 'bg', name: 'Thailand', price: 300,
      svg: function () {
        var roof = function (x, y, w, c) {
          return '<path d="M' + (x - w) + ' ' + (y + 6) + ' L' + x + ' ' + (y - 4) + ' L' + (x + w) + ' ' + (y + 6) + ' Z" fill="' + c + '" stroke="' + INK + '" stroke-width="1.1" stroke-linejoin="round"/>' +
            '<path d="M' + (x - w) + ' ' + (y + 6) + ' L' + (x - w - 2) + ' ' + (y + 2) + ' M' + (x + w) + ' ' + (y + 6) + ' L' + (x + w + 2) + ' ' + (y + 2) + '" stroke="#FFC94A" stroke-width="1.4" stroke-linecap="round"/>';
        };
        return bgBase('mmDotTh', '#FF8FC0', '#FFADD2', 'rgba(150,40,120,0.18)', 50, 16) +
          '<circle cx="50" cy="16" r="9" fill="#FFE27A" stroke="' + INK + '" stroke-width="1.2"/>' +
          // golden prang (left)
          '<path d="M4 100 L6 70 Q8 50 13 40 Q18 50 20 70 L22 100 Z" fill="#FFC94A" stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="round"/>' +
          '<path d="M13 40 L13 28" stroke="' + INK + '" stroke-width="1.4" stroke-linecap="round"/>' +
          '<path d="M7 62 L19 62 M6.4 76 L19.6 76 M6 88 L20 88" stroke="#E8604C" stroke-width="1.2"/>' +
          // temple with layered roofs (right)
          '<path d="M76 100 L76 74 L98 74 L98 100 Z" fill="#FFF1D6" stroke="' + INK + '" stroke-width="1.1"/>' +
          '<path d="M84 100 L84 84 L90 84 L90 100 Z" fill="#E8473C" stroke="' + INK + '" stroke-width="1"/>' +
          roof(87, 66, 15, '#E8473C') + roof(87, 56, 11, '#3A9A7A') + roof(87, 46, 7, '#E8473C') +
          '<path d="M87 42 L87 34" stroke="#FFC94A" stroke-width="1.6" stroke-linecap="round"/>';
      } },
    { id: 'bg-cambodia', slot: 'bg', name: 'Cambodia', price: 300,
      svg: function () {
        var tower = function (x, h, w) {
          return '<path d="M' + (x - w) + ' 90 L' + (x - w) + ' ' + (h + 12) + ' Q' + (x - w * 0.8) + ' ' + (h + 2) + ' ' + x + ' ' + h +
            ' Q' + (x + w * 0.8) + ' ' + (h + 2) + ' ' + (x + w) + ' ' + (h + 12) + ' L' + (x + w) + ' 90 Z" fill="#7A3E2E" stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="round"/>' +
            '<path d="M' + (x - w * 0.7) + ' ' + (h + 10) + ' L' + (x + w * 0.7) + ' ' + (h + 10) + ' M' + (x - w * 0.9) + ' ' + (h + 18) + ' L' + (x + w * 0.9) + ' ' + (h + 18) + '" stroke="#C26A4A" stroke-width="1"/>';
        };
        return bgBase('mmDotKh', '#C9A0F5', '#D9BBF8', 'rgba(255,140,90,0.25)', 50, 40) +
          '<circle cx="50" cy="40" r="22" fill="#FFB36B" stroke="' + INK + '" stroke-width="1.3"/>' +
          // Angkor Wat: five towers on a long base
          '<path d="M-2 90 L102 90 L102 80 L-2 80 Z" fill="#8E4C38" stroke="' + INK + '" stroke-width="1.1"/>' +
          tower(8, 48, 5) + tower(92, 48, 5) + tower(22, 38, 6) + tower(78, 38, 6) + tower(50, 26, 7) +
          // moat with lotus
          '<path d="M0 90 L100 90 L100 100 L0 100 Z" fill="#5ED6E8" stroke="' + INK + '" stroke-width="1"/>' +
          flower(14, 95, 4, '#FF8FB8', '#FFE27A') + flower(86, 95, 4, '#FF8FB8', '#FFE27A');
      } }
  ];

  // ---------- Blind Box items (2026-10-31, the kids' idea) ----------
  // Not sold one by one: each Closet tab (Hats / Moods / Face / Necklaces)
  // has a Silver Box (500) and a Gold Box (700) with 5 surprises each. A box
  // only gives something you don't have yet. Gold ones are the fancy ones.
  var BOX_GOLD = '<defs><linearGradient id="mmGoldB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE68A"/><stop offset="1" stop-color="#E0A21B"/></linearGradient></defs>';
  function sparkle(x, y, r, color) {
    return '<path d="M' + x + ' ' + (y - r) + ' Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y + r) +
      ' Q' + x + ' ' + y + ' ' + (x - r) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y - r) + ' Z" fill="' + (color || '#FFF6C8') + '"/>';
  }
  function chain(color, w) {
    return '<path d="M32 58 Q50 72 68 58" stroke="' + color + '" stroke-width="' + (w || 0.7) + '" fill="none"/>';
  }
  // the bee scarf's band, between its top and bottom edges at x
  function scarfStripe(x) {
    var top = 58 + 6 * (1 - Math.pow((x - 50) / 26, 2)), bot = 64.4 + 6.3 * (1 - Math.pow((x - 50) / 27, 2));
    return 'M' + x + ' ' + top.toFixed(2) + ' L' + x + ' ' + bot.toFixed(2);
  }
  var BOX_ITEMS = [
    // ---- Hats ----
    { id: 'frog-hat', slot: 'head', blind: 'silver', name: 'Frog Hat', box: [27, -2, 46, 20],
      svg: function () {
        return '<path d="M29 17 Q28 5 50 5 Q72 5 71 17 Z" fill="#7CC46A"/>' +
          '<circle cx="39" cy="5" r="5" fill="#7CC46A"/><circle cx="61" cy="5" r="5" fill="#7CC46A"/>' +
          '<circle cx="39" cy="5" r="3.2" fill="#FFFFFF"/><circle cx="61" cy="5" r="3.2" fill="#FFFFFF"/>' +
          '<circle cx="39.4" cy="5.4" r="1.7" fill="#2A1712"/><circle cx="60.6" cy="5.4" r="1.7" fill="#2A1712"/>' +
          '<path d="M42 12 Q50 15.5 58 12" stroke="#3E7A2E" stroke-width="1" fill="none" stroke-linecap="round"/>' +
          '<path d="M28.4 15.4 Q50 12 71.6 15.4 L71.4 17.6 Q50 14.4 28.6 17.6 Z" fill="#5BA84A"/>';
      } },
    { id: 'bee-antennae', slot: 'head', blind: 'silver', name: 'Bee Antennae', box: [28, -4, 44, 21],
      svg: function () {
        return '<path d="M29.4 18.4 Q50 7.6 70.6 18.4" stroke="#2E2A3A" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
          '<path d="M41 11.4 Q37 4 33 1 M59 11.4 Q63 4 67 1" stroke="#2E2A3A" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
          '<circle cx="33" cy="1" r="3.2" fill="#FFD54A" stroke="#2E2A3A" stroke-width="0.7"/><circle cx="67" cy="1" r="3.2" fill="#FFD54A" stroke="#2E2A3A" stroke-width="0.7"/>' +
          '<path d="M30.2 1.6 L35.8 1.6 M64.2 1.6 L69.8 1.6" stroke="#2E2A3A" stroke-width="1"/>' +
          '<circle cx="32" cy="-0.4" r="0.8" fill="#FFFFFF"/><circle cx="66" cy="-0.4" r="0.8" fill="#FFFFFF"/>';
      } },
    { id: 'mushroom-cap', slot: 'head', blind: 'silver', name: 'Mushroom Cap', box: [24, -1, 52, 20],
      svg: function () {
        return '<path d="M26 17.4 Q24 1.4 50 1 Q76 1.4 74 17.4 Q50 13.4 26 17.4 Z" fill="#E8473C"/>' +
          '<circle cx="38" cy="7" r="3" fill="#FFF6E8"/><circle cx="52" cy="4.6" r="3.6" fill="#FFF6E8"/><circle cx="64" cy="9" r="2.6" fill="#FFF6E8"/>' +
          '<circle cx="45.4" cy="12" r="1.8" fill="#FFF6E8"/><circle cx="31" cy="13" r="1.6" fill="#FFF6E8"/><circle cx="69.4" cy="14.4" r="1.4" fill="#FFF6E8"/>' +
          '<path d="M30 6 Q36 2 44 2" stroke="rgba(255,255,255,0.45)" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
      } },
    { id: 'fox-ears', slot: 'head', blind: 'silver', name: 'Fox Ears', box: [27, -3, 46, 21],
      svg: function () {
        return '<path d="M29 16 L31 -1 L44 9 Z" fill="#F08A3C" stroke-linejoin="round"/><path d="M32 12.6 L33 4 L40 9.4 Z" fill="#FFE3C8"/>' +
          '<path d="M71 16 L69 -1 L56 9 Z" fill="#F08A3C" stroke-linejoin="round"/><path d="M68 12.6 L67 4 L60 9.4 Z" fill="#FFE3C8"/>' +
          '<path d="M31 -1 L30.6 3.4 L34.4 2 Z M69 -1 L69.4 3.4 L65.6 2 Z" fill="#FFFFFF"/>';
      } },
    { id: 'strawberry-hat', slot: 'head', blind: 'silver', name: 'Strawberry Hat', box: [26, -6, 48, 25],
      svg: function () {
        var s = '<path d="M28 17 Q27 2 50 2 Q73 2 72 17 Z" fill="#F2545B"/>';
        [[37, 7], [44, 4.6], [52, 5.4], [60, 6.4], [33, 12], [41, 10.6], [49, 9.6], [57, 10.8], [65, 12]].forEach(function (p) {
          s += '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="0.7" ry="1.1" fill="#FFE27A"/>';
        });
        return s + '<path d="M27 15.4 Q50 11 73 15.4 L73 18 Q50 13.6 27 18 Z" fill="#FFF3E0" stroke="#EAD6BA" stroke-width="0.5"/>' +
          '<path d="M50 3.2 L42.6 -0.6 L47 -1.2 L50 -4 L53 -1.2 L57.4 -0.6 Z" fill="#5BA84A"/>' +
          '<path d="M50 -1 L50.6 -5.4" stroke="#3E7A2E" stroke-width="1.4" stroke-linecap="round"/>';
      } },
    { id: 'unicorn-horn', slot: 'head', blind: 'gold', name: 'Unicorn Horn', box: [36, -10, 28, 27],
      svg: function () {
        return BOX_GOLD + '<path d="M45.4 13.4 L50 -8 L54.6 13.4 Z" fill="url(#mmGoldB)" stroke="#C98A14" stroke-width="0.6" stroke-linejoin="round"/>' +
          '<path d="M46.2 9.6 L53.6 7.4 M47.2 5 L52.8 3.4 M48.2 0.6 L51.8 -0.6" stroke="#C98A14" stroke-width="0.7"/>' +
          flower(43.2, 13.6, 2.6, '#FF8FB8', '#FFE27A') + flower(56.8, 13.6, 2.6, '#C9A0F5', '#FFE27A') + flower(50, 15.4, 2.2, '#8FE3FF', '#FFE27A') +
          sparkle(58.6, -3, 2) + sparkle(41.4, 1, 1.4);
      } },
    { id: 'rainbow-cloud', slot: 'head', blind: 'gold', name: 'Rainbow Cloud', box: [21, -3, 58, 22],
      svg: function () {
        var s = '';
        ['#FF6B6B', '#FFA94D', '#FFE066', '#69DB7C', '#4DABF7', '#9775FA'].forEach(function (c, i) {
          s += '<path d="M' + (30 + i * 2.2) + ' 14 Q50 ' + (-5 + i * 2.8) + ' ' + (70 - i * 2.2) + ' 14" stroke="' + c + '" stroke-width="2.3" fill="none"/>';
        });
        function cloud(x) {
          return '<circle cx="' + x + '" cy="14" r="3.8" fill="#FFFFFF"/><circle cx="' + (x - 3.4) + '" cy="15.6" r="2.8" fill="#FFFFFF"/>' +
            '<circle cx="' + (x + 3.4) + '" cy="15.6" r="2.8" fill="#FFFFFF"/><path d="M' + (x - 6) + ' 17.6 L' + (x + 6) + ' 17.6" stroke="#E3EAF2" stroke-width="1" stroke-linecap="round"/>';
        }
        return s + cloud(31) + cloud(69) + sparkle(50, -1.6, 2.2, '#FFE27A') + sparkle(39, 3, 1.4, '#FFE27A') + sparkle(62, 2.6, 1.4, '#FFE27A');
      } },
    { id: 'golden-laurel', slot: 'head', blind: 'gold', name: 'Golden Laurel', box: [24, 0, 52, 19],
      svg: function () {
        var s = BOX_GOLD;
        along(27, 17, 50, 4, 73, 17, 13).forEach(function (p, i) {
          if (i === 6) return;
          var a = i < 6 ? -40 : 40, x = p[0].toFixed(2), y = p[1].toFixed(2);
          s += '<ellipse cx="' + x + '" cy="' + y + '" rx="2.8" ry="1.3" fill="url(#mmGoldB)" stroke="#C98A14" stroke-width="0.4" transform="rotate(' + a + ' ' + x + ' ' + y + ')"/>';
        });
        return s + '<circle cx="50" cy="10.4" r="2.3" fill="#FF5A6E" stroke="#C98A14" stroke-width="0.6"/><circle cx="49.3" cy="9.7" r="0.6" fill="#FFFFFF"/>';
      } },
    { id: 'cake-hat', slot: 'head', blind: 'gold', name: 'Birthday Cake', box: [31, -11, 38, 30],
      svg: function () {
        var s = '<path d="M33 17.6 L67 17.6" stroke="#E8D2B0" stroke-width="1.8" stroke-linecap="round"/>' +
          '<rect x="36" y="8.4" width="28" height="9" rx="1.6" fill="#FFE3EC"/>' +
          '<path d="M36 9.4 Q38 12.6 40 9.4 Q42 12.6 44 9.4 Q46 12.6 48 9.4 Q50 12.6 52 9.4 Q54 12.6 56 9.4 Q58 12.6 60 9.4 Q62 12.6 64 9.4 L64 8.4 L36 8.4 Z" fill="#FFFFFF"/>' +
          '<rect x="41" y="1.4" width="18" height="7.4" rx="1.4" fill="#FFC1D6"/>' +
          '<path d="M41 2.4 Q43 5 45 2.4 Q47 5 49 2.4 Q51 5 53 2.4 Q55 5 57 2.4 Q58 4 59 2.4 L59 1.4 L41 1.4 Z" fill="#FFFFFF"/>' +
          '<rect x="49" y="-5.6" width="2" height="7" rx="0.6" fill="#7EC8E3"/><path d="M49 -3.6 L51 -4.6 M49 -1.4 L51 -2.4" stroke="#FFFFFF" stroke-width="0.6"/>' +
          '<ellipse cx="50" cy="-7.4" rx="1.5" ry="2.3" fill="#FFB13B"/><ellipse cx="50" cy="-6.9" rx="0.7" ry="1.2" fill="#FFE27A"/>';
        [[39, 14, '#4DABF7'], [45, 15.6, '#FFD25A'], [53, 14.2, '#69DB7C'], [60, 15.4, '#FF6B6B'], [44, 5.4, '#9775FA'], [55, 6, '#4DABF7']].forEach(function (p) {
          s += '<path d="M' + p[0] + ' ' + p[1] + ' l1.4 -0.6" stroke="' + p[2] + '" stroke-width="0.9" stroke-linecap="round"/>';
        });
        return s;
      } },
    { id: 'dragon-horns', slot: 'head', blind: 'gold', name: 'Dragon Horns', box: [27, -3, 46, 21],
      svg: function () {
        return '<path d="M33 15.6 Q27.6 6 33 -1.4 Q35.2 6 39.6 12.4 Z" fill="#5ED6A8" stroke="#2E9E77" stroke-width="0.6" stroke-linejoin="round"/>' +
          '<path d="M67 15.6 Q72.4 6 67 -1.4 Q64.8 6 60.4 12.4 Z" fill="#5ED6A8" stroke="#2E9E77" stroke-width="0.6" stroke-linejoin="round"/>' +
          '<path d="M31.2 9.4 L37 10.6 M68.8 9.4 L63 10.6" stroke="#FFD25A" stroke-width="1.5" stroke-linecap="round"/>' +
          '<path d="M32 4 L35 5 M68 4 L65 5" stroke="#FFD25A" stroke-width="1.1" stroke-linecap="round"/>' +
          sparkle(26, 2, 1.6, '#FFE27A') + sparkle(74, 2, 1.6, '#FFE27A');
      } },
    // ---- Face ----
    { id: 'clown-nose', slot: 'face', blind: 'silver', name: 'Clown Nose', box: [41, 39, 18, 18],
      svg: function () {
        return '<circle cx="50" cy="48.4" r="4.6" fill="#FF4F5E" stroke="#D9304A" stroke-width="0.6"/><circle cx="48.4" cy="46.8" r="1.3" fill="rgba(255,255,255,0.85)"/>';
      } },
    { id: 'freckles', slot: 'face', blind: 'silver', name: 'Freckles', box: [19, 43, 62, 12],
      svg: function () {
        var s = '';
        [[24, 48.6], [27.4, 47.4], [26, 51], [29.6, 50.2], [23, 52.2]].forEach(function (p) {
          s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="0.95" fill="#C8865A" fill-opacity="0.85"/>' +
            '<circle cx="' + (100 - p[0]) + '" cy="' + p[1] + '" r="0.95" fill="#C8865A" fill-opacity="0.85"/>';
        });
        return s;
      } },
    { id: 'butterfly-glasses', slot: 'face', blind: 'silver', name: 'Butterfly Glasses', box: [17, 30, 66, 22],
      svg: function () {
        return both(function (x, y) {
          return '<ellipse cx="' + (x - 4) + '" cy="' + (y - 2) + '" rx="5" ry="4.6" fill="rgba(255,143,184,0.32)" stroke="#E0628F" stroke-width="1.1"/>' +
            '<ellipse cx="' + (x + 4) + '" cy="' + (y - 2) + '" rx="5" ry="4.6" fill="rgba(255,143,184,0.32)" stroke="#E0628F" stroke-width="1.1"/>' +
            '<ellipse cx="' + (x - 3.2) + '" cy="' + (y + 4.4) + '" rx="3.4" ry="3" fill="rgba(201,160,245,0.35)" stroke="#E0628F" stroke-width="1.1"/>' +
            '<ellipse cx="' + (x + 3.2) + '" cy="' + (y + 4.4) + '" rx="3.4" ry="3" fill="rgba(201,160,245,0.35)" stroke="#E0628F" stroke-width="1.1"/>';
        }) + '<path d="M44 40 Q50 37.6 56 40" stroke="#E0628F" stroke-width="1.3" fill="none" stroke-linecap="round"/>' +
          '<path d="M26.6 39.6 L19 38.2 M73.4 39.6 L81 38.2" stroke="#E0628F" stroke-width="1.3" stroke-linecap="round"/>';
      } },
    { id: 'swirl-cheeks', slot: 'face', blind: 'silver', name: 'Swirly Blush', box: [19, 43, 62, 14],
      svg: function () {
        return '<circle cx="26" cy="50" r="4.6" fill="#FF8FB8" fill-opacity="0.35"/><circle cx="74" cy="50" r="4.6" fill="#FF8FB8" fill-opacity="0.35"/>' +
          '<path d="' + spiralPath(26, 50, 2, 3.8) + '" stroke="#FF6F91" stroke-width="1" fill="none" stroke-linecap="round"/>' +
          '<path d="' + spiralPath(74, 50, 2, 3.8) + '" stroke="#FF6F91" stroke-width="1" fill="none" stroke-linecap="round"/>';
      } },
    { id: 'brave-bandage', slot: 'face', blind: 'silver', name: 'Brave Bandage', box: [62, 43, 20, 14],
      svg: function () {
        return '<g transform="rotate(-22 72 50)"><rect x="65.4" y="47.8" width="13.2" height="4.6" rx="2.2" fill="#F5C99A" stroke="#D9A06A" stroke-width="0.5"/>' +
          '<rect x="70" y="47.8" width="4" height="4.6" fill="#FBE3C6"/>' +
          '<circle cx="67.4" cy="49.4" r="0.35" fill="#D9A06A"/><circle cx="67.4" cy="51" r="0.35" fill="#D9A06A"/>' +
          '<circle cx="76.6" cy="49.4" r="0.35" fill="#D9A06A"/><circle cx="76.6" cy="51" r="0.35" fill="#D9A06A"/></g>';
      } },
    { id: 'diamond-shades', slot: 'face', blind: 'gold', name: 'Diamond Shades', box: [17, 31, 66, 22],
      svg: function () {
        return both(function (x, y) {
          return '<path d="M' + (x - 8.6) + ' ' + y + ' L' + x + ' ' + (y - 7.8) + ' L' + (x + 8.6) + ' ' + y + ' L' + x + ' ' + (y + 7.8) + ' Z" fill="rgba(120,200,255,0.4)" stroke="#E0A21B" stroke-width="1.6" stroke-linejoin="round"/>' +
            '<path d="M' + (x - 4.4) + ' ' + (y - 2) + ' L' + (x - 1.4) + ' ' + (y - 5) + '" stroke="rgba(255,255,255,0.8)" stroke-width="1" stroke-linecap="round"/>' +
            sparkle(x + 6, y - 6, 1.6);
        }) + '<path d="M43.6 41 Q50 38.6 56.4 41" stroke="#E0A21B" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
          '<path d="M26.4 41 L19 39.4 M73.6 41 L81 39.4" stroke="#E0A21B" stroke-width="1.4" stroke-linecap="round"/>';
      } },
    { id: 'hero-mask', slot: 'face', blind: 'gold', name: 'Hero Mask', box: [14, 29, 72, 23],
      svg: function () {
        return '<path fill-rule="evenodd" d="M22 35 Q35 30 50 36 Q65 30 78 35 Q80 46 68 49.6 Q58 50 50 45 Q42 50 32 49.6 Q20 46 22 35 Z ' +
          'M29.4 41.5 a5.6 4.6 0 1 0 11.2 0 a5.6 4.6 0 1 0 -11.2 0 Z M59.4 41.5 a5.6 4.6 0 1 0 11.2 0 a5.6 4.6 0 1 0 -11.2 0 Z" fill="#E8473C" stroke="#FFD25A" stroke-width="0.9"/>' +
          '<path d="M22.4 38 L15 42 L17.6 35.4 Z M77.6 38 L85 42 L82.4 35.4 Z" fill="#E8473C"/>' +
          '<path d="M27 34.6 Q31 33 35 33.4" stroke="rgba(255,255,255,0.5)" stroke-width="1" fill="none" stroke-linecap="round"/>';
      } },
    { id: 'rainbow-cheeks', slot: 'face', blind: 'gold', name: 'Rainbow Cheeks', box: [18, 42, 64, 13],
      svg: function () {
        var s = '';
        [26, 74].forEach(function (x) {
          ['#FF6B6B', '#FFE066', '#4DABF7'].forEach(function (c, i) {
            var r = 5 - i * 1.5;
            s += '<path d="M' + (x - r) + ' 52 Q' + x + ' ' + (52 - r * 1.25) + ' ' + (x + r) + ' 52" stroke="' + c + '" stroke-width="1.3" fill="none" stroke-linecap="round"/>';
          });
          s += '<circle cx="' + (x - 5.4) + '" cy="52.4" r="1.4" fill="#FFFFFF"/><circle cx="' + (x + 5.4) + '" cy="52.4" r="1.4" fill="#FFFFFF"/>';
        });
        return s + sparkle(31, 46, 1.2, '#FFE27A') + sparkle(69, 46, 1.2, '#FFE27A');
      } },
    { id: 'twinkle-specs', slot: 'face', blind: 'gold', name: 'Twinkle Specs', box: [17, 28, 66, 26],
      svg: function () {
        return '<circle cx="35" cy="41.5" r="8.4" fill="rgba(255,240,200,0.2)" stroke="#E0A21B" stroke-width="1.7"/>' +
          '<circle cx="65" cy="41.5" r="8.4" fill="rgba(255,240,200,0.2)" stroke="#E0A21B" stroke-width="1.7"/>' +
          '<path d="M43.4 40.4 Q50 37.4 56.6 40.4" stroke="#E0A21B" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
          '<path d="M26.6 40.2 L19 38.6 M73.4 40.2 L81 38.6" stroke="#E0A21B" stroke-width="1.5" stroke-linecap="round"/>' +
          '<path d="' + starPath(26.4, 32.6, 2.2) + '" fill="#FFD25A"/><path d="' + starPath(74, 32, 2.6) + '" fill="#FFD25A"/>' +
          sparkle(71, 50, 1.8, '#FFE27A') + sparkle(29, 50.6, 1.4, '#FFE27A');
      } },
    { id: 'masquerade', slot: 'face', blind: 'gold', name: 'Masquerade Mask', box: [20, 8, 66, 42],
      svg: function () {
        return BOX_GOLD + '<path d="M74 36.4 Q84.6 22 82 9.6 Q78 22 71.6 34.6 Z" fill="#C9A0F5" stroke="#9775FA" stroke-width="0.5"/>' +
          '<path d="M73 35.4 Q79 22 81.6 11" stroke="#7A5AC9" stroke-width="0.6" fill="none"/>' +
          '<path fill-rule="evenodd" d="M23 38 Q30 32 40 35 Q46 37 50 40 Q54 37 60 35 Q70 32 77 38 Q76 46 66 48 Q57 48 50 43 Q43 48 34 48 Q24 46 23 38 Z ' +
          'M29.6 41.4 a5.4 4.2 0 1 0 10.8 0 a5.4 4.2 0 1 0 -10.8 0 Z M59.6 41.4 a5.4 4.2 0 1 0 10.8 0 a5.4 4.2 0 1 0 -10.8 0 Z" fill="url(#mmGoldB)" stroke="#C98A14" stroke-width="0.6"/>' +
          '<circle cx="50" cy="41.6" r="1.4" fill="#FF5A6E"/><circle cx="26" cy="40" r="0.9" fill="#8FE3FF"/><circle cx="74" cy="40" r="0.9" fill="#8FE3FF"/>';
      } },
    // ---- Necklaces ----
    { id: 'polka-bow-tie', slot: 'neck', blind: 'silver', name: 'Polka Bow Tie', box: [36, 55, 28, 16],
      svg: function () {
        return '<path d="M50 63 L40 57.6 Q38 63 40 68.4 Z M50 63 L60 57.6 Q62 63 60 68.4 Z" fill="#3E8EDB" stroke="#2F6FB0" stroke-width="0.5" stroke-linejoin="round"/>' +
          '<rect x="47.6" y="60.6" width="4.8" height="4.8" rx="1.2" fill="#2F6FB0"/>' +
          '<circle cx="42.4" cy="61" r="0.9" fill="#FFFFFF"/><circle cx="44.4" cy="65.4" r="0.9" fill="#FFFFFF"/><circle cx="41.6" cy="65" r="0.6" fill="#FFFFFF"/>' +
          '<circle cx="57.6" cy="61" r="0.9" fill="#FFFFFF"/><circle cx="55.6" cy="65.4" r="0.9" fill="#FFFFFF"/><circle cx="58.4" cy="65" r="0.6" fill="#FFFFFF"/>';
      } },
    { id: 'acorn-necklace', slot: 'neck', blind: 'silver', name: 'Acorn Necklace', box: [30, 56, 40, 18],
      svg: function () {
        return chain('#8A5A3A') + '<path d="M50.2 62 L50.8 60.4" stroke="#6B4226" stroke-width="0.8" stroke-linecap="round"/>' +
          '<ellipse cx="50" cy="68.4" rx="3.4" ry="3.9" fill="#D9933E"/><ellipse cx="48.8" cy="67.6" rx="0.9" ry="1.6" fill="rgba(255,255,255,0.35)"/>' +
          '<path d="M45.6 65.6 Q50 61.4 54.4 65.6 Z" fill="#8A5A3A"/>' +
          '<path d="M47 64.6 L48.4 63.4 M49 64.8 L50.8 63 M51.2 64.8 L52.8 63.6" stroke="#6B4226" stroke-width="0.5"/>';
      } },
    { id: 'coach-whistle', slot: 'neck', blind: 'silver', name: 'Coach Whistle', box: [30, 56, 40, 18],
      svg: function () {
        return chain('#E8473C', 1) +
          '<path d="M45.5 64.6 L54.5 64.6 Q56.5 67 54.5 69.4 L47 69.4 Q44 69.4 44 67 Q44 64.6 45.5 64.6 Z" fill="#C9D2DE" stroke="#8A96A8" stroke-width="0.6"/>' +
          '<rect x="54" y="65.2" width="4.2" height="2.4" rx="0.6" fill="#B8C2CF" stroke="#8A96A8" stroke-width="0.4"/>' +
          '<circle cx="48.6" cy="66.6" r="1" fill="#6B7584"/><path d="M46 65.6 L50 65.6" stroke="rgba(255,255,255,0.8)" stroke-width="0.6" stroke-linecap="round"/>';
      } },
    { id: 'donut-pendant', slot: 'neck', blind: 'silver', name: 'Donut Pendant', box: [30, 56, 40, 18],
      svg: function () {
        var s = chain('#E8A0B8') + '<circle cx="50" cy="67.8" r="4.4" fill="#E3A86B"/><circle cx="50" cy="67.6" r="3.7" fill="#FF8FB8"/>' +
          '<circle cx="50" cy="67.6" r="1.4" fill="#FFF6E8" stroke="#E3A86B" stroke-width="0.5"/>';
        [[47.6, 65.6, '#FFE066'], [52.6, 65.4, '#4DABF7'], [53, 69.4, '#69DB7C'], [47.2, 69.6, '#FFFFFF']].forEach(function (p) {
          s += '<path d="M' + p[0] + ' ' + p[1] + ' l0.9 0.5" stroke="' + p[2] + '" stroke-width="0.7" stroke-linecap="round"/>';
        });
        return s;
      } },
    { id: 'bee-scarf', slot: 'neck', blind: 'silver', name: 'Bee Scarf', box: [22, 55, 56, 27],
      svg: function () {
        return '<path d="M61 63 L66 80 L57.6 80 L55.4 65 Z" fill="#FFD54A"/><path d="M57 71 L64.2 71 M57.7 76 L65.4 76" stroke="#2E2A3A" stroke-width="1.8"/>' +
          '<path d="M24 58 Q50 70 76 58 L77 64.4 Q50 77 23 64.4 Z" fill="#FFD54A"/>' +
          '<path d="' + [30, 38, 46, 54, 62, 70].map(scarfStripe).join(' ') + '" stroke="#2E2A3A" stroke-width="2.4"/>';
      } },
    { id: 'trophy-pendant', slot: 'neck', blind: 'gold', name: 'Trophy Pendant', box: [36, 55, 28, 20],
      svg: function () {
        return BOX_GOLD + '<path d="M40 57 L50 65.4 L60 57" stroke="#3E8EDB" stroke-width="2.4" fill="none" stroke-linejoin="round"/>' +
          '<path d="M45.4 64.6 Q42.4 64.6 43.2 67.2 Q44 69 46.2 68.6 M54.6 64.6 Q57.6 64.6 56.8 67.2 Q56 69 53.8 68.6" stroke="#E0A21B" stroke-width="0.9" fill="none"/>' +
          '<path d="M45.4 64.4 L54.6 64.4 Q54.6 70 50 70.6 Q45.4 70 45.4 64.4 Z" fill="url(#mmGoldB)" stroke="#C98A14" stroke-width="0.5"/>' +
          '<rect x="49.2" y="70.4" width="1.6" height="1.8" fill="#C98A14"/><rect x="46.6" y="72" width="6.8" height="1.9" rx="0.5" fill="#C98A14"/>' +
          '<path d="' + starPath(50, 66.8, 1.6) + '" fill="#FFF6C8"/>';
      } },
    { id: 'royal-cape', slot: 'neck', blind: 'gold', name: 'Royal Cape', box: [12, 54, 76, 30],
      svg: function () {
        var s = '<path d="M21 62 L13.6 82.4 L29 80 Z M79 62 L86.4 82.4 L71 80 Z" fill="#C62F3E" stroke="#9A1F2C" stroke-width="0.5" stroke-linejoin="round"/>' +
          '<path d="M22 57 Q50 72 78 57 L80 63 Q50 80 20 63 Z" fill="#FFFFFF" stroke="#E3E0EA" stroke-width="0.6"/>';
        along(23, 61, 50, 77, 77, 61, 9).forEach(function (p, i) {
          if (i % 2) return;
          s += '<path d="M' + p[0].toFixed(2) + ' ' + (p[1] - 1.6).toFixed(2) + ' l0 1.8" stroke="#2E2A3A" stroke-width="1" stroke-linecap="round"/>';
        });
        return s + '<circle cx="50" cy="70.6" r="2.6" fill="#FFD25A" stroke="#C98A14" stroke-width="0.6"/><circle cx="50" cy="70.6" r="1" fill="#FF5A6E"/>';
      } },
    { id: 'diamond-necklace', slot: 'neck', blind: 'gold', name: 'Diamond Necklace', box: [30, 56, 40, 20],
      svg: function () {
        var s = chain('#C9D2DE', 0.9);
        along(32, 58, 50, 72, 68, 58, 7).forEach(function (p, i) {
          if (i === 3) return;
          s += '<circle cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="0.8" fill="#DFF6FF" stroke="#8FD1EA" stroke-width="0.3"/>';
        });
        return s + '<path d="M45.6 65 L54.4 65 L56 67 L50 73.4 L44 67 Z" fill="#8FE3FF" stroke="#4AA8D8" stroke-width="0.6" stroke-linejoin="round"/>' +
          '<path d="M44 67 L56 67 M47.6 65 L46.6 67 L50 73.4 L53.4 67 L52.4 65" stroke="#4AA8D8" stroke-width="0.4" fill="none"/>' +
          sparkle(57.6, 64, 1.6) + sparkle(42.6, 70.6, 1.2);
      } },
    { id: 'moon-pendant', slot: 'neck', blind: 'gold', name: 'Moon & Star', box: [30, 56, 40, 20],
      svg: function () {
        return BOX_GOLD + chain('#E0A21B', 0.8) +
          '<path d="M51.4 63.2 A5.2 5.2 0 1 0 51.4 73.4 A4 4 0 1 1 51.4 63.2 Z" fill="url(#mmGoldB)" stroke="#C98A14" stroke-width="0.5"/>' +
          '<path d="' + starPath(53.6, 67, 1.7) + '" fill="#FFE27A" stroke="#E0A21B" stroke-width="0.4"/>';
      } },
    { id: 'moint-medallion', slot: 'neck', blind: 'gold', name: 'Moint Medallion', box: [28, 55, 44, 22],
      svg: function () {
        return BOX_GOLD + '<path d="M31 57.4 Q50 72 69 57.4" stroke="#E0A21B" stroke-width="1.5" fill="none" stroke-dasharray="1.6 0.9"/>' +
          '<circle cx="50" cy="68.8" r="5.6" fill="url(#mmGoldB)" stroke="#C98A14" stroke-width="0.7"/>' +
          '<circle cx="50" cy="68.8" r="4.3" fill="none" stroke="#FFF3C4" stroke-width="0.5"/>' + txt(50, 71.2, 6.4, '#7A4A0C', 'M') + sparkle(55.6, 63.4, 1.6);
      } }
  ];
  // Moods from the boxes are drawn like the other Moods (patch over the eyes first)
  var BOX_MOODS = [
    { id: 'mood-sparkly', blind: 'silver', name: 'Sparkly Eyes', art: function () {
        return both(function (x, y) {
          return '<ellipse cx="' + x + '" cy="' + y + '" rx="6.2" ry="7.6" fill="' + EYE_INK + '"/>' +
            '<ellipse cx="' + x + '" cy="' + (y + 3) + '" rx="4.4" ry="3.4" fill="#5B4A9E"/>' +
            '<circle cx="' + (x - 2.2) + '" cy="' + (y - 3) + '" r="2.4" fill="#FFFFFF"/><circle cx="' + (x + 2.4) + '" cy="' + (y + 2.6) + '" r="1.2" fill="#FFFFFF"/>' +
            sparkle(x + 2.4, y - 3.6, 1.5, '#FFFFFF');
        });
      } },
    { id: 'mood-dot-eyes', blind: 'silver', name: 'Dot Eyes', art: function () {
        return both(function (x, y) { return '<circle cx="' + x + '" cy="' + (y + 1) + '" r="2" fill="' + EYE_INK + '"/>'; }) +
          '<ellipse cx="26" cy="49.6" rx="3.6" ry="2" fill="#FF8FB8" fill-opacity="0.5"/><ellipse cx="74" cy="49.6" rx="3.6" ry="2" fill="#FF8FB8" fill-opacity="0.5"/>';
      } },
    { id: 'mood-ko', blind: 'silver', name: 'KO', art: function () {
        return both(function (x, y) { return line('M' + (x - 4.6) + ' ' + (y - 4.6) + ' L' + (x + 4.6) + ' ' + (y + 4.6) + ' M' + (x + 4.6) + ' ' + (y - 4.6) + ' L' + (x - 4.6) + ' ' + (y + 4.6), 2.6); }) +
          sparkle(50, 30, 2.2, '#FFE27A') + sparkle(42, 27, 1.4, '#FFE27A') + sparkle(58, 27, 1.4, '#FFE27A');
      } },
    { id: 'mood-squeeze', blind: 'silver', name: 'Squeeze', art: function () {
        return line('M30 36.6 L39 41 L30 45.4', 2.6) + line('M70 36.6 L61 41 L70 45.4', 2.6);
      } },
    { id: 'mood-flower-eyes', blind: 'silver', name: 'Flower Eyes', art: function () {
        return both(function (x, y) { return flower(x, y, 5.4, '#FF8FB8', '#FFE27A'); });
      } },
    { id: 'mood-rainbow-eyes', blind: 'gold', name: 'Rainbow Eyes', art: function () {
        return both(function (x, y) {
          var s = '';
          ['#FF6B6B', '#FFA94D', '#FFE066', '#69DB7C', '#4DABF7'].forEach(function (c, i) {
            s += '<circle cx="' + x + '" cy="' + y + '" r="' + (6.8 - i * 1.25).toFixed(2) + '" fill="' + c + '"/>';
          });
          return s + '<circle cx="' + (x - 2.2) + '" cy="' + (y - 2.4) + '" r="1.4" fill="#FFFFFF"/>';
        });
      } },
    { id: 'mood-galaxy-eyes', blind: 'gold', name: 'Galaxy Eyes', art: function () {
        return '<defs><radialGradient id="mmGalaxy" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#9775FA"/><stop offset="1" stop-color="#1E1A4A"/></radialGradient></defs>' +
          both(function (x, y) {
            return '<ellipse cx="' + x + '" cy="' + y + '" rx="6.2" ry="7.4" fill="url(#mmGalaxy)" stroke="' + EYE_INK + '" stroke-width="0.6"/>' +
              sparkle(x - 2, y - 2.6, 1.6, '#FFFFFF') + sparkle(x + 2.6, y + 2, 1.1, '#FFE27A') +
              '<circle cx="' + (x + 2.4) + '" cy="' + (y - 3.4) + '" r="0.5" fill="#FFFFFF"/><circle cx="' + (x - 2.6) + '" cy="' + (y + 3.4) + '" r="0.5" fill="#8FE3FF"/>';
          });
      } },
    { id: 'mood-fired-up', blind: 'gold', name: 'Fired Up', art: function () {
        return both(function (x, y) {
          return '<path d="M' + (x - 5.6) + ' ' + (y - 1) + ' Q' + (x - 7) + ' ' + (y - 9) + ' ' + (x - 2) + ' ' + (y - 13) + ' Q' + (x - 1) + ' ' + (y - 8) + ' ' + x + ' ' + (y - 9) +
              ' Q' + (x + 1.4) + ' ' + (y - 13) + ' ' + (x + 4) + ' ' + (y - 14) + ' Q' + (x + 7.4) + ' ' + (y - 8) + ' ' + (x + 5.6) + ' ' + (y - 1) + ' Z" fill="#FF8A3C"/>' +
            '<path d="M' + (x - 3.4) + ' ' + (y - 1) + ' Q' + (x - 3.6) + ' ' + (y - 6) + ' ' + x + ' ' + (y - 8.6) + ' Q' + (x + 3.6) + ' ' + (y - 6) + ' ' + (x + 3.4) + ' ' + (y - 1) + ' Z" fill="#FFD25A"/>' +
            eyeBall(x, y + 1, 5, 6.2);
        });
      } },
    { id: 'mood-diamond-eyes', blind: 'gold', name: 'Diamond Eyes', art: function () {
        return both(function (x, y) {
          return '<path d="M' + (x - 5.4) + ' ' + (y - 3) + ' L' + (x - 2.8) + ' ' + (y - 6.4) + ' L' + (x + 2.8) + ' ' + (y - 6.4) + ' L' + (x + 5.4) + ' ' + (y - 3) + ' L' + x + ' ' + (y + 6.6) + ' Z" fill="#8FE3FF" stroke="#2E7DB0" stroke-width="0.8" stroke-linejoin="round"/>' +
            '<path d="M' + (x - 5.4) + ' ' + (y - 3) + ' L' + (x + 5.4) + ' ' + (y - 3) + ' M' + (x - 1.4) + ' ' + (y - 6.4) + ' L' + (x - 2.4) + ' ' + (y - 3) + ' L' + x + ' ' + (y + 6.6) + ' L' + (x + 2.4) + ' ' + (y - 3) + ' L' + (x + 1.4) + ' ' + (y - 6.4) + '" stroke="#2E7DB0" stroke-width="0.5" fill="none"/>' +
            sparkle(x + 5, y - 6, 1.8, '#FFFFFF');
        });
      } },
    { id: 'mood-sunshine', blind: 'gold', name: 'Sunshine Eyes', art: function () {
        return both(function (x, y) {
          var rays = '';
          for (var i = 0; i < 8; i++) {
            var a = i / 8 * Math.PI * 2;
            rays += 'M' + (x + Math.cos(a) * 5).toFixed(2) + ' ' + (y + Math.sin(a) * 5).toFixed(2) + ' L' + (x + Math.cos(a) * 7.4).toFixed(2) + ' ' + (y + Math.sin(a) * 7.4).toFixed(2) + ' ';
          }
          return '<path d="' + rays + '" stroke="#F5A524" stroke-width="1.4" stroke-linecap="round"/>' +
            '<circle cx="' + x + '" cy="' + y + '" r="4.2" fill="#FFD25A" stroke="#F5A524" stroke-width="0.6"/>' +
            line('M' + (x - 2) + ' ' + (y + 0.4) + ' Q' + x + ' ' + (y + 2.2) + ' ' + (x + 2) + ' ' + (y + 0.4), 0.9, '#B26A00');
        });
      } }
  ];
  BOX_MOODS.forEach(function (m) {
    m.slot = 'mood';
    m.svg = function () { return moodPatch() + m.art(); };
    BOX_ITEMS.push(m);
  });
  var BLIND_BOXES = {
    silver: { name: 'Silver Box', price: 500 },
    gold: { name: 'Gold Box', price: 700 }
  };
  function boxPool(slot, tier) {
    return BOX_ITEMS.filter(function (it) { return it.slot === slot && it.blind === tier; });
  }
  // → { result: 'ok', id } | { result: 'poor' } | { result: 'done' } (all found)
  function openBox(slot, tier) {
    var bb = BLIND_BOXES[tier];
    if (!bb) return { result: 'unknown' };
    var c = readCloset();
    var left = boxPool(slot, tier).filter(function (it) { return c.owned.indexOf(it.id) < 0; });
    if (!left.length) return { result: 'done' };
    if (balance() < bb.price) return { result: 'poor' };
    var it = left[Math.floor(Math.random() * left.length)];
    addMoints(-bb.price);
    c = readCloset();
    c.owned.push(it.id);
    c.equipped[it.slot] = it.id;   // put it on right away
    saveCloset(c);
    return { result: 'ok', id: it.id };
  }

  var ITEM_BY_ID = {};
  ITEMS.concat(MOODS, BACKGROUNDS, BOX_ITEMS).forEach(function (it) { ITEM_BY_ID[it.id] = it; });

  function itemSVG(id, viewBox) {
    var it = ITEM_BY_ID[id];
    if (!it) return '';
    if (it.slot === 'bg') return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">' + it.svg() + '</svg>';
    var vb = viewBox || '0 0 100 100';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" overflow="visible">' + it.svg() + '</svg>';
  }
  function iconSVG(id) {
    var it = ITEM_BY_ID[id];
    if (!it) return '';
    if (it.slot === 'bg') return '<span class="mm-bg-icon">' + itemSVG(id) + '</span>';
    // a mood only makes sense on Moku's face: show it on a close-up of him
    if (it.slot === 'mood') {
      return '<span class="mm-mood-icon"><span class="mm-doll"><img src="' + HERO_SRC + '" alt="">' +
        '<svg class="mm-outfit" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" overflow="visible">' + it.svg() + '</svg></span></span>';
    }
    var b = it.box, pad = 2;
    var size = Math.max(b[2], b[3]) + pad * 2;
    var x = b[0] + b[2] / 2 - size / 2, y = b[1] + b[3] / 2 - size / 2;
    return itemSVG(id, x + ' ' + y + ' ' + size + ' ' + size);
  }
  // All worn items in one layer, neck → face → head (so a hat sits on top)
  function outfitSVG(equipped) {
    var inner = '';
    // expression first, so glasses (face) and hats sit on top of it
    ['mood', 'neck', 'face', 'head'].forEach(function (s) {
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
    DAILY_GAME_CAP: DAILY_GAME_CAP,
    earn: earn,
    earnedToday: earnedToday,
    ITEMS: ITEMS,
    MOODS: MOODS,
    BACKGROUNDS: BACKGROUNDS,
    BOX_ITEMS: BOX_ITEMS,
    BLIND_BOXES: BLIND_BOXES,
    boxPool: boxPool,
    openBox: openBox,
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
    // ---- hub slots (sit on the hub's dark panels) ----
    '.mm-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.mm-bar-bal{display:inline-flex;align-items:center;gap:6px;margin-right:2px;font-size:18px;font-weight:900;color:#FFF3D6;line-height:1}',
    '.mm-bar-bal small{font-size:12px;font-weight:800;color:rgba(255,230,170,0.75)}',
    '.mm-bar .mm-pill{font-size:12.5px;padding:7px 12px}',
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
    '.mm-stage.has-bg::before{display:none}',
    '.mm-stage > .mm-scene{position:absolute;inset:0}',
    // background card + Moku (pop-art card with a bold outline)
    '.mm-scene{position:relative;display:block;aspect-ratio:1/1;border-radius:18px;overflow:hidden;border:2.5px solid #2A1F3D;box-sizing:border-box}',
    '.mm-scene-bg,.mm-scene-bg svg{position:absolute;inset:0;width:100%;height:100%;display:block}',
    '.mm-scene .mm-doll,.mm-stage .mm-scene .mm-doll{position:absolute;left:16%;right:16%;bottom:1%;width:auto}',
    '.mm-bg-icon{display:block;width:56px;height:56px;border-radius:12px;overflow:hidden;border:2px solid #2A1F3D;box-sizing:border-box}',
    '.mm-bg-icon svg{width:100%;height:100%;display:block}',
    '@keyframes mmBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}',
    '.mm-stage .mm-doll.is-new{animation:mmHop .5s cubic-bezier(.2,1.6,.4,1)}',
    '@keyframes mmHop{0%{transform:scale(1,1)}30%{transform:scale(1.08,.9)}60%{transform:translateY(-10px) scale(.96,1.05)}100%{transform:none}}',
    '.mm-bal{display:inline-flex;align-items:center;gap:6px;margin:10px auto 0;padding:6px 14px;border-radius:999px;background:#FFFFFF;',
    'font-size:16px;font-weight:900;color:#7A4A0C;box-shadow:inset 0 0 0 2px #F1D9B5}',
    '.mm-panel.mm-closet{max-width:500px}',
    '.mm-mini-wrap{position:sticky;top:0;height:0;z-index:4}',
    '.mm-mini{position:absolute;top:10px;right:10px;width:92px;height:92px;border-radius:20px;background:radial-gradient(circle at 50% 70%,#FFF1D6,#F2C98A);',
    'box-shadow:0 6px 16px rgba(74,47,26,0.35),inset 0 0 0 3px #FFFFFF;opacity:0;transform:scale(.8);transition:opacity .18s,transform .18s;pointer-events:none;overflow:hidden}',
    '.mm-mini.is-on{opacity:1;transform:none}',
    '.mm-mini > .mm-doll{position:absolute;inset:6px;width:auto}',
    '.mm-mini > .mm-scene{position:absolute;inset:0;border-radius:20px}',
    '.mm-mini .mm-doll.is-new{animation:mmHop .5s cubic-bezier(.2,1.6,.4,1)}',
    // five tabs: scroll sideways when they don't fit (phones)
    '.mm-tabs{display:flex;gap:6px;margin:14px 14px 0;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}',
    '.mm-tabs::-webkit-scrollbar{display:none}',
    '.mm-tab{flex:1 0 auto;appearance:none;border:none;font:inherit;font-size:13px;font-weight:800;padding:9px 8px;border-radius:12px;cursor:pointer;white-space:nowrap;',
    'background:#F3E3CB;color:#8A5A2E}',
    '.mm-tab.is-on{background:#7A4F2E;color:#FFF6E8;box-shadow:0 3px 0 #4A2F1A}',
    '.mm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px;padding:14px}',
    '.mm-item{position:relative;appearance:none;border:none;font:inherit;cursor:pointer;background:#FFFFFF;border-radius:16px;padding:8px 6px 9px;',
    'box-shadow:0 3px 0 #EAD6BA,inset 0 0 0 2px #F6E8D3;display:flex;flex-direction:column;align-items:center;gap:4px;color:#4A2F1A;',
    'transition:transform .12s}',
    '.mm-item:active{transform:translateY(2px)}',
    '.mm-item.is-sel{box-shadow:0 3px 0 #C9781A,inset 0 0 0 3px #F5B83D;background:#FFFBF2}',
    '.mm-item svg{width:56px;height:56px}',
    '.mm-mood-icon{position:relative;display:block;width:56px;height:56px;border-radius:50%;overflow:hidden;background:#F4E6D7;box-shadow:inset 0 0 0 2px #EAD6BA}',
    '.mm-mood-icon .mm-doll{position:absolute;width:150%;left:-25%;top:-28%}',
    '.mm-item .mm-mood-icon svg{width:100%;height:100%}',
    '.mm-item-name{font-size:11.5px;font-weight:800;line-height:1.15;text-align:center;min-height:2.3em;display:flex;align-items:center}',
    '.mm-price{display:inline-flex;align-items:center;gap:4px;font-size:12.5px;font-weight:900;color:#9A6512}',
    '.mm-tag{font-size:11px;font-weight:900;padding:2px 8px;border-radius:999px;background:#E6F4D9;color:#4E7A2E}',
    '.mm-tag.is-wear{background:#7A4F2E;color:#FFF6E8}',
    '.mm-none svg{opacity:0.5}',
    // blind boxes (Silver 500 / Gold 700): first two tiles of each outfit tab
    '.mm-boxtile{background:linear-gradient(180deg,#F7F9FC,#DCE4EE);box-shadow:0 3px 0 #AEBBCB,inset 0 0 0 2px #FFFFFF}',
    '.mm-boxtile.is-gold{background:linear-gradient(180deg,#FFF8DC,#FFDF8A);box-shadow:0 3px 0 #D9A63A,inset 0 0 0 2px #FFFFFF}',
    '.mm-boxtile.is-sel{box-shadow:0 3px 0 #C9781A,inset 0 0 0 3px #F5B83D}',
    '.mm-boxtile svg{animation:mmWiggle 2.8s ease-in-out infinite}',
    '.mm-boxtile.is-gold svg{animation-delay:-1.4s}',
    '.mm-boxtile.is-done svg{animation:none;opacity:0.55}',
    '@keyframes mmWiggle{0%,82%,100%{transform:none}86%{transform:rotate(-7deg)}90%{transform:rotate(7deg)}94%{transform:rotate(-4deg)}}',
    '.mm-box-left{font-size:10.5px;font-weight:800;color:#8A6A4A}',
    '.mm-rare{position:absolute;top:5px;right:5px;font-size:9px;font-weight:900;letter-spacing:0.04em;padding:1px 5px;border-radius:999px;background:#DCE4EE;color:#4A5A70}',
    '.mm-rare.is-gold{background:#FFD86A;color:#7A4A0C}',
    '.mm-reveal{position:fixed;inset:0;z-index:75;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(30,18,10,0.6);animation:mmFade .2s ease-out}',
    '.mm-reveal-card{position:relative;width:min(300px,100%);padding:22px 18px 18px;border-radius:22px;background:#FFF6E8;color:#4A2F1A;text-align:center;overflow:hidden;',
    'box-shadow:0 18px 50px rgba(40,20,5,0.45),inset 0 0 0 3px #F1D9B5;font-family:-apple-system,"Segoe UI",Roboto,sans-serif}',
    '.mm-reveal-card.is-gold{box-shadow:0 18px 50px rgba(40,20,5,0.45),inset 0 0 0 3px #F5B83D}',
    '.mm-reveal-stage{position:relative;height:150px;display:flex;align-items:center;justify-content:center}',
    '.mm-reveal-box svg{width:140px;height:140px;animation:mmShake 1.1s ease-in-out}',
    '@keyframes mmShake{0%{transform:none}12%{transform:rotate(-9deg)}24%{transform:rotate(9deg)}36%{transform:rotate(-11deg)}48%{transform:rotate(11deg)}',
    '60%{transform:rotate(-6deg) scale(1.04)}72%{transform:rotate(6deg) scale(1.08)}86%{transform:scale(1.2);opacity:1}100%{transform:scale(1.35);opacity:0}}',
    '.mm-reveal-rays{position:absolute;left:50%;top:50%;width:300px;height:300px;margin:-150px 0 0 -150px;border-radius:50%;',
    'background:repeating-conic-gradient(rgba(255,214,120,0.55) 0 10deg,rgba(255,214,120,0) 10deg 20deg);',
    '-webkit-mask:radial-gradient(circle,#000 30%,transparent 68%);mask:radial-gradient(circle,#000 30%,transparent 68%);animation:mmRays 8s linear infinite}',
    '.mm-reveal-card:not(.is-gold) .mm-reveal-rays{background:repeating-conic-gradient(rgba(170,190,215,0.55) 0 10deg,rgba(170,190,215,0) 10deg 20deg)}',
    '@keyframes mmRays{to{transform:rotate(360deg)}}',
    '.mm-reveal-item{position:relative;width:130px;height:130px;animation:mmPop .5s cubic-bezier(.2,1.6,.4,1)}',
    '.mm-reveal-item > svg,.mm-reveal-item .mm-mood-icon{width:100%;height:100%}',
    '.mm-reveal-new{display:inline-block;margin-top:6px;padding:2px 10px;border-radius:999px;background:#FF6F91;color:#FFFFFF;font-size:12px;font-weight:900;letter-spacing:0.08em}',
    '.mm-reveal-card h3{margin:6px 0 2px;font-size:21px;font-weight:900;color:#6B3A12}',
    '.mm-reveal-card p{margin:0 0 14px;font-size:13px;font-weight:700;color:#8A5A2E}',
    '.mm-reveal-card .mm-big{width:100%;margin:0}',
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
  // Moku in front of his background card (My Moku page, Closet stage).
  // Without a background it is just Moku, as big as before.
  function sceneHTML(equipped, cls) {
    var bg = equipped && ITEM_BY_ID[equipped.bg];
    if (!bg) return dollHTML(equipped, cls);
    return '<span class="mm-scene"><span class="mm-scene-bg">' + itemSVG(bg.id) + '</span>' + dollHTML(equipped, cls) + '</span>';
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
    revealing = false;
    var ov = showOverlay('mm-closet',
      // small preview that stays in view once the big stage scrolls away (long lists)
      '<div class="mm-mini-wrap"><div class="mm-mini" data-mm-mini aria-hidden="true"></div></div>' +
      '<div class="mm-head"><h2>Moku Closet</h2><p>Dress up your own Moku!</p>' +
      '<div class="mm-stage" data-mm-stage></div>' +
      '<div class="mm-bal">' + COIN + '<span data-mm-bal></span></div></div>' +
      '<div class="mm-tabs" role="tablist">' + TABS.map(function (s) {
        return '<button class="mm-tab" type="button" role="tab" data-mm-tab="' + s + '">' + SLOT_LABELS[s] + '</button>';
      }).join('') + '</div>' +
      '<div class="mm-grid" data-mm-grid></div>' +
      '<div class="mm-action"><button class="mm-big" type="button" data-mm-act></button>' +
      '<p class="mm-note">Earn Moints from the Daily Bonus and the games with the M coin.</p></div>',
      'Moku Closet');
    ov.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-mm-tab],[data-mm-item],[data-mm-box],[data-mm-act]') : null;
      if (!t) return;
      if (t.hasAttribute('data-mm-box')) {
        sfxTap();
        closetState.sel = 'box:' + t.getAttribute('data-mm-box');
        renderCloset(false);
      } else if (t.hasAttribute('data-mm-tab')) {
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
    var panel = ov.querySelector('.mm-panel');
    panel.addEventListener('scroll', function () {
      var stage = panel.querySelector('[data-mm-stage]');
      var mini = panel.querySelector('[data-mm-mini]');
      mini.classList.toggle('is-on', panel.scrollTop > stage.offsetTop + stage.offsetHeight - 30);
    }, { passive: true });
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
    var outfit = previewOutfit();
    var stage = ov.querySelector('[data-mm-stage]');
    stage.classList.toggle('has-bg', Boolean(ITEM_BY_ID[outfit.bg]));
    stage.innerHTML = sceneHTML(outfit, hop ? 'is-new' : '');
    ov.querySelector('[data-mm-mini]').innerHTML = sceneHTML(outfit, hop ? 'is-new' : '');
    ov.querySelector('[data-mm-bal]').textContent = fmt(balance());
    Array.prototype.forEach.call(ov.querySelectorAll('[data-mm-tab]'), function (b) {
      var on = b.getAttribute('data-mm-tab') === closetState.tab;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var worn = c.equipped[closetState.tab];
    // Moods: "Usual" = Moku's own face; other tabs: "Nothing"
    var isMood = closetState.tab === 'mood';
    var html = closetState.tab === 'bg' ? '' : ['silver', 'gold'].map(function (tier) {
      var pool = boxPool(closetState.tab, tier);
      var found = pool.filter(function (it) { return c.owned.indexOf(it.id) >= 0; }).length;
      var done = found >= pool.length;
      return '<button class="mm-item mm-boxtile' + (tier === 'gold' ? ' is-gold' : '') + (done ? ' is-done' : '') +
        (closetState.sel === 'box:' + tier ? ' is-sel' : '') + '" type="button" data-mm-box="' + tier + '" aria-label="' +
        BLIND_BOXES[tier].name + ', ' + BLIND_BOXES[tier].price + ' Moints, ' + found + ' of ' + pool.length + ' found">' + boxArt(tier) +
        '<span class="mm-item-name">' + BLIND_BOXES[tier].name + '</span>' +
        (done ? '<span class="mm-tag">All found!</span>' : '<span class="mm-price">' + COIN + fmt(BLIND_BOXES[tier].price) + '</span>') +
        '<span class="mm-box-left">' + found + ' / ' + pool.length + ' found</span></button>';
    }).join('');
    html += '<button class="mm-item' + (isMood ? '' : ' mm-none') + (!worn && (!closetState.sel || closetState.sel === 'none') ? ' is-sel' : '') + '" type="button" data-mm-item="none">' +
      (isMood
        ? '<span class="mm-mood-icon"><span class="mm-doll"><img src="' + HERO_SRC + '" alt=""></span></span>'
        : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="#C9A27C" stroke-width="2"/><path d="M6.5 17.5 L17.5 6.5" stroke="#C9A27C" stroke-width="2"/></svg>') +
      '<span class="mm-item-name">' + (isMood ? 'Usual' : 'Nothing') + '</span>' +
      (!worn ? '<span class="mm-tag is-wear">' + (isMood ? 'On' : 'Wearing') + '</span>' : '<span class="mm-tag">' + (isMood ? 'Use' : 'Take off') + '</span>') + '</button>';
    // box items only show up once you have found them
    ITEMS.concat(MOODS, BACKGROUNDS, BOX_ITEMS).filter(function (it) {
      return it.slot === closetState.tab && (!it.blind || c.owned.indexOf(it.id) >= 0);
    }).forEach(function (it) {
      var have = c.owned.indexOf(it.id) >= 0;
      var wearing = worn === it.id;
      var sel = closetState.sel ? closetState.sel === it.id : wearing;
      html += '<button class="mm-item' + (sel ? ' is-sel' : '') + '" type="button" data-mm-item="' + it.id + '" aria-label="' + it.name +
        (have ? (wearing ? ', wearing' : ', owned') : ', ' + it.price + ' Moints') + '">' + iconSVG(it.id) +
        (it.blind ? '<span class="mm-rare' + (it.blind === 'gold' ? ' is-gold' : '') + '">' + (it.blind === 'gold' ? '★ GOLD' : '★ SILVER') + '</span>' : '') +
        '<span class="mm-item-name">' + it.name + '</span>' +
        (wearing ? '<span class="mm-tag is-wear">Wearing</span>' : have ? '<span class="mm-tag">Owned</span>' :
          '<span class="mm-price">' + COIN + fmt(it.price) + '</span>') + '</button>';
    });
    ov.querySelector('[data-mm-grid]').innerHTML = html;
    var act = ov.querySelector('[data-mm-act]');
    var sel = closetState.sel && ITEM_BY_ID[closetState.sel];
    var boxTier = /^box:/.test(closetState.sel || '') ? closetState.sel.slice(4) : null;
    if (boxTier) {
      var left = boxPool(closetState.tab, boxTier).filter(function (it) { return c.owned.indexOf(it.id) < 0; }).length;
      var need = BLIND_BOXES[boxTier].price - balance();
      act.disabled = !left;
      act.innerHTML = !left ? 'You found all 5! ✨' : need > 0 ? 'Need ' + COIN + ' ' + fmt(need) + ' more' : 'Open for ' + COIN + ' ' + fmt(BLIND_BOXES[boxTier].price);
      act.setAttribute('data-mm-act', !left ? '' : need > 0 ? 'poor' : 'box');
    } else if (sel && c.owned.indexOf(sel.id) < 0) {
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
    if (/^box:/.test(closetState.sel || '')) { openBoxUI(closetState.tab, closetState.sel.slice(4)); return; }
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

  // ---------- blind boxes: box art and the opening show ----------
  function boxArt(tier) {
    var gold = tier === 'gold';
    var body = gold ? ['#FFE68A', '#E9AE2E'] : ['#F2F5FA', '#B9C5D4'];
    var ribbon = gold ? '#E8473C' : '#3E8EDB', knot = gold ? '#C62F3E' : '#2F6FB0';
    var id = 'mmBox' + tier;
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + body[0] + '"/><stop offset="1" stop-color="' + body[1] + '"/></linearGradient></defs>' +
      '<ellipse cx="50" cy="93" rx="34" ry="4" fill="rgba(74,47,26,0.18)"/>' +
      '<rect x="18" y="46" width="64" height="44" rx="6" fill="url(#' + id + ')" stroke="rgba(74,47,26,0.25)" stroke-width="1"/>' +
      '<rect x="12" y="33" width="76" height="16" rx="5" fill="' + body[0] + '" stroke="rgba(74,47,26,0.25)" stroke-width="1"/>' +
      '<rect x="44" y="33" width="12" height="57" fill="' + ribbon + '"/>' +
      '<ellipse cx="39" cy="26" rx="10" ry="6.4" fill="none" stroke="' + ribbon + '" stroke-width="5" transform="rotate(-20 39 26)"/>' +
      '<ellipse cx="61" cy="26" rx="10" ry="6.4" fill="none" stroke="' + ribbon + '" stroke-width="5" transform="rotate(20 61 26)"/>' +
      '<circle cx="50" cy="31" r="5.6" fill="' + knot + '"/>' +
      '<text x="31" y="78" font-size="22" font-weight="900" fill="#FFFFFF" stroke="rgba(74,47,26,0.35)" stroke-width="1" font-family="-apple-system,Segoe UI,Roboto,sans-serif" text-anchor="middle">?</text>' +
      '<text x="69" y="78" font-size="22" font-weight="900" fill="#FFFFFF" stroke="rgba(74,47,26,0.35)" stroke-width="1" font-family="-apple-system,Segoe UI,Roboto,sans-serif" text-anchor="middle">?</text>' +
      (gold ? sparkle(86, 30, 5, '#FFF6C8') + sparkle(14, 56, 3.6, '#FFF6C8') : sparkle(86, 30, 4, '#FFFFFF')) + '</svg>';
  }
  function sfxRattle() { [0, 0.14, 0.28, 0.42, 0.56, 0.7].forEach(function (t, i) { tone(i % 2 ? 392 : 440, 0.06, t, 'square', 0.03); }); }
  function sfxTada(gold) {
    (gold ? [784, 988, 1175, 1568, 1976] : [659, 784, 988, 1318]).forEach(function (f, i) { tone(f, 0.26, i * 0.09, 'triangle', 0.09); });
    sfxCoins();
  }
  var revealing = false;
  function openBoxUI(slot, tier) {
    if (revealing || !openOverlay) return;
    var res = openBox(slot, tier);
    if (res.result === 'poor') { sfxNope(); toast('Not enough Moints yet'); return; }
    if (res.result !== 'ok') { renderCloset(false); return; }
    revealing = true;
    var it = ITEM_BY_ID[res.id];
    var gold = tier === 'gold';
    var host = openOverlay;
    var rv = document.createElement('div');
    rv.className = 'mm-reveal';
    rv.innerHTML = '<div class="mm-reveal-card' + (gold ? ' is-gold' : '') + '" role="dialog" aria-modal="true" aria-label="' + BLIND_BOXES[tier].name + '">' +
      '<div class="mm-reveal-stage"><span class="mm-reveal-box">' + boxArt(tier) + '</span></div>' +
      '<h3>' + (gold ? 'Gold Box…' : 'Silver Box…') + '</h3><p>What will it be?</p></div>';
    host.appendChild(rv);
    sfxRattle();
    renderCards();
    setTimeout(function () {
      if (!rv.isConnected) { revealing = false; return; }
      var card = rv.querySelector('.mm-reveal-card');
      card.innerHTML = '<div class="mm-reveal-stage"><span class="mm-reveal-rays"></span><span class="mm-reveal-item">' + iconSVG(it.id) + '</span></div>' +
        '<span class="mm-reveal-new">NEW!</span><h3>' + it.name + '</h3>' +
        '<p>' + (gold ? '★ Gold Box' : '★ Silver Box') + ' · Moku is wearing it now!</p>' +
        '<button class="mm-big" type="button" data-mm-yay>Yay!</button>';
      sfxTada(gold);
      burst(card);
      var yay = card.querySelector('[data-mm-yay]');
      yay.focus();
      yay.addEventListener('click', function () {
        rv.remove();
        revealing = false;
        closetState.sel = res.id;
        renderCloset(true);
      });
      afterChange();
    }, 1150);
  }

  // ---------- hub slots: card / bar / doll ----------
  function dailyPill(ready) {
    return ready
      ? '<button class="mm-pill is-gold is-glow" type="button" data-mm-daily>🎁 Daily +' + DAILY_MOINTS + '</button>'
      : '<button class="mm-pill is-done" type="button" data-mm-daily>✓ Daily bonus</button>';
  }
  function renderCards() {
    var ready = canClaimDaily();
    var eq = readCloset().equipped;
    Array.prototype.forEach.call(document.querySelectorAll('[data-moku-doll]'), function (node) {
      var scene = node.hasAttribute('data-moku-scene');
      var key = (scene ? TABS : SLOTS).map(function (s) { return eq[s] || ''; }).join('|');
      // 服が変わった時だけ描き直す(浮遊アニメーションを途中で止めない)
      if (node.getAttribute('data-outfit') === key && node.firstChild) return;
      node.setAttribute('data-outfit', key);
      node.innerHTML = scene ? sceneHTML(eq) : dollHTML(eq);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-moku-moint-bar]'), function (node) {
      node.classList.add('mm-bar');
      node.innerHTML =
        '<span class="mm-bar-bal">' + COIN + '<b>' + fmt(balance()) + '</b><small>Moints</small></span>' +
        dailyPill(ready) +
        '<button class="mm-pill is-soft" type="button" data-moku-closet>👒 Closet</button>';
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
    changeListeners.push(renderCards);   // 買う・着替える・デイリー → 全部のスロットに反映
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
