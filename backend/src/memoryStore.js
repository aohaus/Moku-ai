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
    async listSaves() {
      return [...saves.entries()].map(([loginId, { rev, updatedAt, device }]) => ({ loginId, rev, updatedAt, device }));
    },
    async deleteUser(loginId) {
      if (!users.has(loginId)) throw codedError("not_found");
      users.delete(loginId);
      saves.delete(loginId);
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
