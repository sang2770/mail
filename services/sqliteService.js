const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, "..", "data", "app.db");

let dbPromise = null;

async function getDb() {
    if (!dbPromise) {
        dbPromise = open({
            filename: SQLITE_PATH,
            driver: sqlite3.Database,
        });
    }

    return dbPromise;
}

async function initSqlite() {
    const db = await getDb();

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS domains (
            name TEXT PRIMARY KEY,
            tier TEXT NOT NULL,
            public INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS mailboxes (
            email TEXT PRIMARY KEY,
            created_at TEXT,
            last_seen TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_domains_tier ON domains(tier);
        CREATE INDEX IF NOT EXISTS idx_mailboxes_last_seen ON mailboxes(last_seen);
    `);

    return db;
}

module.exports = {
    SQLITE_PATH,
    getDb,
    initSqlite,
};
