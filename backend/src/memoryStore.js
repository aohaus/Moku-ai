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

  return {
    async getUser(loginId) {
      const u = users.get(loginId);
      return u ? { ...u } : null;
    },
    async createUser(user, maxUsers) {
      if (users.has(user.loginId)) throw codedError("id_taken");
      if (users.size >= maxUsers) throw codedError("full");
      users.set(user.loginId, { ...user });
    },
    async updateUser(loginId, fields) {
      const u = users.get(loginId);
      if (!u) throw new Error("no such user");
      users.set(loginId, { ...u, ...fields });
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
  };
}

module.exports = { createMemoryStore };
