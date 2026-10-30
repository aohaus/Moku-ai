/**
 * Moku Series — chess rules (SPEC.md §13 Moku Chess, multiplayer plan).
 *
 * The rules only: board (0x88), FEN, legal moves, make / unmake, check, and
 * how a game ends. No AI — moku-chess.html builds its CPU on top of this.
 * Used by both:
 *   - the browser:  <script src="shared/moku-chess-rules.js"></script>
 *                   → window.MokuChessRules
 *   - Node / Lambda: const MokuChessRules = require('./moku-chess-rules.js')
 *
 *   var pos = MokuChessRules.create();      // a position at the start
 *   pos.play('e2e4');                      // a move in UCI, or null if illegal
 *   pos.fen(); pos.status(keys);           // 'checkmate' | 'stalemate' | 'fifty' | 'material' | 'repetition' | null
 *   MokuChessRules.replay(['e2e4', 'e7e5']) // → { ok, applied, fen, turn, keys, status }
 *
 * create() must not use anything outside itself: moku-chess.html sends
 * create.toString() to its Web Worker.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MokuChessRules = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function create(startFen) {
    var PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6, BLACK = 8;
    var FL_EP = 1, FL_DOUBLE = 2, FL_CASTLE = 4;
    var KNIGHT_STEPS = [-33, -31, -18, -14, 14, 18, 31, 33];
    var BISHOP_DIRS = [-17, -15, 15, 17];
    var ROOK_DIRS = [-16, -1, 1, 16];
    var KING_STEPS = [-17, -16, -15, -1, 1, 15, 16, 17];
    var START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    var CASTLE_MASK = [];
    for (var ci = 0; ci < 128; ci++) CASTLE_MASK[ci] = 15;
    CASTLE_MASK[116] = 12; CASTLE_MASK[119] = 14; CASTLE_MASK[112] = 13;
    CASTLE_MASK[4] = 3; CASTLE_MASK[7] = 11; CASTLE_MASK[0] = 7;
    var PROMO_CHARS = '  nbrq';

    var board = [], turn = 0, castle = 0, ep = -1, half = 0, full = 1, kings = [116, 4], stack = [];

    function sqName(sq) { return 'abcdefgh'.charAt(sq & 7) + (8 - (sq >> 4)); }
    function sqFromName(n) { return (8 - parseInt(n.charAt(1), 10)) * 16 + 'abcdefgh'.indexOf(n.charAt(0)); }

    function load(fen) {
      var parts = (fen || START).split(/\s+/), rows = parts[0].split('/');
      for (var i = 0; i < 128; i++) board[i] = 0;
      for (var r = 0; r < 8; r++) {
        var c = 0, row = rows[r] || '';
        for (var j = 0; j < row.length; j++) {
          var ch = row.charAt(j);
          if (ch >= '1' && ch <= '8') { c += parseInt(ch, 10); continue; }
          var lower = ch === ch.toLowerCase(), type = 'pnbrqk'.indexOf(ch.toLowerCase()) + 1, sq = r * 16 + c;
          board[sq] = type | (lower ? BLACK : 0);
          if (type === KING) kings[lower ? 1 : 0] = sq;
          c++;
        }
      }
      turn = parts[1] === 'b' ? 1 : 0;
      var cs = parts[2] || '-';
      castle = (cs.indexOf('K') >= 0 ? 1 : 0) | (cs.indexOf('Q') >= 0 ? 2 : 0) | (cs.indexOf('k') >= 0 ? 4 : 0) | (cs.indexOf('q') >= 0 ? 8 : 0);
      ep = parts[3] && parts[3] !== '-' ? sqFromName(parts[3]) : -1;
      half = parseInt(parts[4], 10) || 0;
      full = parseInt(parts[5], 10) || 1;
      stack = [];
    }
    // 3回同じ局面の判定用。アンパッサンの印は、実際に取れる時だけ局面に含める
    function posKey() { return boardKey(epCapturable() ? sqName(ep) : '-'); }
    function fen() { return boardKey(ep >= 0 ? sqName(ep) : '-') + ' ' + half + ' ' + full; }
    function epCapturable() {
      if (ep < 0) return false;
      var us = turn ? BLACK : 0, from = turn ? [ep - 15, ep - 17] : [ep + 15, ep + 17];
      for (var i = 0; i < 2; i++) {
        var f = from[i];
        if ((f & 0x88) || board[f] !== (PAWN | us)) continue;
        var m = { f: f, t: ep, p: PAWN | us, c: PAWN | (us ^ BLACK), pr: 0, fl: FL_EP, s: 0 };
        make(m);
        var ok = !attacked(kings[turn ^ 1], turn);
        unmake();
        if (ok) return true;
      }
      return false;
    }
    function boardKey(epStr) {
      var out = '';
      for (var r = 0; r < 8; r++) {
        var empty = 0;
        for (var c = 0; c < 8; c++) {
          var p = board[r * 16 + c];
          if (!p) { empty++; continue; }
          if (empty) { out += empty; empty = 0; }
          var ch = ' pnbrqk'.charAt(p & 7);
          out += p & BLACK ? ch : ch.toUpperCase();
        }
        if (empty) out += empty;
        if (r < 7) out += '/';
      }
      var cs = (castle & 1 ? 'K' : '') + (castle & 2 ? 'Q' : '') + (castle & 4 ? 'k' : '') + (castle & 8 ? 'q' : '');
      return out + ' ' + (turn ? 'b' : 'w') + ' ' + (cs || '-') + ' ' + epStr;
    }

    function attacked(sq, by) {
      var c = by ? BLACK : 0, t, i, q;
      if (by) {
        t = sq - 15; if (!(t & 0x88) && board[t] === (PAWN | BLACK)) return true;
        t = sq - 17; if (!(t & 0x88) && board[t] === (PAWN | BLACK)) return true;
      } else {
        t = sq + 15; if (!(t & 0x88) && board[t] === PAWN) return true;
        t = sq + 17; if (!(t & 0x88) && board[t] === PAWN) return true;
      }
      for (i = 0; i < 8; i++) {
        t = sq + KNIGHT_STEPS[i]; if (!(t & 0x88) && board[t] === (KNIGHT | c)) return true;
        t = sq + KING_STEPS[i]; if (!(t & 0x88) && board[t] === (KING | c)) return true;
      }
      for (i = 0; i < 4; i++) {
        t = sq + BISHOP_DIRS[i];
        while (!(t & 0x88)) {
          q = board[t];
          if (q) { if (q === (BISHOP | c) || q === (QUEEN | c)) return true; break; }
          t += BISHOP_DIRS[i];
        }
        t = sq + ROOK_DIRS[i];
        while (!(t & 0x88)) {
          q = board[t];
          if (q) { if (q === (ROOK | c) || q === (QUEEN | c)) return true; break; }
          t += ROOK_DIRS[i];
        }
      }
      return false;
    }
    function inCheck() { return attacked(kings[turn], turn ^ 1); }

    function add(list, f, t, p, c, pr, fl) { list.push({ f: f, t: t, p: p, c: c, pr: pr || 0, fl: fl || 0, s: 0 }); }
    function addPromos(list, f, t, p, c) {
      var col = p & BLACK;
      add(list, f, t, p, c, QUEEN | col); add(list, f, t, p, c, KNIGHT | col);
      add(list, f, t, p, c, ROOK | col); add(list, f, t, p, c, BISHOP | col);
    }
    function gen(capsOnly) {
      var list = [], us = turn ? BLACK : 0, them = turn ? 0 : BLACK, f, t, q, i, k;
      for (f = 0; f < 128; f++) {
        if (f & 0x88) { f += 7; continue; }
        var p = board[f];
        if (!p || (p & BLACK) !== us) continue;
        var type = p & 7;
        if (type === PAWN) {
          var dir = turn ? 16 : -16, start = turn ? 1 : 6, last = turn ? 7 : 0;
          t = f + dir;
          if (!(t & 0x88) && !board[t]) {
            if ((t >> 4) === last) addPromos(list, f, t, p, 0);
            else if (!capsOnly) {
              add(list, f, t, p, 0);
              if ((f >> 4) === start && !board[t + dir]) add(list, f, t + dir, p, 0, 0, FL_DOUBLE);
            }
          }
          for (k = -1; k <= 1; k += 2) {
            t = f + dir + k;
            if (t & 0x88) continue;
            q = board[t];
            if (q && (q & BLACK) === them) {
              if ((t >> 4) === last) addPromos(list, f, t, p, q); else add(list, f, t, p, q);
            } else if (t === ep) add(list, f, t, p, PAWN | them, 0, FL_EP);
          }
        } else if (type === KNIGHT || type === KING) {
          var steps = type === KNIGHT ? KNIGHT_STEPS : KING_STEPS;
          for (i = 0; i < 8; i++) {
            t = f + steps[i];
            if (t & 0x88) continue;
            q = board[t];
            if (!q) { if (!capsOnly) add(list, f, t, p, 0); }
            else if ((q & BLACK) === them) add(list, f, t, p, q);
          }
        } else {
          var dirs = type === BISHOP ? BISHOP_DIRS : type === ROOK ? ROOK_DIRS : KING_STEPS;
          for (i = 0; i < dirs.length; i++) {
            t = f + dirs[i];
            while (!(t & 0x88)) {
              q = board[t];
              if (!q) { if (!capsOnly) add(list, f, t, p, 0); }
              else { if ((q & BLACK) === them) add(list, f, t, p, q); break; }
              t += dirs[i];
            }
          }
        }
      }
      if (!capsOnly) {
        if (!turn && board[116] === KING) {
          if ((castle & 1) && !board[117] && !board[118] && board[119] === ROOK &&
              !attacked(116, 1) && !attacked(117, 1) && !attacked(118, 1)) add(list, 116, 118, KING, 0, 0, FL_CASTLE);
          if ((castle & 2) && !board[115] && !board[114] && !board[113] && board[112] === ROOK &&
              !attacked(116, 1) && !attacked(115, 1) && !attacked(114, 1)) add(list, 116, 114, KING, 0, 0, FL_CASTLE);
        } else if (turn && board[4] === (KING | BLACK)) {
          if ((castle & 4) && !board[5] && !board[6] && board[7] === (ROOK | BLACK) &&
              !attacked(4, 0) && !attacked(5, 0) && !attacked(6, 0)) add(list, 4, 6, KING | BLACK, 0, 0, FL_CASTLE);
          if ((castle & 8) && !board[3] && !board[2] && !board[1] && board[0] === (ROOK | BLACK) &&
              !attacked(4, 0) && !attacked(3, 0) && !attacked(2, 0)) add(list, 4, 2, KING | BLACK, 0, 0, FL_CASTLE);
        }
      }
      return list;
    }
    function castleRook(m, undo) {
      var from, to;
      if (m.t === 118) { from = 119; to = 117; } else if (m.t === 114) { from = 112; to = 115; }
      else if (m.t === 6) { from = 7; to = 5; } else { from = 0; to = 3; }
      if (undo) { board[from] = board[to]; board[to] = 0; } else { board[to] = board[from]; board[from] = 0; }
    }
    function make(m) {
      stack.push({ m: m, castle: castle, ep: ep, half: half, k0: kings[0], k1: kings[1] });
      board[m.t] = m.pr || m.p;
      board[m.f] = 0;
      if (m.fl & FL_EP) board[m.t + (turn ? -16 : 16)] = 0;
      if (m.fl & FL_CASTLE) castleRook(m, false);
      if ((m.p & 7) === KING) kings[turn] = m.t;
      castle &= CASTLE_MASK[m.f] & CASTLE_MASK[m.t];
      ep = (m.fl & FL_DOUBLE) ? (m.f + m.t) >> 1 : -1;
      half = ((m.p & 7) === PAWN || m.c) ? 0 : half + 1;
      if (turn) full++;
      turn ^= 1;
    }
    function unmake() {
      var u = stack.pop(), m = u.m;
      turn ^= 1;
      if (turn) full--;
      board[m.f] = m.p;
      if (m.fl & FL_EP) { board[m.t] = 0; board[m.t + (turn ? -16 : 16)] = m.c; }
      else board[m.t] = m.c;
      if (m.fl & FL_CASTLE) castleRook(m, true);
      castle = u.castle; ep = u.ep; half = u.half; kings[0] = u.k0; kings[1] = u.k1;
    }
    function legalMoves() {
      var out = [], list = gen(false);
      for (var i = 0; i < list.length; i++) {
        make(list[i]);
        if (!attacked(kings[turn ^ 1], turn)) out.push(list[i]);
        unmake();
      }
      return out;
    }
    function insufficient() {
      var minors = [], sq;
      for (sq = 0; sq < 128; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        var p = board[sq] & 7;
        if (!p || p === KING) continue;
        if (p === PAWN || p === ROOK || p === QUEEN) return false;
        minors.push({ p: p, color: ((sq >> 4) + (sq & 7)) & 1 });
      }
      if (minors.length <= 1) return true;
      return minors.every(function (m) { return m.p === BISHOP && m.color === minors[0].color; });
    }
    // history: position keys (posKey) after every move so far, including now
    function status(history) {
      if (!legalMoves().length) return inCheck() ? 'checkmate' : 'stalemate';
      if (half >= 100) return 'fifty';
      if (insufficient()) return 'material';
      var key = posKey(), n = 0;
      (history || []).forEach(function (k) { if (k === key) n++; });
      if (n >= 3) return 'repetition';
      return null;
    }


    // ---------- UCI ("e2e4", "e7e8q") ----------
    function uciOf(m) {
      return sqName(m.f) + sqName(m.t) + (m.pr ? PROMO_CHARS.charAt(m.pr & 7) : '');
    }
    // The legal move this UCI string names, or null. Strict: a promotion must
    // say its piece, and only a promotion may.
    function moveFromUci(uci) {
      if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][nbrq]?$/.test(uci)) return null;
      var f = sqFromName(uci.slice(0, 2)), t = sqFromName(uci.slice(2, 4));
      var pr = uci.charAt(4) ? PROMO_CHARS.indexOf(uci.charAt(4)) : 0;
      var list = legalMoves();
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.f === f && m.t === t && (m.pr & 7) === pr) return m;
      }
      return null;
    }
    // Makes the move if it is legal. Returns the move, or null (nothing changed).
    function play(uci) {
      var m = moveFromUci(uci);
      if (m) make(m);
      return m;
    }

    load(startFen || START);

    return {
      START: START,
      PAWN: PAWN, KNIGHT: KNIGHT, BISHOP: BISHOP, ROOK: ROOK, QUEEN: QUEEN, KING: KING, BLACK: BLACK,
      load: load, fen: fen, posKey: posKey,
      legalMoves: legalMoves, make: make, unmake: unmake,
      inCheck: inCheck, status: status,
      uciOf: uciOf, moveFromUci: moveFromUci, play: play,
      at: function (sq) { return board[sq]; },
      turn: function () { return turn; },
      half: function () { return half; },
      kingSq: function (side) { return kings[side]; },
      sqName: sqName, sqFromName: sqFromName,
      // For the CPU in moku-chess.html (search needs the raw board and pseudo-legal moves)
      board: board, kings: kings, gen: gen, attacked: attacked
    };
  }

  // Plays a list of UCI moves from the start (or startFen). Stops at the
  // first illegal move, or at a move after the game has already ended
  // (checkmate, a draw): ok = false and applied = how many were played, so
  // status stays the ending's. keys = the position after every move, the
  // start included (for repetition).
  function replay(moves, startFen) {
    var pos = create(startFen);
    var keys = [pos.posKey()], applied = 0, list = moves || [];
    for (var i = 0; i < list.length; i++) {
      if (pos.status(keys)) break;
      if (!pos.play(list[i])) break;
      keys.push(pos.posKey());
      applied++;
    }
    return {
      ok: applied === list.length,
      applied: applied,
      fen: pos.fen(),
      turn: pos.turn() ? 'b' : 'w',
      keys: keys,
      status: pos.status(keys),
      position: pos
    };
  }

  return { create: create, replay: replay, START: create().START };
});
