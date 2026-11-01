// Settings the parent can change on the admin page (admin.html「⚙️ 設定」,
// GET/PUT /admin/settings), instead of numbers written into the code.
//
// Each setting is declared once in SCHEMA with its default and limits. The
// table keeps only the values the admin changed (pk "CONFIG", sk "SETTINGS"),
// so a new setting starts at its default without any data migration, and
// "back to default" just drops the stored value.
//
// To add one: add an entry to SCHEMA, then read it where it is used with
// `(await settings.get())["<key>"]`. The admin page draws its form from
// SCHEMA, so it needs no change. Labels and help are Japanese (the admin page
// is for the parent, SPEC.md §12).

const SCHEMA = [
  {
    key: "rooms.inviteExpiryMinutes",
    group: "マルチプレイ",
    label: "招待の有効時間",
    help: "部屋(Riddle Race / Moyomoyo / Moku Wolf の Multiplayer)を作ってから、この時間までにだれも入らなければ部屋を閉じます。招待とルームコードも使えなくなります。",
    type: "int",
    unit: "分",
    default: 60,
    min: 5,
    max: 1440,
  },
];

const BY_KEY = new Map(SCHEMA.map((s) => [s.key, s]));

function defaults() {
  const out = {};
  for (const s of SCHEMA) out[s.key] = s.default;
  return out;
}

function valid(s, v) {
  return s.type === "int" && Number.isInteger(v) && v >= s.min && v <= s.max;
}

// Stored overrides on top of the defaults. A stored value that no longer
// fits (a setting removed, or its limits narrowed) falls back to the default.
function resolve(stored) {
  const values = defaults();
  const overrides = (stored && stored.values) || {};
  for (const [key, v] of Object.entries(overrides)) {
    const s = BY_KEY.get(key);
    if (s && valid(s, v)) values[key] = v;
  }
  return values;
}

// { values: { key: number | null } } from the admin page. null = back to the
// default. Returns { overrides, changes } or { error: { key, message } }.
function applyPatch(stored, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return { error: { key: null, message: "values is required." } };
  const before = resolve(stored);
  const overrides = { ...((stored && stored.values) || {}) };
  for (const [key, v] of Object.entries(patch)) {
    const s = BY_KEY.get(key);
    if (!s) return { error: { key, message: `Unknown setting: ${key}` } };
    if (v === null || v === s.default) {
      delete overrides[key];
    } else if (!valid(s, v)) {
      return { error: { key, message: `${s.label}: ${s.min}〜${s.max}${s.unit || ""}の整数` } };
    } else {
      overrides[key] = v;
    }
  }
  // Drop leftovers of settings that no longer exist.
  for (const key of Object.keys(overrides)) if (!BY_KEY.has(key)) delete overrides[key];
  const after = resolve({ values: overrides });
  const changes = SCHEMA.filter((s) => before[s.key] !== after[s.key]).map((s) => ({ key: s.key, from: before[s.key], to: after[s.key] }));
  return { overrides, changes };
}

// What the admin page draws: every setting with its value and default.
function view(stored) {
  const values = resolve(stored);
  return {
    settings: SCHEMA.map((s) => ({ ...s, value: values[s.key], isDefault: values[s.key] === s.default })),
    updatedAt: (stored && stored.updatedAt) || null,
    updatedBy: (stored && stored.updatedBy) || null,
  };
}

// The values for the game APIs. Read through a short cache, so a busy room
// doesn't read the table on every poll; an admin change shows up within
// `cacheMs`. If the read fails, the defaults (or the last good values) are used.
function createSettings(store, { now = () => Date.now(), cacheMs = 60 * 1000 } = {}) {
  let cached = null;
  let at = 0;
  return {
    async get() {
      if (cached && now() - at < cacheMs) return cached;
      try {
        cached = resolve(await store.getSettings());
      } catch (e) {
        console.error(e);
        cached = cached || defaults();
      }
      at = now();
      return cached;
    },
  };
}

module.exports = { SCHEMA, defaults, resolve, applyPatch, view, createSettings };
