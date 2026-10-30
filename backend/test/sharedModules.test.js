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
