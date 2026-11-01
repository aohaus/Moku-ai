/*
 * Moku Word Riddles — the riddle engine: reads the riddle list from Markdown
 * (data/riddles-db.md), lays out each puzzle from its one-line "Visual", and
 * checks answers. The riddles themselves live only in the Markdown file:
 * adding one never needs a code change.
 *
 * UMD: the browser gets window.MokuRiddles (moku-word-riddles.html fetches
 * data/riddles-db.md and calls MokuRiddles.load(text)); Node gets require()
 * (backend/src/riddles.js loads its copy for Riddle Race, which judges answers
 * with the same isCorrect). Lambda only ships backend/, so copies live in
 * backend/src/vendor/: edit shared/moku-riddles.js and data/riddles-db.md, then
 *   cp shared/moku-riddles.js backend/src/vendor/ && cp data/riddles-db.md backend/src/vendor/
 * (npm test fails when they differ, and when a riddle doesn't parse).
 *
 * A riddle in the Markdown:
 *   ## ID: bicycle
 *   - **Level**: medium              easy / medium / tricky (default medium)
 *   - **Pattern**: quantity          a label for people; "emoji" entries are skipped
 *   - **Visual**: CYCLE | CYCLE      what the card shows (below)
 *   - **Answer**: bicycle
 *   - **Also**: bike                 other answers that count (comma separated)
 *   - **Hint**: It has two wheels and you pedal it.
 *   - **Why**: BI means two. Two CYCLEs = BICYCLE!     (shown after; optional)
 *   - **Choices**: motorcycle, tricycle, unicycle      (3 wrong answers; optional)
 *
 * Visual: rows from top to bottom split by " / ", items in a row split by " | ".
 *   An item is text with optional (modifiers), or [line] / [box] / [box: TEXT].
 *   In text, {WORD} is drawn in the accent color (only when the color is the
 *   point) and ^ raises what follows (ICE^3). Everything else is one ink color.
 *   Modifiers (comma separated): top, bottom, left, right, top left … ;
 *   xN (N copies); vertical; upside down; sideways (reads upward); backwards;
 *   big, small, tiny; stretched; tilted; growing, rising, shrinking, falling,
 *   bumpy, jumbled, cross.
 *   Also understood: "WORD placed at top", "DAY surrounded by M-I-D", T-O-W-N,
 *   "vertical stack", "reversed", "stretched horizontally", "zigzag", a trailing (v12).
 *
 * Card coordinates: x, y = center in % of the card; s = font size in % of the
 * card width. The card is 16:10, so one width-% is 1.6 height-%.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MokuRiddles = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LEVELS = { easy: 1, medium: 2, tricky: 3, '1': 1, '2': 2, '3': 3 };
  var CHAR_W = 0.64;      // average letter width (Fredoka 700) in font sizes
  var Y_PER_S = 1.6;      // one unit of font size, in height-%

  var RIDDLES = [];       // filled by load(); the same array object stays (pages keep a reference)
  var byId = {};

  function norm(s) { return String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, ''); }
  function accepted(r) { return [r.answer].concat(r.alts || []).map(norm); }
  // Is this a right answer to that riddle? (Same rule in the game and on the server.)
  function isCorrect(id, answer) {
    var r = byId[id], v = norm(answer);
    return !!(r && v && accepted(r).indexOf(v) >= 0);
  }
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round(v) { return Math.round(v * 10) / 10; }

  // ================= Visual → art pieces =================
  var POS = {
    top: { y: 16 }, bottom: { y: 84 }, left: { x: 18 }, right: { x: 82 },
    'top left': { x: 24, y: 16 }, 'top right': { x: 76, y: 16 }, 'bottom left': { x: 24, y: 84 }, 'bottom right': { x: 76, y: 84 }
  };
  var SHAPES = ['growing', 'rising', 'shrinking', 'falling', 'bumpy', 'jumbled', 'cross'];
  var FLAGS = ['vertical', 'upside down', 'sideways', 'backwards', 'big', 'small', 'tiny', 'stretched', 'tilted'];
  var ALIASES = { 'vertical stack': 'vertical', reversed: 'backwards', reverse: 'backwards', 'stretched horizontally': 'stretched',
    'at top': 'top', 'at bottom': 'bottom', huge: 'big', 'zigzag': 'bumpy', 'mixed up': 'jumbled', 'scrambled': 'jumbled' };

  // "ICE^3", "HA{HAND}ND" → { parts: [[text, accent?]…], sup, plain }
  function parseText(raw) {
    var sup = '', t = raw;
    var caret = t.indexOf('^');
    if (caret >= 0) { sup = t.slice(caret + 1); t = t.slice(0, caret); }
    var parts = [], re = /\{([^}]*)\}/g, last = 0, m;
    while ((m = re.exec(t))) {
      if (m.index > last) parts.push([t.slice(last, m.index), false]);
      parts.push([m[1], true]);
      last = re.lastIndex;
    }
    if (last < t.length) parts.push([t.slice(last), false]);
    return { parts: parts, sup: sup, plain: parts.map(function (p) { return p[0]; }).join('') };
  }

  // One item: "WORD (mod, mod)" / "[line]" / "[box: WORD]" → { kind, text, mods, pos, n, shape }
  function parseItem(raw, problems) {
    var str = raw.trim();
    var m = /^\[(line|horizontal line|box)(?::\s*(.+))?\]$/i.exec(str);
    if (m) return { kind: /box/i.test(m[1]) ? 'box' : 'line', text: m[2] ? parseText(m[2].trim()) : null, mods: {} };
    if (/^\[/.test(str)) { problems.push('unknown item ' + str); return null; }
    var item = { kind: 'text', mods: {}, n: 1, pos: null, shape: null };
    var placed = /^(.*?)\s+placed at (top left|top right|bottom left|bottom right|top|bottom|left|right)$/i.exec(str);
    if (placed) { str = placed[1]; item.pos = placed[2].toLowerCase(); }
    var around = /^(.*?)\s+surrounded by\s+(.+)$/i.exec(str);
    if (around) {
      var outer = around[2].replace(/-/g, ''), half = Math.ceil(outer.length / 2);
      str = outer.slice(0, half) + '{' + around[1] + '}' + outer.slice(half);
    }
    var mm = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(str);
    if (mm && mm[1]) {
      str = mm[1];
      mm[2].split(',').forEach(function (mod) {
        mod = mod.trim().toLowerCase().replace(/\s+/g, ' ');
        if (!mod) return;
        if (/zigzag/.test(mod)) mod = 'zigzag';
        mod = ALIASES[mod] || mod;
        var x = /^x\s*(\d+)$/.exec(mod);
        if (x) item.n = clamp(Number(x[1]), 1, 12);
        else if (POS[mod]) item.pos = mod;
        else if (SHAPES.indexOf(mod) >= 0) item.shape = mod;
        else if (FLAGS.indexOf(mod) >= 0) item.mods[mod] = true;
        else problems.push('unknown modifier "' + mod + '"');
      });
    }
    if (/^([A-Za-z]-)+[A-Za-z]$/.test(str)) str = str.replace(/-/g, '');   // T-O-W-N
    item.text = parseText(str);
    if (item.mods.backwards) {
      item.text = parseText(item.text.plain.split('').reverse().join(''));
    }
    if (!item.text.plain.trim()) { problems.push('empty item'); return null; }
    return item;
  }

  // Letter widths in font sizes (Fredoka 700): narrow I and 1, wide M and W.
  function ems(t, sp) {
    var w = 0;
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      w += (/[Iil1|!'.,:;]/.test(ch) ? 0.3 : /[MWmw]/.test(ch) ? 0.86 : ch === ' ' ? 0.3 : CHAR_W) + (sp || 0);
    }
    return Math.max(w, 0.5);
  }
  function textWidth(t, s, sp) { return ems(t, sp) * s; }
  function fitSize(t, maxW, maxS, sp) { return Math.min(maxS, maxW / ems(t, sp)); }

  // A single line of text (with accent parts and a raised ^) centered at x, y.
  function textPieces(tx, x, y, s, extra) {
    var out = [], piece = { x: round(x), y: round(y), s: round(s) };
    if (tx.parts.length === 1 && !tx.parts[0][1]) piece.t = tx.parts[0][0];
    else piece.parts = tx.parts.map(function (p) { return [p[0], p[1] ? 'accent' : 'ink']; });
    for (var k in extra) piece[k] = extra[k];
    out.push(piece);
    if (tx.sup) {
      var w = textWidth(tx.plain, s, extra && extra.sp);
      out.push({ t: tx.sup, x: round(x + w / 2 + s * 0.12), y: round(y - s * Y_PER_S * 0.42), s: round(s * 0.45) });
    }
    return out;
  }

  // Letters one by one along a shape (WATER falling, SHRINK shrinking …) inside a box.
  function shapePieces(item, box) {
    var letters = item.text.plain.replace(/\s+/g, '').split(''), n = letters.length, out = [];
    var w = box.w, h = box.h, x0 = box.x - w / 2, y0 = box.y - h / 2;
    function at(i, x, y, s, r) { var p = { t: letters[i], x: round(x), y: round(y), s: round(s) }; if (r) p.r = Math.round(r); out.push(p); }
    var f = n > 1 ? 1 / (n - 1) : 0, i, s;
    var span = Math.min(1, n * 0.17);   // short words stay together instead of spreading over the whole card
    switch (item.shape) {
      case 'growing':
      case 'rising':
        for (i = 0; i < n; i++) {
          s = item.shape === 'growing' ? 5 + 7 * i * f : 12;
          at(i, box.x + w * 0.76 * span * (i * f - 0.5), box.y + h * 0.72 * span * (0.5 - i * f), Math.min(s, w / n * 1.2));
        }
        break;
      case 'falling':
        for (i = 0; i < n; i++) at(i, box.x + w * 0.32 * span * (i * f - 0.5), box.y + h * 0.72 * span * (i * f - 0.5), Math.min(11, h / n / Y_PER_S * 1.3), i ? 95 * Math.pow(i * f, 1.3) : 0);
        break;
      case 'shrinking': {
        var sizes = [], total = 0, k = Math.pow(0.27, f || 1);
        for (i = 0; i < n; i++) { sizes.push(17 * Math.pow(k, i)); total += sizes[i] * 0.78; }
        var scale = Math.min(1, w * 0.9 / total), cx = box.x - total * scale / 2;
        for (i = 0; i < n; i++) { s = sizes[i] * scale; at(i, cx + s * 0.39, box.y, s); cx += s * 0.78; }
        break;
      }
      case 'bumpy':
        s = Math.min(14, w * 0.8 / n / CHAR_W / 1.2);
        for (i = 0; i < n; i++) at(i, x0 + w * (0.5 + (i - (n - 1) / 2) / (n + 1) * 1.1), box.y + (i % 2 ? 14 : -14), s, i % 2 ? 9 : -9);
        break;
      case 'jumbled': {
        var order = letters.map(function (ch, j) { return j; }).sort(function (a, b) { return (hash(letters.join('') + a) % 97) - (hash(letters.join('') + b) % 97); });
        if (order.every(function (o, j) { return o === j; })) order.reverse();
        var turns = [-25, 20, 15, -160, -10, 30, 12, -20];
        s = Math.min(14, w * 0.8 / n / CHAR_W / 1.1);
        for (i = 0; i < n; i++) at(order[i], x0 + w * (0.5 + (i - (n - 1) / 2) / (n + 1) * 1.15), box.y + (i % 2 ? 14 : -12), s, turns[i % turns.length]);
        break;
      }
      case 'cross': {
        s = Math.min(11, w * 0.8 / n / CHAR_W / 1.4, h * 0.8 / n / Y_PER_S / 1.15);
        var stepX = s * CHAR_W * 1.6, stepY = s * Y_PER_S * 1.15, sx = box.x - stepX * (n - 1) / 2 + stepX * 0.5;
        for (i = 0; i < n; i++) at(i, sx + stepX * i, box.y, s);
        for (i = 0; i < n; i++) if (i !== 1) at(i, sx + stepX, box.y + stepY * (i - 1), s);
        break;
      }
    }
    return out;
  }

  // Lay out one item inside its cell { x, y, w, h } (all in card %).
  function itemPieces(item, cell, single, idx) {
    if (item.kind === 'line') return [{ line: round(cell.w * (single ? 0.75 : 0.8)), x: round(cell.x), y: round(cell.y) }];
    if (item.kind === 'box') {
      var bw = Math.min(cell.w * 0.85, 52), bh = Math.min(cell.h * 0.85, 60);
      var out = [{ box: [round(bw), round(bh)], x: round(cell.x), y: round(cell.y) }];
      if (item.text) out = out.concat(textPieces(item.text, cell.x, cell.y, fitSize(item.text.plain, bw * 0.75, bh * 0.45 / Y_PER_S)));
      return out;
    }
    var m = item.mods, tx = item.text;
    if (item.pos) {
      var p = POS[item.pos];
      cell = { x: p.x !== undefined ? p.x : cell.x, y: p.y !== undefined ? p.y : cell.y,
        w: p.x !== undefined ? 40 : Math.min(cell.w, 80), h: p.y !== undefined ? 26 : cell.h };
    }
    if (item.shape) return shapePieces(item, cell);
    if (item.n > 1) {
      var cols = item.n <= 3 ? item.n : item.n === 4 ? 2 : item.n <= 6 ? 3 : item.n <= 8 ? 4 : 3;
      var rows = Math.ceil(item.n / cols), cw = cell.w / cols, ch = cell.h / rows, list = [];
      var cs = Math.min(fitSize(tx.plain, cw * 0.86, 14), ch * 0.62 / Y_PER_S);
      for (var k = 0; k < item.n; k++) {
        var r = Math.floor(k / cols), inRow = Math.min(cols, item.n - r * cols), c = k - r * cols;
        list = list.concat(textPieces(tx, cell.x + (c - (inRow - 1) / 2) * cw, cell.y + (r - (rows - 1) / 2) * ch, cs));
      }
      return list;
    }
    var extra = {}, s;
    var maxS = Math.min(single ? 26 : 18, cell.h * 0.72 / Y_PER_S);
    if (m.vertical) {
      var len = tx.plain.length;
      s = Math.min(maxS, cell.h * 0.88 / (len * 1.0 + (len - 1) * 0.6) / Y_PER_S, cell.w * 0.8 / CHAR_W);
      return [{ t: tx.plain, vert: 1, x: round(cell.x), y: round(cell.y), s: round(s) }];
    }
    if (m.stretched) extra.sp = 0.55;
    if (m.sideways) {
      s = Math.min(maxS * 1.2, fitSize(tx.plain, cell.h * 0.9 / Y_PER_S, 30), cell.w * 0.6 / Y_PER_S);
      extra.r = -90;
    } else {
      s = fitSize(tx.plain + (tx.sup ? ' ' : ''), cell.w * 0.9, maxS, extra.sp);
    }
    if (m.big) s = Math.min(fitSize(tx.plain, cell.w * 0.95, 34), s * 1.6);
    if (m['upside down']) extra.r = 180;
    if (m.tilted) extra.r = idx % 2 ? 7 : -7;
    if (m.small) s *= 0.6;
    if (m.tiny) s = Math.min(s, 4.5);
    return textPieces(tx, cell.x, cell.y, s, extra);
  }

  // "AIR / PORT" → art pieces. problems collects anything it couldn't read.
  function layout(visual, problems) {
    var rows = String(visual).replace(/\s*\(v\d+\)\s*$/i, '').split(/\s+\/\s+/).map(function (row) {
      return row.split(/\s+\|\s+/).map(function (it) { return parseItem(it, problems); }).filter(Boolean);
    }).filter(function (r) { return r.length; });
    var R = rows.length, gap = R > 1 ? Math.min(36, 64 / (R - 1)) : 0, art = [], idx = 0;
    rows.forEach(function (row, ri) {
      var y = 50 + (ri - (R - 1) / 2) * gap, h = R > 1 ? gap : 80, n = row.length, cw = 92 / n;
      row.forEach(function (item, j) {
        var cell = { x: 4 + cw * (j + 0.5), y: y, w: cw, h: h };
        art = art.concat(itemPieces(item, cell, R === 1 && n === 1, idx++));
      });
    });
    if (!art.length) problems.push('nothing to show');
    return art;
  }

  // ================= Markdown → riddles =================
  // Returns { riddles, problems: ["ID x: …"], duplicates: [ids] }. Riddles that
  // don't read cleanly are left out (and listed in problems); the same id or
  // the same answer a second time is left out too (duplicates).
  function parse(md) {
    var riddles = [], problems = [], duplicates = [], seenId = {}, seenAnswer = {};
    String(md || '').replace(/\r/g, '').split(/^##\s+/m).slice(1).forEach(function (block) {
      var lines = block.split('\n'), title = lines[0].trim();
      var idm = /^ID\s*:\s*(.+)$/i.exec(title);
      var id = String(idm ? idm[1] : title).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      var f = {};
      lines.slice(1).forEach(function (line) {
        var m = /^\s*[-*]\s*\*\*([^*]+)\*\*\s*:\s*(.*)$/.exec(line);
        if (m) f[m[1].trim().toLowerCase()] = m[2].trim();
      });
      if (!id) return;
      var where = 'ID ' + id + ': ';
      if (/emoji|picture/i.test(f.pattern || '')) return;   // word puzzles only
      var visual = (f.visual || '').replace(/\s*\(v\d+\)\s*$/i, '');
      if (!visual) { problems.push(where + 'no Visual'); return; }
      if (!f.answer) { problems.push(where + 'no Answer'); return; }
      var mine = [];
      var art = layout(visual, mine);
      if (mine.length) { problems.push(where + mine.join(', ')); return; }
      var answer = f.answer.replace(/\s+/g, ' ').toLowerCase();
      if (seenId[id] || seenAnswer[norm(answer)]) { duplicates.push(id); return; }
      seenId[id] = seenAnswer[norm(answer)] = true;
      var list = function (v) { return (v || '').split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean); };
      riddles.push({
        id: id,
        level: LEVELS[(f.level || '').toLowerCase()] || 2,
        pattern: f.pattern || '',
        visual: visual,
        answer: answer,
        alts: list(f.also || f.alts),
        clue: f.hint || f.clue || 'Look closely at the words!',
        why: f.why || '',
        choices: list(f.choices),
        art: art
      });
    });
    return { riddles: riddles, problems: problems, duplicates: duplicates };
  }

  // Use these riddles (the Markdown text, or parse()'s riddles). Fills in what
  // a riddle left out: Why, and Choices (other answers, picked the same way every time).
  function load(src) {
    var list = typeof src === 'string' ? parse(src).riddles : src;
    RIDDLES.length = 0;
    byId = {};
    list.forEach(function (r) { RIDDLES.push(r); byId[r.id] = r; });
    RIDDLES.forEach(function (r) {
      if (!r.why) r.why = 'The answer is ' + r.answer.toUpperCase() + '!';
      if (r.choices.length >= 3) { r.choices = r.choices.slice(0, 3); return; }
      var others = RIDDLES.filter(function (o) { return o !== r && accepted(r).indexOf(norm(o.answer)) < 0 && r.choices.indexOf(o.answer) < 0; })
        .sort(function (a, b) { return hash(r.id + a.id) - hash(r.id + b.id); });
      while (r.choices.length < 3 && others.length) r.choices.push(others.shift().answer);
    });
    return RIDDLES;
  }

  // ---------- Riddle Race (backend/src/roomApi.js, API_SPEC.md "Rooms") ----------
  // Everyone in a room sees the same riddle at the same time. The first right
  // answer wins that riddle; then everyone sees the answer for a moment and
  // the next riddle starts. Nobody right in time: the answer shows and it moves on.
  // The page and the server both work out where the race is from the same
  // facts (startAt, wins, count), so this timeline is shared.
  var RACE = { COUNTDOWN_MS: 4000, LIMIT_MS: 45000, GAP_MS: 5000 };
  // room: { status, startAt, count, wins: { "<q>": { at, … } } } → where the race is at time t:
  //   { phase: 'lobby' | 'closed' }
  //   { phase: 'countdown', q: 0, startAt }
  //   { phase: 'question', q, startAt, endsAt }
  //   { phase: 'reveal', q, startAt, endAt, nextAt, win }   (win null = time ran out)
  //   { phase: 'done', endedAt }
  function raceTimeline(room, t) {
    if (room.status === 'lobby' || room.status === 'closed' || !room.startAt) return { phase: room.status === 'closed' ? 'closed' : 'lobby' };
    var start = room.startAt, wins = room.wins || {};
    if (t < start) return { phase: 'countdown', q: 0, startAt: start };
    for (var q = 0; q < room.count; q++) {
      var w = wins[q] || null;
      var end = w ? w.at : start + RACE.LIMIT_MS;
      if (!w && t < end) return { phase: 'question', q: q, startAt: start, endsAt: end };
      if (t < end + RACE.GAP_MS) return { phase: 'reveal', q: q, startAt: start, endAt: end, nextAt: end + RACE.GAP_MS, win: w };
      start = end + RACE.GAP_MS;
    }
    return { phase: 'done', endedAt: start - RACE.GAP_MS };
  }

  return {
    RIDDLES: RIDDLES, get: function (id) { return byId[id] || null; }, norm: norm, accepted: accepted, isCorrect: isCorrect,
    parse: parse, layout: layout, load: load,
    RACE: RACE, raceTimeline: raceTimeline
  };
});
