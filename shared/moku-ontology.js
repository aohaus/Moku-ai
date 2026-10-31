/**
 * Moku Series — a tiny "meaning network" for The Hollow (hollow.html).
 *
 * Turns what a player shows the world (their public card: the games they
 * hold records in, their highlights, what their Moku wears) into a few
 * human words: what kind of bird they are, what they share with a friend
 * who plays very different games, and how the Hollow they live in should
 * look and feel. No graph database, no network: one small hand-made graph
 * and a few loops. Works the same in the browser and in Node / Lambda.
 *
 *   <script src="shared/moku-ontology.js"></script>   → window.MokuOntology
 *   const MokuOntology = require('./moku-ontology.js')  (Node / Lambda / tests)
 *
 * The graph has three layers. Edges carry a weight 0..1.
 *
 *   things   games (moku-chess …) and Closet items (chef-hat, bg-japan …)
 *      │  "shows"  (GAME_TRAITS, ITEM_RULES)
 *   traits   Strategy, Patience, Speed, Sweets … (TRAITS)
 *      │  "is a kind of"  (TRAITS[t].spirits)
 *   spirits  six big families of birds: Brave Hearts, Quiet Thinkers,
 *            Forest Friends, Treasure Hunters, Party Birds, Cozy Cooks
 *
 *   plus "goes well with" edges between traits (RELATED), so Strategy and
 *   Puzzles are neighbors even when two players share no game at all.
 *
 *   var a = MokuOntology.profile(card, { name: 'Aoi', itemName: fn, itemPrice: fn });
 *   a.traits / a.spirits      → { id: share }, each adding up to 1
 *   a.top                     → strongest traits, e.g. [{ id: 'strategy', share: 0.31, sources: [...] }]
 *   a.spirit                  → strongest spirit id, or '' if we know nothing yet
 *   MokuOntology.compare(a, b) → { score 0..1, links: [...], best }  — best.text is ready to show
 *   MokuOntology.ambience(profiles, memory) → how the room looks (tone, moss, decor …)
 *   MokuOntology.remember(memory, ambience, 'YYYY-MM-DD') → the room's slowly growing memory
 *
 * A card is the same shape the server keeps (backend/API_SPEC.md, PUT /save):
 *   { level, outfit: { head, mood, face, neck, bg }, highlights: [{ title, value, game }], records: { gameId: n } }
 * `extra` (only for yourself, read from this device): { played: [gameId], owned: n, balance: n }.
 *
 * Everything here must stay deterministic (same input → same words), so the
 * same pair of friends always reads the same line on every device.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MokuOntology = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 1;

  // ---------- layer 3: spirits (the six bird families) ----------
  var SPIRITS = {
    brave:   { label: 'Brave Hearts',     emoji: '🔥', blurb: 'jump in first and never give up' },
    thinker: { label: 'Quiet Thinkers',   emoji: '🦉', blurb: 'think two moves ahead' },
    green:   { label: 'Forest Friends',   emoji: '🌿', blurb: 'love trees, water and slow days' },
    lucky:   { label: 'Treasure Hunters', emoji: '🍀', blurb: 'chase luck and shiny things' },
    cheer:   { label: 'Party Birds',      emoji: '🎉', blurb: 'make everyone laugh and sing' },
    cozy:    { label: 'Cozy Cooks',       emoji: '🍪', blurb: 'love snacks, style and a warm nest' }
  };
  var SPIRIT_IDS = Object.keys(SPIRITS);

  // ---------- layer 2: traits ----------
  // kin = what two birds who share it are called ("You're both Planners!")
  var TRAITS = {
    speed:     { label: 'Speed',      emoji: '⚡', kin: 'Speed Lovers',   spirits: { brave: 0.8, lucky: 0.2 } },
    action:    { label: 'Action',     emoji: '💥', kin: 'Action Fans',    spirits: { brave: 1 } },
    courage:   { label: 'Courage',    emoji: '🦁', kin: 'Brave Birds',    spirits: { brave: 0.8, lucky: 0.2 } },
    team:      { label: 'Teamwork',   emoji: '🤝', kin: 'Team Players',   spirits: { brave: 0.6, cheer: 0.4 } },
    strategy:  { label: 'Strategy',   emoji: '♟️', kin: 'Planners',       spirits: { thinker: 1 } },
    puzzle:    { label: 'Puzzles',    emoji: '🧩', kin: 'Puzzle Fans',    spirits: { thinker: 0.9, cozy: 0.1 } },
    patience:  { label: 'Patience',   emoji: '⏳', kin: 'Patient Souls',  spirits: { thinker: 0.5, green: 0.5 } },
    words:     { label: 'Words',      emoji: '💬', kin: 'Word Lovers',    spirits: { thinker: 0.4, cheer: 0.6 } },
    nature:    { label: 'Nature',     emoji: '🌳', kin: 'Nature Lovers',  spirits: { green: 1 } },
    builder:   { label: 'Building',   emoji: '🏡', kin: 'Builders',       spirits: { green: 0.7, thinker: 0.3 } },
    calm:      { label: 'Calm',       emoji: '🍃', kin: 'Calm Birds',     spirits: { green: 0.6, cozy: 0.4 } },
    luck:      { label: 'Luck',       emoji: '🍀', kin: 'Lucky Birds',    spirits: { lucky: 1 } },
    collector: { label: 'Collecting', emoji: '🎁', kin: 'Collectors',     spirits: { lucky: 0.7, cozy: 0.3 } },
    explorer:  { label: 'Exploring',  emoji: '🧭', kin: 'Explorers',      spirits: { lucky: 0.6, green: 0.4 } },
    travel:    { label: 'Travel',     emoji: '✈️', kin: 'Travelers',      spirits: { lucky: 0.5, cheer: 0.5 } },
    music:     { label: 'Music',      emoji: '🎵', kin: 'Music Fans',     spirits: { cheer: 1 } },
    party:     { label: 'Party',      emoji: '🎉', kin: 'Party Birds',    spirits: { cheer: 1 } },
    silly:     { label: 'Silly',      emoji: '🤪', kin: 'Sillies',        spirits: { cheer: 0.7, cozy: 0.3 } },
    food:      { label: 'Food',       emoji: '🍱', kin: 'Foodies',        spirits: { cozy: 1 } },
    sweets:    { label: 'Sweets',     emoji: '🍰', kin: 'Sweet Tooths',   spirits: { cozy: 1 } },
    style:     { label: 'Style',      emoji: '🎀', kin: 'Fashion Birds',  spirits: { cozy: 0.5, cheer: 0.5 } },
    royal:     { label: 'Champions',  emoji: '👑', kin: 'Champions',      spirits: { brave: 0.6, lucky: 0.4 } }
  };
  var TRAIT_IDS = Object.keys(TRAITS);

  // "goes well with": neighbors in meaning, even with no game in common
  var RELATED = [
    ['strategy', 'puzzle', 0.6], ['strategy', 'patience', 0.5], ['puzzle', 'patience', 0.4],
    ['patience', 'calm', 0.6], ['calm', 'nature', 0.5], ['nature', 'builder', 0.5], ['nature', 'explorer', 0.4],
    ['speed', 'action', 0.5], ['action', 'courage', 0.6], ['courage', 'luck', 0.4], ['team', 'party', 0.3],
    ['royal', 'courage', 0.4], ['music', 'party', 0.5], ['words', 'party', 0.4], ['silly', 'party', 0.5],
    ['food', 'sweets', 0.8], ['food', 'calm', 0.3], ['luck', 'collector', 0.6], ['explorer', 'travel', 0.7],
    ['style', 'royal', 0.3], ['style', 'travel', 0.3], ['collector', 'style', 0.3], ['words', 'strategy', 0.3]
  ];
  var NEIGHBORS = {};
  TRAIT_IDS.forEach(function (t) { NEIGHBORS[t] = {}; });
  RELATED.forEach(function (r) { NEIGHBORS[r[0]][r[1]] = r[2]; NEIGHBORS[r[1]][r[0]] = r[2]; });

  // ---------- layer 1 → 2: what each game shows about a player ----------
  var GAMES = {
    'angry-mokumoku':          { name: 'Angry Mokumoku',    traits: { action: 0.7, puzzle: 0.4 } },
    'angry-moku-battle-royal': { name: 'Battle Royal',      traits: { action: 0.6, team: 0.7 } },
    'mk-mobile':               { name: 'MK Mobile',         traits: { team: 0.6, speed: 0.5, action: 0.3 } },
    'moku-fight':              { name: 'Moku Fight',        traits: { action: 0.9, courage: 0.4, strategy: 0.3 } },
    'moku-kart':               { name: 'Moku Kart Dash',    traits: { speed: 1, collector: 0.3 } },
    'moku-future-run':         { name: 'Moku Future Run',   traits: { speed: 0.8, explorer: 0.5 } },
    'moyomoyo':                { name: 'Moyomoyo',          traits: { puzzle: 0.9, speed: 0.4 } },
    'moku-drop':               { name: 'Moku Drop',         traits: { puzzle: 0.7, patience: 0.6, luck: 0.2 } },
    'shiri-of-moku':           { name: 'Shiri of Moku',     traits: { words: 1, silly: 0.4 } },
    'mokucity':                { name: 'Moku City',         traits: { builder: 1, nature: 0.8 } },
    'moku-fishing':            { name: 'Moku Fishing Pond', traits: { calm: 0.9, nature: 0.6, patience: 0.6, collector: 0.3 } },
    'moku-rhythm':             { name: 'Moku Rhythm Cafe',  traits: { music: 1, speed: 0.3 } },
    'moku-bento':              { name: 'Moku Bento',        traits: { food: 1, speed: 0.5 } },
    'flying-moku':             { name: 'Flying Moku',       traits: { explorer: 1, nature: 0.5, collector: 0.3 } },
    'moku-wolf':               { name: 'Moku Wolf',         traits: { party: 1, words: 0.6 } },
    'moku-watch-6-lazy':       { name: 'Moku Watch 6 Lazy', traits: { silly: 1, calm: 0.4 } },
    'moku-rane':               { name: 'Moku-rane',         traits: { luck: 0.8, collector: 0.8 } },
    'moku-bridge':             { name: 'Moku Bridge',       traits: { luck: 1, courage: 0.6 } },
    'moku-chess':              { name: 'Moku Chess',        traits: { strategy: 1, patience: 0.6 } },
    'moku-word-riddles':       { name: 'Word Riddles',      traits: { words: 1, puzzle: 0.6 } },
    'moku-dropper':            { name: 'Moku Dropper',      traits: { courage: 0.8, speed: 0.6, explorer: 0.3 } },
    'mokuball':                { name: 'Mokuball',          traits: { action: 0.5, luck: 0.4 } }
  };

  // ---------- layer 1 → 2: what a Closet item says (matched on its id) ----------
  // Every rule that matches adds its traits, so 'mood-cookie-eyes' is both
  // Sweets and a bit Silly. Every worn item (not the background card) also
  // adds a little Style.
  var ITEM_RULES = [
    [/cake|ice-cream|chocolate|candy|senbei|cookie/, { sweets: 1 }],
    [/chef/, { food: 1 }],
    [/flower|sakura|sprout|clover|shell|sun-hat|lei/, { nature: 0.8 }],
    [/crown|tiara|medal|halo|show-off/, { royal: 0.9 }],
    [/pirate|diving|ski-goggles|cowboy|viking|propeller/, { explorer: 0.8 }],
    [/headphones/, { music: 1 }],
    [/grad-cap|monocle|smart-glasses|round-glasses|golden-rounds/, { strategy: 0.5, words: 0.4 }],
    [/googly|derp|dizzy|tongue|snoring|sweat|meh|3d-glasses|party-hat|bunny|propeller/, { silly: 0.8 }],
    [/moint-eyes|clover|gold/, { luck: 0.5, collector: 0.4 }],
    [/sleepy|snoring|meh|cozy-scarf|beanie/, { calm: 0.6 }],
    [/cool|shades|bow|beret|cat-eye|pearls|heart|tiara|rainbow/, { style: 0.6 }],
    [/^bg-/, { travel: 1 }]
  ];
  var ITEM_BASE_STYLE = 0.25;

  // ---------- helpers ----------
  function add(map, k, v) { if (v > 0 && TRAITS[k]) map[k] = (map[k] || 0) + v; }
  function sum(map) { var s = 0; for (var k in map) s += map[k]; return s; }
  function normalize(map) {
    var s = sum(map), out = {};
    if (s <= 0) return out;
    for (var k in map) out[k] = map[k] / s;
    return out;
  }
  function cosine(a, b) {
    var dot = 0, na = 0, nb = 0, k;
    for (k in a) { na += a[k] * a[k]; if (b[k]) dot += a[k] * b[k]; }
    for (k in b) nb += b[k] * b[k];
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }
  // Ties are broken by id, so the order never depends on the browser.
  function ranked(map) {
    return Object.keys(map).sort(function (x, y) { return map[y] - map[x] || (x < y ? -1 : x > y ? 1 : 0); });
  }
  function humanize(id) {
    return String(id).replace(/^(mood|bg)-/, '').replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  // A small, stable number from text (for picking one of several phrasings).
  function hash(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function list(names) {
    if (names.length <= 1) return names[0] || '';
    return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  }

  // ---------- profile: one player → traits + spirits ----------
  // Each trait remembers where it came from (sources), so the words can say
  // "Aoi shows it in Moku Chess, you in Moku Fishing Pond".
  function profile(card, opts) {
    card = card || {};
    opts = opts || {};
    var extra = opts.extra || {};
    var itemName = typeof opts.itemName === 'function' ? opts.itemName : null;
    var itemPrice = typeof opts.itemPrice === 'function' ? opts.itemPrice : null;
    var raw = {}, sources = {}, games = {};

    function credit(trait, amount, source) {
      if (!(amount > 0) || !TRAITS[trait]) return;
      add(raw, trait, amount);
      var s = sources[trait] || (sources[trait] = {});
      s[source.id] = s[source.id] || { id: source.id, kind: source.kind, name: source.name, weight: 0 };
      s[source.id].weight += amount;
    }
    function fromGame(gameId, weight) {
      var g = GAMES[gameId];
      if (!g || !(weight > 0)) return;
      games[gameId] = Math.max(games[gameId] || 0, weight);
    }

    // records: a record in a game is the strongest sign you love it.
    // Bigger records count a little more (log), but never drown the rest.
    var records = card.records && typeof card.records === 'object' ? card.records : {};
    Object.keys(records).forEach(function (id) {
      var v = Number(records[id]);
      if (v > 0) fromGame(id, 1 + Math.min(1, Math.log(1 + v) / 12));
    });
    (Array.isArray(card.highlights) ? card.highlights : []).forEach(function (h) {
      if (h && h.game) fromGame(h.game, 0.6);
    });
    (Array.isArray(extra.played) ? extra.played : []).forEach(function (id) { fromGame(id, 0.5); });
    Object.keys(games).sort().forEach(function (id) {
      var g = GAMES[id], w = games[id];
      Object.keys(g.traits).forEach(function (t) { credit(t, g.traits[t] * w, { id: id, kind: 'game', name: g.name }); });
    });

    // outfit: hidden sides of a player (a Chess fan with Cookie Eyes is a secret Sweet Tooth)
    var outfit = card.outfit && typeof card.outfit === 'object' ? card.outfit : {};
    var spent = 0, worn = 0;
    ['head', 'mood', 'face', 'neck', 'bg'].forEach(function (slot) {
      var id = outfit[slot];
      if (typeof id !== 'string' || !id) return;
      worn++;
      var src = { id: id, kind: 'item', name: (itemName && itemName(id)) || humanize(id) };
      if (slot !== 'bg') credit('style', ITEM_BASE_STYLE, src);
      ITEM_RULES.forEach(function (rule) {
        if (!rule[0].test(id)) return;
        Object.keys(rule[1]).forEach(function (t) { credit(t, rule[1][t] * 0.7, src); });
      });
      if (itemPrice) spent += Number(itemPrice(id)) || 0;
    });

    // Moint habits: a pricey outfit = loves Style; a big unspent wallet = a Collector
    var habit = '';
    if (spent >= 1200) { credit('style', 0.6, { id: 'moint-spender', kind: 'habit', name: 'a fancy outfit' }); habit = 'spender'; }
    if (Number(extra.balance) >= 1500) { credit('collector', 0.6, { id: 'moint-saver', kind: 'habit', name: 'a big Moint jar' }); habit = habit || 'saver'; }
    if (Number(extra.owned) >= 10) credit('style', 0.4, { id: 'closet', kind: 'habit', name: 'a full closet' });

    var traits = normalize(raw);
    var spiritRaw = {};
    Object.keys(traits).forEach(function (t) {
      var p = TRAITS[t].spirits;
      for (var s in p) spiritRaw[s] = (spiritRaw[s] || 0) + traits[t] * p[s];
    });
    var spirits = normalize(spiritRaw);
    var srcList = {};
    Object.keys(sources).forEach(function (t) {
      srcList[t] = Object.keys(sources[t]).map(function (k) { return sources[t][k]; })
        .sort(function (x, y) { return y.weight - x.weight || (x.id < y.id ? -1 : 1); });
    });
    var order = ranked(traits);
    return {
      name: opts.name || '',
      traits: traits,
      spirits: spirits,
      sources: srcList,
      games: Object.keys(games).sort(),
      worn: worn,
      habit: habit,
      level: Number(card.level) || 0,
      spirit: ranked(spirits)[0] || '',
      top: order.slice(0, 3).map(function (t) { return { id: t, share: traits[t], sources: srcList[t] }; }),
      empty: order.length === 0
    };
  }

  // One step of spreading along "goes well with": a player who loves
  // Strategy is a little bit about Puzzles and Patience too.
  function spread(traits) {
    var out = {};
    for (var t in traits) {
      out[t] = (out[t] || 0) + traits[t];
      var n = NEIGHBORS[t];
      for (var u in n) out[u] = (out[u] || 0) + traits[t] * n[u] * 0.5;
    }
    return out;
  }

  function sourceNames(p, trait, max) {
    return (p.sources[trait] || []).slice(0, max || 1).map(function (s) { return s.name; });
  }
  function sourceIds(p, trait) {
    return (p.sources[trait] || []).map(function (s) { return s.id; });
  }

  // ---------- compare: what two players share, the more surprising the better ----------
  // links (best first):
  //   same     — both show the same trait. surprise is high when it comes
  //              from different things (Chess vs Fishing, a game vs a hat)
  //   neighbor — different traits that go well together (Strategy ~ Puzzles)
  //   spirit   — the same bird family through different traits
  function compare(a, b) {
    var res = { score: 0, links: [], best: null, sharedGames: [] };
    if (!a || !b || a.empty || b.empty) return res;
    var sa = spread(a.traits), sb = spread(b.traits);
    res.score = Math.round((0.5 * cosine(sa, sb) + 0.5 * cosine(a.spirits, b.spirits)) * 100) / 100;
    res.sharedGames = a.games.filter(function (g) { return b.games.indexOf(g) >= 0; });

    TRAIT_IDS.forEach(function (t) {
      var x = a.traits[t] || 0, y = b.traits[t] || 0;
      if (x < 0.06 || y < 0.06) return;
      var ia = sourceIds(a, t), ib = sourceIds(b, t);
      var overlap = ia.filter(function (id) { return ib.indexOf(id) >= 0; }).length;
      var surprise = 1 - overlap / Math.max(1, Math.min(ia.length, ib.length));
      // an item (a secret side) on either side makes it more of a find
      var hidden = a.sources[t][0].kind !== 'game' || b.sources[t][0].kind !== 'game';
      if (hidden && surprise > 0) surprise = Math.min(1, surprise + 0.2);
      res.links.push({ type: 'same', traits: [t, t], strength: Math.min(x, y), surprise: surprise, hidden: hidden });
    });
    TRAIT_IDS.forEach(function (t) {
      var x = a.traits[t] || 0;
      if (x < 0.1 || (b.traits[t] || 0) >= 0.06) return;
      Object.keys(NEIGHBORS[t]).forEach(function (u) {
        var y = b.traits[u] || 0;
        if (y < 0.1 || (a.traits[u] || 0) >= 0.06) return;
        res.links.push({ type: 'neighbor', traits: [t, u], strength: Math.min(x, y) * NEIGHBORS[t][u], surprise: 0.9 });
      });
    });
    if (a.spirit && a.spirit === b.spirit) {
      var ta = a.top[0] && a.top[0].id, tb = b.top[0] && b.top[0].id;
      if (ta && tb && ta !== tb) res.links.push({ type: 'spirit', spirit: a.spirit, traits: [ta, tb], strength: Math.min(a.spirits[a.spirit], b.spirits[b.spirit]) * 0.6, surprise: 0.8 });
    }
    res.links.forEach(function (l) { l.rank = l.strength * (0.45 + l.surprise); });
    res.links.sort(function (x, y) { return y.rank - x.rank || (x.traits.join() < y.traits.join() ? -1 : 1); });
    res.links = res.links.slice(0, 4);
    res.links.forEach(function (l) { l.text = linkText(l, a, b); l.emoji = l.type === 'spirit' ? SPIRITS[l.spirit].emoji : TRAITS[l.traits[0]].emoji; });
    res.best = res.links[0] || null;
    return res;
  }

  // Plain, friendly English (SPEC.md §3). `a` is usually you.
  function who(p, fallback) { return p.name || fallback; }
  function poss(name) { return name === 'You' ? 'Your' : name + '\'s'; }
  function linkText(l, a, b) {
    var A = who(a, 'You'), B = who(b, 'your friend');
    var seed = hash(A + '|' + B + '|' + l.traits.join());
    if (l.type === 'same') {
      var t = TRAITS[l.traits[0]];
      var na = sourceNames(a, l.traits[0]), nb = sourceNames(b, l.traits[0]);
      if (l.surprise <= 0.2) {
        var ib = sourceIds(b, l.traits[0]);
        var shared = (a.sources[l.traits[0]] || []).filter(function (s) { return ib.indexOf(s.id) >= 0; })[0];
        return 'You\'re both ' + t.kin + ' ' + t.emoji + (shared ? ' — you share ' + shared.name + '.' : '!');
      }
      if (l.hidden) return 'Psst… ' + A + ' and ' + B + ' are secret ' + t.kin + ' ' + t.emoji + ' (' + na[0] + ' & ' + nb[0] + ')';
      var lines = [
        'Secret match: you\'re both ' + t.kin + '! ' + A + ' shows it in ' + na[0] + ', ' + B + ' in ' + nb[0] + '.',
        'Who knew? ' + A + ' (' + na[0] + ') and ' + B + ' (' + nb[0] + ') are both ' + t.kin + '.',
        'Different games, same heart: ' + t.emoji + ' ' + t.label + '. ' + na[0] + ' and ' + nb[0] + ' are closer than they look!'
      ];
      return lines[seed % lines.length];
    }
    if (l.type === 'neighbor') {
      var t1 = TRAITS[l.traits[0]], t2 = TRAITS[l.traits[1]];
      return t1.emoji + ' ' + t1.label + ' + ' + t2.emoji + ' ' + t2.label + ': ' + poss(A) + ' ' + (sourceNames(a, l.traits[0])[0] || t1.label) +
        ' and ' + poss(B) + ' ' + (sourceNames(b, l.traits[1])[0] || t2.label) + ' go well together. Try each other\'s favorite!';
    }
    var s = SPIRITS[l.spirit];
    return 'Two ' + s.label + ' ' + s.emoji + ' — ' + A + ' through ' + TRAITS[l.traits[0]].label + ', ' + B + ' through ' + TRAITS[l.traits[1]].label + '. You both ' + s.blurb + '.';
  }

  // One short line about a single player ("A Quiet Thinker who loves Strategy and Sweets").
  function describe(p) {
    if (!p || p.empty) return 'A brand-new bird. Play some games to grow!';
    var s = SPIRITS[p.spirit];
    var tops = p.top.slice(0, 2).map(function (x) { return TRAITS[x.id].label; });
    return 'One of the ' + s.label + ' ' + s.emoji + ' — loves ' + list(tops) + '.';
  }

  // ---------- ambience: the room grows from who lives in it ----------
  // profiles: the Mokus in the room (yours first; it counts double).
  // memory:   what the room remembered from earlier days (see remember()).
  var TONES = {
    brave:   { light: '255,176,104', wood: 1.06, warm: 1.1, label: 'Sunset Glow' },
    thinker: { light: '196,178,255', wood: 0.94, warm: 0.92, label: 'Twilight Study' },
    green:   { light: '196,236,140', wood: 1.0, warm: 1.0, label: 'Mossy Morning' },
    lucky:   { light: '255,222,120', wood: 1.04, warm: 1.06, label: 'Golden Hour' },
    cheer:   { light: '255,170,190', wood: 1.03, warm: 1.04, label: 'Pink Party Dusk' },
    cozy:    { light: '255,200,130', wood: 1.05, warm: 1.12, label: 'Honey Kitchen' }
  };
  // decor the room "picks up" for each strong trait (drawn by hollow.html)
  var DECOR = {
    speed: 'pennants', action: 'trophy', courage: 'trophy', team: 'pennants',
    strategy: 'chess', puzzle: 'blocks', patience: 'hourglass', words: 'letters',
    nature: 'ferns', builder: 'birdhouse', calm: 'fishing', luck: 'clover',
    collector: 'acorns', explorer: 'map', travel: 'map', music: 'notes',
    party: 'garland', silly: 'garland', food: 'bento', sweets: 'cookies',
    style: 'mirror', royal: 'trophy'
  };
  var MEMORY_KEEP = 0.8;   // each day the room keeps 80% of what it was and takes in 20% of today

  function ambience(profiles, memory) {
    profiles = (profiles || []).filter(function (p) { return p && !p.empty; });
    var traits = {}, spirits = {};
    profiles.forEach(function (p, i) {
      var w = i === 0 ? 2 : 1;
      for (var t in p.traits) traits[t] = (traits[t] || 0) + p.traits[t] * w;
      for (var s in p.spirits) spirits[s] = (spirits[s] || 0) + p.spirits[s] * w;
    });
    traits = normalize(traits);
    spirits = normalize(spirits);
    var days = memory && memory.days > 0 ? memory.days : 0;
    if (days) {
      // the longer the room has lived, the more its past shows through
      var keep = Math.min(0.6, 0.15 + days * 0.03);
      traits = blend(traits, memory.traits || {}, keep);
      spirits = blend(spirits, memory.spirits || {}, keep);
    }
    var order = ranked(spirits);
    var main = order[0] || 'green';
    var tone = TONES[main];
    // up to 5 decorations, one more every 3 days you visit (the room fills up over time)
    var slots = Math.min(5, 2 + Math.floor(days / 3));
    var decor = [];
    ranked(traits).forEach(function (t) {
      var d = DECOR[t];
      if (traits[t] >= 0.05 && d && decor.indexOf(d) < 0 && decor.length < slots) decor.push(d);
    });
    return {
      spirit: order.length ? main : '',
      second: order[1] || '',
      tone: tone.label,
      light: tone.light,
      warmth: tone.warm,
      wood: tone.wood,
      moss: Math.round(Math.min(1, 0.25 + (spirits.green || 0) * 1.6) * 100) / 100,
      sparkle: Math.round(Math.min(1, 0.2 + ((spirits.lucky || 0) + (spirits.cheer || 0)) * 1.2) * 100) / 100,
      decor: decor,
      slots: slots,
      days: days,
      traits: traits,
      spirits: spirits
    };
  }
  function blend(now, past, keep) {
    var out = {}, k;
    var hasNow = sum(now) > 0, hasPast = sum(past) > 0;
    if (!hasPast) return now;
    if (!hasNow) return normalize(past);
    for (k in now) out[k] = (out[k] || 0) + now[k] * (1 - keep);
    for (k in past) if (TRAITS[k] || SPIRITS[k]) out[k] = (out[k] || 0) + past[k] * keep;
    return normalize(out);
  }

  // The room's memory: called at most once a day. Small numbers are dropped
  // so the save stays tiny (it travels with the cloud save).
  function remember(memory, amb, day) {
    var m = memory && memory.version === VERSION ? memory : { version: VERSION, days: 0, traits: {}, spirits: {}, lastDay: '' };
    if (!amb || !day || m.lastDay === day || !amb.spirit) return m;
    function mix(past, now) {
      var out = {}, k;
      for (k in past) out[k] = past[k] * (m.days ? MEMORY_KEEP : 0);
      for (k in now) out[k] = (out[k] || 0) + now[k] * (m.days ? 1 - MEMORY_KEEP : 1);
      out = normalize(out);
      for (k in out) { if (out[k] < 0.02) delete out[k]; else out[k] = Math.round(out[k] * 1000) / 1000; }
      return out;
    }
    return {
      version: VERSION,
      days: Math.min(999, (m.days || 0) + 1),
      traits: mix(m.traits || {}, amb.traits),
      spirits: mix(m.spirits || {}, amb.spirits),
      lastDay: day,
      updatedAt: new Date().toISOString()
    };
  }

  return {
    VERSION: VERSION,
    SPIRITS: SPIRITS,
    TRAITS: TRAITS,
    RELATED: RELATED,
    GAMES: GAMES,
    DECOR: DECOR,
    profile: profile,
    compare: compare,
    describe: describe,
    ambience: ambience,
    remember: remember
  };
});
