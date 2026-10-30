// In-memory stand-in for accountStore.js, used by the server.js dev mock
// (backend/dev/mount.js) and tests. Same interface and error codes.

function codedError(code) {
  const e = new Error(code);
  e.code = code;
  return e;
}

function createMemoryStore() {
  const users = new Map();
  const saves = new Map();
  const logs = [];
  const errors = new Map();
  const matches = new Map();
  const challenges = new Map();
  const playerChallenges = new Map(); // uid -> Map(challengeId -> row)
  const playerMatches = new Map(); // uid -> Map(matchId -> row)

  function putChalRows(rows) {
    for (const { uid, ...row } of rows) {
      if (!playerChallenges.has(uid)) playerChallenges.set(uid, new Map());
      playerChallenges.get(uid).set(row.challengeId, JSON.parse(JSON.stringify(row)));
    }
  }
  function putRows(rows) {
    for (const { uid, ...row } of rows) {
      if (!playerMatches.has(uid)) playerMatches.set(uid, new Map());
      playerMatches.get(uid).set(row.matchId, { ...row });
    }
  }

  return {
    async getUser(loginId) {
      const u = users.get(loginId);
      return u ? { ...u } : null;
    },
    async createUser(user, maxUsers, { uncounted = false } = {}) {
      if (users.has(user.loginId)) throw codedError("id_taken");
      const counted = [...users.values()].filter((u) => !u.uncounted).length;
      if (!uncounted && counted >= maxUsers) throw codedError("full");
      users.set(user.loginId, { ...user, ...(uncounted ? { uncounted: true } : {}) });
    },
    async updateUser(loginId, fields) {
      const u = users.get(loginId);
      if (!u) throw new Error("no such user");
      users.set(loginId, { ...u, ...fields });
    },
    async listUsers() {
      return [...users.values()].map(({ pinHash, ...u }) => ({ ...u }));
    },
    async getSave(loginId) {
      const s = saves.get(loginId);
      return s ? { ...s } : null;
    },
    async putSave(loginId, record, baseRev) {
      const current = saves.get(loginId);
      if ((current ? current.rev : 0) !== baseRev) throw codedError("conflict");
      saves.set(loginId, { ...record });
    },
    async addLog(entry) {
      logs.push({ ...entry });
    },
    async listLogs(day) {
      return logs.filter((l) => l.at.startsWith(day)).reverse().map((l) => ({ ...l }));
    },
    async recordError(sig, report, loginId) {
      const e = errors.get(sig) || { count: 0, status: "new", firstAt: report.at, users: [] };
      const { at, device, userAgent, version, ...rest } = report;
      Object.assign(e, rest, { lastAt: at, lastDevice: device, lastUserAgent: userAgent, lastVersion: version });
      e.count += 1;
      if (loginId && !e.users.includes(loginId)) e.users.push(loginId);
      errors.set(sig, e);
    },
    async listErrors() {
      return [...errors.entries()].map(([sig, e]) => ({ sig, ...e, users: [...e.users] }));
    },
    async updateError(sig, fields) {
      if (!errors.has(sig)) throw codedError("not_found");
      Object.assign(errors.get(sig), fields);
    },
    async deleteError(sig) {
      errors.delete(sig);
    },
    async listSaves() {
      return [...saves.entries()].map(([loginId, { rev, updatedAt, device }]) => ({ loginId, rev, updatedAt, device }));
    },
    async deleteUser(loginId) {
      if (!users.has(loginId)) throw codedError("not_found");
      users.delete(loginId);
      saves.delete(loginId);
    },
    async createMatch(match, rows) {
      if (matches.has(match.id)) throw codedError("conflict");
      matches.set(match.id, JSON.parse(JSON.stringify(match)));
      putRows(rows);
    },
    async getMatch(id) {
      const m = matches.get(id);
      return m ? JSON.parse(JSON.stringify(m)) : null;
    },
    async saveMatch(match, baseVersion, rows) {
      const current = matches.get(match.id);
      if (!current || current.version !== baseVersion) throw codedError("conflict");
      matches.set(match.id, JSON.parse(JSON.stringify(match)));
      putRows(rows);
    },
    async listPlayerMatches(uid) {
      return [...(playerMatches.get(uid) || new Map()).values()].map((row) => ({ uid, ...JSON.parse(JSON.stringify(row)) }));
    },
    async createChallenge(ch, rows) {
      if (challenges.has(ch.id)) throw codedError("conflict");
      challenges.set(ch.id, JSON.parse(JSON.stringify(ch)));
      putChalRows(rows);
    },
    async getChallenge(id) {
      const c = challenges.get(id);
      return c ? JSON.parse(JSON.stringify(c)) : null;
    },
    async saveChallenge(ch, baseVersion, rows) {
      const current = challenges.get(ch.id);
      if (!current || current.version !== baseVersion) throw codedError("conflict");
      challenges.set(ch.id, JSON.parse(JSON.stringify(ch)));
      putChalRows(rows);
    },
    async listPlayerChallenges(uid) {
      return [...(playerChallenges.get(uid) || new Map()).values()].map((row) => ({ uid, ...JSON.parse(JSON.stringify(row)) }));
    },
    async renameUser(oldId, newId, fields) {
      const u = users.get(oldId);
      if (!u) throw codedError("not_found");
      if (users.has(newId)) throw codedError("id_taken");
      users.delete(oldId);
      users.set(newId, { ...u, ...fields, loginId: newId });
      if (saves.has(oldId)) {
        saves.set(newId, saves.get(oldId));
        saves.delete(oldId);
      }
    },
  };
}

module.exports = { createMemoryStore };
