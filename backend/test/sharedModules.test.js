// The browser-and-Lambda modules in shared/: chess rules and seeded random.
const test = require("node:test");
const assert = require("node:assert/strict");
const Rules = require("../../shared/moku-chess-rules.js");
const MokuRandom = require("../../shared/moku-random.js");

function perft(pos, depth) {
  if (!depth) return 1;
  let n = 0;
  for (const m of pos.legalMoves()) {
    pos.make(m);
    n += perft(pos, depth - 1);
    pos.unmake();
  }
  return n;
}

// Standard perft positions (chessprogramming.org/Perft_Results): castling,
// en passant, promotion and checks all show up in these counts.
test("chess rules: legal move counts match the standard perft positions", () => {
  const cases = [
    [Rules.START, [20, 400, 8902]],
    ["r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039]],
    ["8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812]],
    ["r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467]],
    ["rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486]],
  ];
  for (const [fen, counts] of cases) {
    const pos = Rules.create(fen);
    counts.forEach((n, i) => assert.equal(perft(pos, i + 1), n, `${fen} depth ${i + 1}`));
    assert.equal(pos.fen(), fen.replace(/ (\d+) (\d+)$/, " $1 $2"), "make/unmake leaves the position as it was");
  }
});

test("chess rules: UCI moves are strict", () => {
  const pos = Rules.create();
  assert.ok(pos.play("e2e4"));
  assert.equal(pos.play("e2e4"), null, "no piece there any more");
  assert.equal(pos.play("e7e5q"), null, "a promotion letter on a normal move");
  assert.equal(pos.play("E7E5"), null, "upper case");
  assert.equal(pos.play(""), null);
  assert.equal(pos.play(null), null);
  assert.equal(pos.fen(), "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");

  const promo = Rules.create("8/4P3/8/8/8/8/k7/4K3 w - - 0 1");
  assert.equal(promo.play("e7e8"), null, "a promotion must say its piece");
  assert.ok(promo.play("e7e8n"));
  assert.equal(promo.uciOf(promo.legalMoves()[0]).length, 4);
});

test("chess rules: replay finds every way a game ends", () => {
  assert.equal(Rules.replay(["f2f3", "e7e5", "g2g4", "d8h4"]).status, "checkmate");
  const knights = ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"];
  assert.equal(Rules.replay(knights).status, "repetition");
  assert.equal(Rules.replay(knights.slice(0, 7)).status, null);
  const afterDraw = Rules.replay([...knights, "e2e4"]);
  assert.equal(afterDraw.ok, false, "no moves after the game has ended");
  assert.equal(afterDraw.applied, 8);
  assert.equal(afterDraw.status, "repetition");
  const afterMate = Rules.replay(["f2f3", "e7e5", "g2g4", "d8h4", "a2a3"]);
  assert.deepEqual([afterMate.ok, afterMate.applied, afterMate.status], [false, 4, "checkmate"]);
  assert.equal(Rules.replay([], "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1").status, "stalemate");
  assert.equal(Rules.replay([], "7k/8/6K1/8/8/8/8/6B1 b - - 0 1").status, "material");
  assert.equal(Rules.replay(["a1a2"], "7k/8/6K1/8/8/8/8/R7 w - - 99 80").status, "fifty");

  const r = Rules.replay(["e2e4", "e7e5", "e1e3", "g1f3"]);
  assert.equal(r.ok, false);
  assert.equal(r.applied, 2, "stops at the first illegal move");
  assert.equal(r.turn, "w");
  assert.equal(r.keys.length, 3);
});

test("random: the same seed gives the same numbers, a different seed different ones", () => {
  const a = MokuRandom.create("bridge-7F3K"), b = MokuRandom.create("bridge-7F3K"), c = MokuRandom.create("bridge-7F3L");
  const seqA = Array.from({ length: 20 }, () => a.next());
  const seqB = Array.from({ length: 20 }, () => b.next());
  const seqC = Array.from({ length: 20 }, () => c.next());
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
  assert.ok(seqA.every((x) => x >= 0 && x < 1));
  assert.deepEqual(
    Array.from({ length: 5 }, () => MokuRandom.create(42).next()),
    Array.from({ length: 5 }, () => MokuRandom.create("42").next()),
    "numbers and their text are the same seed"
  );
  // Pinned values: changing the generator would split players on old and new pages.
  const pinned = MokuRandom.create("moku");
  assert.deepEqual([pinned.int(1, 6), pinned.int(1, 6), pinned.int(1, 6)], [3, 5, 5]);
});

test("random: helpers stay in range and are fair enough", () => {
  const rng = MokuRandom.create("helpers");
  const counts = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 6000; i++) {
    const v = rng.int(1, 6);
    assert.ok(v >= 1 && v <= 6);
    counts[v - 1]++;
  }
  assert.ok(counts.every((n) => n > 850 && n < 1150), counts.join(","));
  assert.equal(MokuRandom.create("x").int(3, 3), 3);
  const list = [1, 2, 3, 4, 5];
  const shuffled = rng.shuffle(list);
  assert.deepEqual(list, [1, 2, 3, 4, 5], "shuffle leaves the input alone");
  assert.deepEqual([...shuffled].sort(), [1, 2, 3, 4, 5]);
  assert.equal(rng.pick([]), undefined);
  assert.throws(() => MokuRandom.create(""));

  const base = MokuRandom.create("game"), base2 = MokuRandom.create("game");
  const f1 = base.fork("round-2").next(), f2 = base2.fork("round-2").next();
  assert.equal(f1, f2);
  assert.equal(base.next(), base2.next(), "fork doesn't move the parent stream");

  const s = MokuRandom.newSeed();
  assert.match(s, /^[A-HJKMNP-Z2-9]{8}$/);
});

// ---- shared/moku-ontology.js: The Hollow's meaning network ----
const Onto = require("../../shared/moku-ontology.js");

test("ontology: every game and edge points at real traits and spirits", () => {
  for (const [id, g] of Object.entries(Onto.GAMES)) {
    for (const t of Object.keys(g.traits)) assert.ok(Onto.TRAITS[t], `${id} → ${t}`);
  }
  for (const [id, t] of Object.entries(Onto.TRAITS)) {
    for (const s of Object.keys(t.spirits)) assert.ok(Onto.SPIRITS[s], `${id} → ${s}`);
    assert.ok(Onto.DECOR[id], `${id} has a decoration`);
  }
  for (const [a, b] of Onto.RELATED) assert.ok(Onto.TRAITS[a] && Onto.TRAITS[b], `${a} ~ ${b}`);
});

test("ontology: profiles from public cards", () => {
  const empty = Onto.profile(null);
  assert.equal(empty.empty, true);
  assert.equal(empty.spirit, "");
  const chess = Onto.profile({ records: { "moku-chess": 4 }, outfit: { mood: "mood-cookie-eyes" } }, { name: "Ren" });
  assert.equal(chess.spirit, "thinker");
  assert.equal(chess.top[0].id, "strategy");
  assert.ok(chess.traits.sweets > 0, "a secret Sweet Tooth from the Closet");
  const total = Object.values(chess.traits).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  // unknown games and odd values are ignored, not thrown on
  assert.equal(Onto.profile({ records: { "not-a-game": 5, "moku-drop": "x" }, highlights: [null, 3] }).empty, true);
});

test("ontology: finds what different games have in common, the same words every time", () => {
  const me = Onto.profile({ records: { "moku-chess": 5 } }, { name: "You" });
  const aoi = Onto.profile({ records: { "moku-fishing": 40 } }, { name: "Aoi" });
  const c = Onto.compare(me, aoi);
  assert.equal(c.sharedGames.length, 0);
  assert.ok(c.best, "Chess and Fishing still share something");
  assert.deepEqual(c.best.traits, ["patience", "patience"]);
  assert.ok(c.best.surprise > 0.5);
  assert.match(c.best.text, /Patient Souls|Patience/);
  assert.deepEqual(Onto.compare(me, aoi), c, "deterministic");
  // the same game: a match, but not a surprise
  const sora = Onto.profile({ records: { "moku-chess": 2 } }, { name: "Sora" });
  const same = Onto.compare(me, sora);
  assert.ok(same.score > c.score);
  assert.ok(same.links.some((l) => l.type === "same" && l.surprise === 0));
  assert.equal(Onto.compare(me, Onto.profile({})).best, null);
});

test("ontology: the room's mood and its slowly growing memory", () => {
  const green = Onto.profile({ records: { mokucity: 3, "moku-fishing": 9 } });
  const amb = Onto.ambience([green], null);
  assert.equal(amb.spirit, "green");
  assert.equal(amb.days, 0);
  assert.equal(amb.decor.length, 2, "a new room starts with two decorations");
  assert.equal(Onto.ambience([], null).spirit, "");

  let mem = Onto.remember(null, amb, "2026-10-30");
  assert.equal(mem.days, 1);
  assert.equal(Onto.remember(mem, amb, "2026-10-30"), mem, "once a day");
  for (let d = 1; d <= 8; d++) mem = Onto.remember(mem, amb, "2026-11-0" + d);
  assert.equal(mem.days, 9);
  assert.equal(Onto.ambience([green], mem).slots, 5, "more decorations the more days you visit");
  // a room that remembers Forest Friends stays a little green after a speed fan moves in
  const kart = Onto.profile({ records: { "moku-kart": 6 } });
  assert.ok(Onto.ambience([kart], mem).spirits.green > (Onto.ambience([kart], null).spirits.green || 0));
});
