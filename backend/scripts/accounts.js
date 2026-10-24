#!/usr/bin/env node
// Admin CLI for Moku accounts (run by a parent, with AWS credentials set up).
//
//   node scripts/accounts.js list
//   node scripts/accounts.js reset-pin <loginId> <newPin>   forgot-PIN help; logs out all devices
//   node scripts/accounts.js unlock <loginId>               clear a too-many-tries lock
//   node scripts/accounts.js delete <loginId>               remove account + cloud save
//
// Table name defaults to "moku-accounts" (template.yaml); override with ACCOUNTS_TABLE_NAME.

process.env.ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME || "moku-accounts";
const store = require("../src/accountStore");
const { hashPin, isWeakPin } = require("../src/pin");

async function main() {
  const [cmd, rawId, arg] = process.argv.slice(2);
  const loginId = (rawId || "").trim().toLowerCase();
  const needUser = async () => {
    const user = loginId && (await store.getUser(loginId));
    if (!user) throw new Error(`no such account: ${rawId}`);
    return user;
  };

  switch (cmd) {
    case "list": {
      const users = await store.listUsers();
      users.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      for (const u of users) {
        const lock = u.lockedUntil > Date.now() ? `  LOCKED until ${new Date(u.lockedUntil).toISOString()}` : "";
        console.log(`${u.loginId.padEnd(16)} ${u.displayName.padEnd(12)} ${u.createdAt}${lock}`);
      }
      console.log(`${users.length} account(s)`);
      break;
    }
    case "reset-pin": {
      const user = await needUser();
      if (!/^\d{4,6}$/.test(arg || "") || isWeakPin(arg)) throw new Error("PIN must be 4–6 digits and not too easy");
      await store.updateUser(loginId, { pinHash: await hashPin(arg), tv: user.tv + 1, failCount: 0, lockedUntil: 0 });
      console.log(`PIN reset for ${loginId}. Other devices are logged out.`);
      break;
    }
    case "unlock":
      await needUser();
      await store.updateUser(loginId, { failCount: 0, lockedUntil: 0 });
      console.log(`Unlocked ${loginId}.`);
      break;
    case "delete":
      await needUser();
      await store.deleteUser(loginId);
      console.log(`Deleted ${loginId} and its cloud save.`);
      break;
    default:
      console.log("usage: node scripts/accounts.js list | reset-pin <id> <pin> | unlock <id> | delete <id>");
      process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exitCode = 1;
});
