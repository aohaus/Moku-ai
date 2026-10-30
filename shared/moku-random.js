/**
 * Moku Series — seeded random numbers (multiplayer plan: "same puzzle" play).
 *
 * The same seed gives the same numbers on every device and in Node / Lambda,
 * so two players can get the same bridge, the same falling fruit, the same
 * quiz order. Math.random() can't do that.
 *
 *   <script src="shared/moku-random.js"></script>   → window.MokuRandom
 *   const MokuRandom = require('./moku-random.js')  (Node / Lambda)
 *
 *   var rng = MokuRandom.create('bridge-7F3K');   // a string or a number
 *   rng.next();            // 0 <= x < 1   (drop-in for Math.random())
 *   rng.int(1, 6);         // 1..6, both ends included
 *   rng.pick(['a', 'b']);  // one item
 *   rng.shuffle(list);     // a shuffled copy (the list itself is not changed)
 *   rng.chance(0.3);       // true 30% of the time
 *   rng.fork('round-2');   // a second stream from the same seed (doesn't move this one)
 *   MokuRandom.newSeed();  // a fresh seed to share, e.g. 'K7Q2M9XD'
 *
 * Generator: mulberry32, seeded with a 32-bit hash of the seed text.
 * Good enough for games; not for anything secret.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MokuRandom = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 32-bit hash of the seed text (FNV-1a, then mixed). Numbers hash as their text,
  // so create(42) and create('42') are the same stream.
  function hashSeed(seed) {
    var text = String(seed), h = 2166136261;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= h >>> 16; h = Math.imul(h, 2246822507);
    h ^= h >>> 13; h = Math.imul(h, 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  }

  function create(seed) {
    if (seed === undefined || seed === null || seed === '') throw new Error('MokuRandom.create needs a seed');
    var seedText = String(seed);
    var state = hashSeed(seedText);

    function next() {
      state = (state + 0x6D2B79F5) >>> 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function int(min, max) {
      if (max === undefined) { max = min; min = 0; }
      return min + Math.floor(next() * (max - min + 1));
    }
    function pick(list) {
      return list.length ? list[Math.floor(next() * list.length)] : undefined;
    }
    function shuffle(list) {
      var a = Array.prototype.slice.call(list);
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(next() * (i + 1)), x = a[i];
        a[i] = a[j]; a[j] = x;
      }
      return a;
    }
    function chance(p) { return next() < p; }
    function fork(label) { return create(seedText + '/' + label); }

    return { seed: seedText, next: next, int: int, pick: pick, shuffle: shuffle, chance: chance, fork: fork };
  }

  // A seed to hand to other players: 8 letters/digits without look-alikes (0/O, 1/I/L).
  var SEED_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function newSeed(length) {
    var n = length || 8, out = '', bytes = null;
    var c = typeof crypto !== 'undefined' ? crypto : null;
    if (c && c.getRandomValues) {
      bytes = new Uint32Array(n);
      c.getRandomValues(bytes);
    }
    for (var i = 0; i < n; i++) {
      var r = bytes ? bytes[i] / 4294967296 : Math.random();
      out += SEED_CHARS.charAt(Math.floor(r * SEED_CHARS.length));
    }
    return out;
  }

  return { create: create, newSeed: newSeed, hashSeed: hashSeed };
});
