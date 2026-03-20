const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, "..", "data", "app.db");

let dbPromise = null;
let writeQueue = Promise.resolve();

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

function runInWriteTransaction(operation) {
    const task = writeQueue.then(async () => {
        const db = await initSqlite();
        await db.exec("BEGIN IMMEDIATE TRANSACTION");

        try {
            const result = await operation(db);
            await db.exec("COMMIT");
            return result;
        } catch (error) {
            try {
                await db.exec("ROLLBACK");
            } catch (_rollbackError) {
                // Ignore rollback errors and surface original error
            }
            throw error;
        }
    });

    writeQueue = task.catch(() => undefined);
    return task;
}

module.exports = {
    SQLITE_PATH,
    getDb,
    initSqlite,
    runInWriteTransaction,
};
