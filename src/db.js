const { mkdirSync } = require("fs");
const path = require("path");
//built-in SQLite (Node >= 22.13), the PLAN.md §1 fallback: better-sqlite3 13 ships
//prebuilt binaries, but `npm ci` in node:26-bookworm-slim still runs `node-gyp rebuild`
//for it and fails without python/make/g++. node:sqlite needs no native addon.
const { DatabaseSync } = require("node:sqlite");

//load .env (if present) so standalone users of this module, e.g.
//scripts/import-localstorage.js or a `node -e` check, see DATA_DIR and CHAT_ID
//like the bot does. Variables already set in the environment win.
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

//storage lives in ${DATA_DIR}/jisao.db (./data next to src by default, /data in the container)
const dataDir = path.resolve(
  process.env.DATA_DIR || path.resolve(__dirname, "../data")
);
mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "jisao.db");

const db = new DatabaseSync(dbPath);
//wait up to 5 s for another connection's write lock (e.g. the import script running
//against the live bot) instead of failing at once with "database is locked".
//node:sqlite defaults to 0; better-sqlite3 defaults to 5000.
db.exec("PRAGMA busy_timeout = 5000");
db.exec("PRAGMA journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    data    TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kv (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

const stmtGetUser = db.prepare("SELECT data FROM users WHERE user_id = ?");
const stmtPutUser = db.prepare(`
  INSERT INTO users (user_id, data, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
`);
const stmtGetKV = db.prepare("SELECT value FROM kv WHERE key = ?");
const stmtPutKV = db.prepare(`
  INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

//user ids are sometimes numbers, sometimes strings: always key by string
function getUserRow(userID) {
  const row = stmtGetUser.get(String(userID));
  return row ? JSON.parse(row.data) : null;
}

function putUserRow(user) {
  if (!user || user.userID === undefined || user.userID === null) {
    throw new Error(`putUserRow: user without userID: ${JSON.stringify(user)}`);
  }
  stmtPutUser.run(String(user.userID), JSON.stringify(user), Date.now());
}

function getKV(key) {
  const row = stmtGetKV.get(String(key));
  return row ? JSON.parse(row.value) : null;
}

function putKV(key, value) {
  stmtPutKV.run(String(key), JSON.stringify(value), Date.now());
}

module.exports = {
  getUserRow,
  putUserRow,
  getKV,
  putKV,
  dbPath,
};
