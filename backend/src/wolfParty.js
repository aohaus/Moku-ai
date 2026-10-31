const Words = require("./vendor/moku-wolf-words");

// Moku Wolf Multiplayer (API_SPEC.md "Rooms" → Moku Wolf): 3–10 players, each
// on their own phone. It rides on the Riddle Race rooms (roomApi.js: code,
// invites, host starts, "again") with game "wolf".
//
// The server deals the words, so nobody's phone ever holds anyone else's word
// until the end. A game goes through stages:
//   check — everyone looks at their own word and taps "I remember!" (ready)
//   talk  — the same discussion timer on every phone (talkEndAt)
//   vote  — everyone taps who they think the WordMoku is (voteEndAt)
//   guess — a caught WordMoku picks the Citizens' word from 4 choices (guessEndAt)
//   done  — words, votes and the winner for everyone
// The host can skip ahead at any stage (someone left, or everyone is ready to
// vote early). Timed stages move on by themselves: advance() works it out on
// every read, the same way each time, so nothing has to run in the background.
//
// Players are keyed by uid in the room; only #u tags leave the server.

const RULES = {
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 10,
  MINUTES: [1, 2, 3, 5],   // discussion time the host can choose
  VOTE_MS: 60000,          // votes not in after a minute don't count
  GUESS_MS: 30000,         // a caught WordMoku that doesn't pick in time misses
  CHOICES: 4,              // the Citizens' word + 3 others from the same topic
};
const DEFAULTS = { topic: "food", wolves: 1, minutes: 3 };

const maxWolves = (players) => Math.max(1, Math.floor((players - 1) / 2));

// The lobby's settings, carried over to the next room by "again".
function newRoomFields(prev) {
  const s = prev && prev.settings ? prev.settings : DEFAULTS;
  return { wolf: null, settings: { topic: s.topic, wolves: s.wolves, minutes: s.minutes } };
}

const fail = (status, error, message) => ({ status, error, message });

// randInt(n) → 0..n-1
function shuffle(list, randInt) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// { topic, wolves, minutes } from the host → deal the words. Returns a failure, or null.
function start(room, body, t, randInt) {
  const n = room.players.length;
  const topic = body.topic === undefined ? DEFAULTS.topic : body.topic;
  const wolves = body.wolves === undefined ? DEFAULTS.wolves : body.wolves;
  const minutes = body.minutes === undefined ? DEFAULTS.minutes : body.minutes;
  if (!Words.TOPICS.includes(topic)) return fail(400, "invalid_topic", "Choose a topic.");
  if (!Number.isInteger(wolves) || wolves < 1 || wolves > maxWolves(n)) {
    return fail(400, "invalid_wolves", `With ${n} players you can have up to ${maxWolves(n)} WordMoku.`);
  }
  if (!RULES.MINUTES.includes(minutes)) return fail(400, "invalid_minutes", "Choose 1, 2, 3 or 5 minutes.");
  const pool = Words.pool(topic);
  const pair = pool[randInt(pool.length)];
  const uids = shuffle(room.players.map((p) => p.uid), randInt);
  room.status = "playing";
  room.settings = { topic, wolves, minutes };
  room.wolf = {
    stage: "check",
    topic,
    minutes,
    pair: { w1: pair.w1, j1: pair.j1, e1: pair.e1, w2: pair.w2, j2: pair.j2, e2: pair.e2 },
    citizen: randInt(2) + 1,          // which word of the pair the Citizens get (1 or 2)
    wolfUids: uids.slice(0, wolves),
    ready: [],
    talkEndAt: null,
    votes: {},                        // voter uid → suspect uid
    voteEndAt: null,
    caught: null,
    tie: false,
    choices: null,                    // [{ w, j, e }] for a caught WordMoku
    answer: null,                     // index of the Citizens' word in choices
    pick: null,
    guessEndAt: null,
    winner: null,                     // "citizens" | "wolf"
    startedAt: t,
  };
  return null;
}

const word = (w, side) => ({ w: w.pair["w" + side], j: w.pair["j" + side], e: w.pair["e" + side] });
const citizenWord = (w) => word(w, w.citizen);
const wolfWord = (w) => word(w, 3 - w.citizen);

function toTalk(room, t) {
  room.wolf.stage = "talk";
  room.wolf.talkEndAt = t + room.wolf.minutes * 60000;
}
function toVote(room, t) {
  room.wolf.stage = "vote";
  room.wolf.voteEndAt = t + RULES.VOTE_MS;
}
function finish(room, winner, t) {
  room.wolf.stage = "done";
  room.wolf.winner = winner;
  room.status = "done";
  room.endedAt = t;
}

// Count the votes. One player with the most votes is caught; a tie (or no
// votes at all) catches nobody, and the WordMoku slips away.
function tally(room, t, randInt) {
  const w = room.wolf;
  const count = {};
  Object.values(w.votes).forEach((uid) => { count[uid] = (count[uid] || 0) + 1; });
  const top = Math.max(0, ...Object.values(count));
  const most = Object.keys(count).filter((uid) => count[uid] === top);
  if (most.length !== 1) {
    w.tie = true;
    finish(room, "wolf", t);
    return;
  }
  w.caught = most[0];
  if (!w.wolfUids.includes(w.caught)) {
    finish(room, "wolf", t);
    return;
  }
  // Caught! The WordMoku can still steal the win by picking the Citizens' word.
  const right = citizenWord(w);
  const others = shuffle(
    Words.pool(w.topic).flatMap((p) => [{ w: p.w1, j: p.j1, e: p.e1 }, { w: p.w2, j: p.j2, e: p.e2 }])
      .filter((x) => x.w !== w.pair.w1 && x.w !== w.pair.w2),
    randInt
  ).slice(0, RULES.CHOICES - 1);
  w.choices = shuffle(others.concat([right]), randInt);
  w.answer = w.choices.findIndex((x) => x.w === right.w);
  w.stage = "guess";
  w.guessEndAt = t + RULES.GUESS_MS;
}

function guessed(room, pick, t) {
  const w = room.wolf;
  w.pick = pick;
  finish(room, pick === w.answer ? "wolf" : "citizens", t);
}

// Moves timed stages along. Returns true when it changed the room (so the caller saves it).
function advance(room, t, randInt) {
  const w = room.wolf;
  if (room.status !== "playing" || !w) return false;
  let changed = false;
  for (;;) {
    if (w.stage === "talk" && t >= w.talkEndAt) toVote(room, w.talkEndAt);
    else if (w.stage === "vote" && t >= w.voteEndAt) tally(room, w.voteEndAt, randInt);
    else if (w.stage === "guess" && t >= w.guessEndAt) guessed(room, null, w.guessEndAt);
    else return changed;
    changed = true;
  }
}

// { do: "ready" } | { do: "vote", tag } | { do: "guess", pick } | { do: "skip" } (host).
// Returns a failure, or null when the room changed (or nothing needed to).
function act(room, uid, body, t, randInt) {
  const w = room.wolf;
  if (room.status !== "playing" || !w) return fail(409, "not_playing", "This game isn't on right now.");
  const everyone = room.players.map((p) => p.uid);
  switch (body.do) {
    case "ready":
      if (w.stage !== "check") return null;
      if (!w.ready.includes(uid)) w.ready.push(uid);
      if (everyone.every((u) => w.ready.includes(u))) toTalk(room, t);
      return null;
    case "vote": {
      if (w.stage !== "vote") return fail(409, "not_voting", "It isn't time to vote.");
      const target = room.players.find((p) => p.tag === body.tag);
      if (!target || target.uid === uid) return fail(400, "invalid_vote", "Choose another player.");
      w.votes[uid] = target.uid;
      if (everyone.every((u) => w.votes[u])) tally(room, t, randInt);
      return null;
    }
    case "guess":
      if (w.stage !== "guess" || w.caught !== uid) return fail(409, "not_guessing", "It isn't your turn to guess.");
      if (!Number.isInteger(body.pick) || body.pick < 0 || body.pick >= w.choices.length) return fail(400, "invalid_pick", "Choose a word.");
      guessed(room, body.pick, t);
      return null;
    case "skip":
      if (room.host !== uid) return fail(403, "not_host", "Only the host can do that.");
      if (w.stage === "check") toTalk(room, t);
      else if (w.stage === "talk") toVote(room, t);
      else if (w.stage === "vote") tally(room, t, randInt);
      else if (w.stage === "guess") guessed(room, null, t);
      return null;
    default:
      return fail(400, "invalid_action", "That doesn't work here.");
  }
}

// The Moku Wolf part of what one player sees. Your own word only; everyone's at the end.
function view(room, uid, tagByUid) {
  const w = room.wolf;
  const tag = (u) => tagByUid[u] || null;
  if (!w) return { rules: RULES, settings: room.settings || DEFAULTS, wolf: null };
  const done = w.stage === "done";
  const inGame = room.players.some((p) => p.uid === uid);
  const yours = !inGame ? null : w.wolfUids.includes(uid) ? wolfWord(w) : citizenWord(w);
  return {
    rules: RULES,
    settings: room.settings,
    wolf: {
      stage: w.stage,
      topic: w.topic,
      minutes: w.minutes,
      wolves: w.wolfUids.length,
      you: yours,
      ready: w.ready.map(tag),
      talkEndAt: w.talkEndAt,
      voteEndAt: w.voteEndAt,
      voted: Object.keys(w.votes).map(tag),
      myVote: w.votes[uid] ? tag(w.votes[uid]) : null,
      caught: w.caught ? tag(w.caught) : null,
      tie: w.tie,
      guessEndAt: w.guessEndAt,
      choices: (w.stage === "guess" && w.caught === uid) || (done && w.choices) ? w.choices : null,
      result: done
        ? {
          winner: w.winner,
          citizenWord: citizenWord(w),
          wolfWord: wolfWord(w),
          wolves: w.wolfUids.map(tag),
          votes: Object.keys(w.votes).map((u) => ({ from: tag(u), to: tag(w.votes[u]) })),
          pick: w.pick,
          answer: w.answer,
        }
        : null,
    },
  };
}

module.exports = { RULES, DEFAULTS, maxWolves, newRoomFields, start, advance, act, view };
