const { TAG_RE } = require("./playCommon");

// Moyomoyo Multiplayer (API_SPEC.md "Rooms" → Moyomoyo): 2–4 players, 3 games,
// the highest total score wins. It rides on the Riddle Race rooms (roomApi.js:
// code, invites, host starts, "again") with game "moyomoyo".
//
// The server is only a mailbox and a referee. Every page runs its own board
// (the same code as Moyo Quest) with the round's shared seed, and posts a small
// state about once a second: score, alive, a 90-letter picture of the board and
// the attacks it sent ({ id, to: { tag: cells } }). The other pages read those
// attacks and drop the お邪魔 on themselves — it waits in the "incoming" tray
// until the next piece anyway, so a second of delay never shows.
//
// Each player writes only their own row (pk ROOM#<code>, sk P#<uid>), so four
// players chaining at the same moment never fight over one item. The room item
// only changes when a game starts or ends; advance() works that out from the
// rows, the same way on every request.

const RULES = {
  ROUNDS: 3,
  MAX_PLAYERS: 4,
  COUNTDOWN_MS: 5000,      // "3, 2, 1" before each game
  ROUND_MS: 180000,        // a game ends after 3 minutes even if more than one board is left
  INTERMISSION_MS: 9000,   // the scores between games
  STALE_MS: 12000,         // no word from a page this long during a game → that player is out
  GRACE_MS: 4000,          // after a game ends, how long to wait for everyone's final score
};
const BOARD_RE = /^[.0-4rg]{90}$/;   // 10 columns × 9 rows, top row first
const MAX_SCORE = 10000000;
const MAX_ATTACKS = 30;              // the page keeps its latest ones; older ones were read long ago
const MAX_CELLS = 200;

function newRoomFields() {
  return { round: 0, seeds: [], roundStartAt: null, roundEndAt: null, results: [] };
}

function start(room, t, newSeed) {
  room.status = "playing";
  room.round = 1;
  room.seeds = Array.from({ length: RULES.ROUNDS }, () => newSeed());
  room.roundStartAt = t + RULES.COUNTDOWN_MS;
  room.roundEndAt = null;
  room.results = [];
}

// { r, score, alive, final, board, attacks } → a clean copy, or null if it isn't one.
function cleanState(body) {
  if (!body || !Number.isInteger(body.r) || body.r < 1 || body.r > RULES.ROUNDS) return null;
  if (!Number.isInteger(body.score) || body.score < 0 || body.score > MAX_SCORE) return null;
  if (typeof body.alive !== "boolean" || (body.final !== undefined && typeof body.final !== "boolean")) return null;
  const board = body.board === undefined ? "" : body.board;
  if (typeof board !== "string" || (board && !BOARD_RE.test(board))) return null;
  const list = body.attacks === undefined ? [] : body.attacks;
  if (!Array.isArray(list) || list.length > MAX_ATTACKS) return null;
  const attacks = [];
  for (const a of list) {
    if (!a || !Number.isInteger(a.id) || a.id < 1 || !a.to || typeof a.to !== "object" || Array.isArray(a.to)) return null;
    const to = {};
    const tags = Object.keys(a.to);
    if (tags.length < 1 || tags.length > RULES.MAX_PLAYERS - 1) return null;
    for (const tag of tags) {
      const n = a.to[tag];
      if (!TAG_RE.test(tag) || !Number.isInteger(n) || n < 1 || n > MAX_CELLS) return null;
      to[tag] = n;
    }
    attacks.push({ id: a.id, to });
  }
  return { r: body.r, score: body.score, alive: body.alive, final: !!body.final, board, attacks };
}

// The row to save, on top of what this player already said this game: a board
// that topped out stays out, a final score stays final.
function mergeState(prev, next, uid, t) {
  const same = prev && prev.r === next.r;
  return {
    uid,
    r: next.r,
    score: same && prev.final ? prev.score : next.score,
    alive: same && !prev.alive ? false : next.alive,
    final: (same && prev.final) || next.final,
    board: next.board,
    attacks: next.attacks,
    at: t,
  };
}

function stale(room, states, uid, t) {
  const s = states[uid];
  const last = Math.max(s ? s.at : 0, room.roundStartAt || 0);
  return t - last > RULES.STALE_MS;
}
function stateIn(states, uid, r) {
  const s = states[uid];
  return s && s.r === r ? s : null;
}
function isOut(room, states, uid, t) {
  const s = stateIn(states, uid, room.round);
  return stale(room, states, uid, t) || (s ? !s.alive : false);
}

// Moves the room along (game over → scores → next game / done). Returns true
// when it changed the room, so the caller saves it.
function advance(room, states, t) {
  if (room.status !== "playing" || !room.round || t < room.roundStartAt) return false;
  const r = room.round;
  if (!room.roundEndAt) {
    const left = room.players.filter((p) => !isOut(room, states, p.uid, t)).length;
    if ((room.players.length >= 2 && left <= 1) || t >= room.roundStartAt + RULES.ROUND_MS) {
      room.roundEndAt = t;
      return true;
    }
    return false;
  }
  const settled = room.players.every((p) => {
    const s = stateIn(states, p.uid, r);
    return (s && s.final) || stale(room, states, p.uid, t);
  });
  if (!settled && t < room.roundEndAt + RULES.GRACE_MS) return false;
  const scores = {};
  room.players.forEach((p) => {
    const s = stateIn(states, p.uid, r);
    scores[p.uid] = s ? s.score : 0;
  });
  room.results = (room.results || []).concat([{ scores }]);
  if (r < RULES.ROUNDS) {
    room.round = r + 1;
    room.roundStartAt = t + RULES.INTERMISSION_MS;
    room.roundEndAt = null;
  } else {
    room.status = "done";
    room.endedAt = t;
  }
  return true;
}

// Totals over the games played so far, best first. Same total → same rank.
function standings(room) {
  const rows = room.players.map((p) => ({
    uid: p.uid,
    tag: p.tag,
    name: p.name,
    games: (room.results || []).map((res) => res.scores[p.uid] || 0),
  }));
  rows.forEach((row) => { row.total = row.games.reduce((a, b) => a + b, 0); });
  rows.sort((a, b) => b.total - a.total);
  rows.forEach((row) => { row.rank = 1 + rows.filter((o) => o.total > row.total).length; });
  return rows;
}

// The Moyomoyo part of what a player sees.
function view(room, states, t) {
  const tagByUid = {};
  room.players.forEach((p) => { tagByUid[p.uid] = p.tag; });
  const started = room.status === "playing" || room.status === "done";
  const r = room.round;
  return {
    rules: RULES,
    round: r || 0,
    seed: room.status === "playing" && r ? room.seeds[r - 1] : null,
    roundStartAt: room.roundStartAt || null,
    roundEndAt: room.roundEndAt || null,
    results: (room.results || []).map((res) => {
      const scores = {};
      Object.keys(res.scores).forEach((uid) => { if (tagByUid[uid]) scores[tagByUid[uid]] = res.scores[uid]; });
      return { scores };
    }),
    standings: standings(room).map(({ uid, ...row }) => row),
    states: started && states
      ? room.players.map((p) => {
        const s = stateIn(states, p.uid, r);
        return {
          tag: p.tag,
          r: s ? s.r : r,
          score: s ? s.score : 0,
          alive: s ? s.alive : true,
          out: isOut(room, states, p.uid, t),
          final: s ? s.final : false,
          board: s ? s.board : "",
          attacks: s ? s.attacks : [],
        };
      })
      : [],
  };
}

module.exports = { RULES, newRoomFields, start, cleanState, mergeState, advance, standings, view };
