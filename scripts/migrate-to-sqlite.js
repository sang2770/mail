// migrate-to-sqlite.js
const fs = require("fs/promises");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const DATA_DIR = path.join(__dirname, "..", "data");
const SQLITE_PATH = path.join(DATA_DIR, "app.db");

// --------------------
// Utils
// --------------------
async function readJsonArray(filePath, fallback = []) {
    try {
        const content = await fs.readFile(filePath, "utf-8");
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? parsed : fallback;
    } catch (error) {
        if (error && error.code === "ENOENT") {
            return fallback;
        }
        throw error;
    }
}

// --------------------
// Init SQLite
// --------------------
async function initSqlite() {
    const db = await open({
        filename: SQLITE_PATH,
        driver: sqlite3.Database,
    });

    // Bật WAL mode và kiểm tra
    const walResult = await db.get("PRAGMA journal_mode=WAL;");
    console.log("SQLite journal_mode:", walResult.journal_mode);

    // Bật synchronous
    await db.exec("PRAGMA synchronous=NORMAL;");

    return db;
}

// --------------------
// Batch insert helper
// --------------------
async function batchInsert(db, table, columns, rows, batchSize = 500) {
    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const placeholders = columns.map(() => "?").join(",");
        const stmt = await db.prepare(
            `INSERT INTO ${table} (${columns.join(",")}) VALUES (${placeholders})`
        );
        for (const row of batch) {
            await stmt.run(...row);
        }
        await stmt.finalize();
    }
}

// --------------------
// Main migration
// --------------------
async function run() {
    console.log("Starting SQLite migration...");

    const usersPath = path.join(DATA_DIR, "users.json");
    const domainsPath = path.join(DATA_DIR, "domains.json");
    const mailboxesPath = path.join(DATA_DIR, "mailboxes.json");

    const [users, domains, mailboxes] = await Promise.all([
        readJsonArray(usersPath, []),
        readJsonArray(domainsPath, []),
        readJsonArray(mailboxesPath, []),
    ]);

    console.log(`Loaded JSON: ${users.length} users, ${domains.length} domains, ${mailboxes.length} mailboxes`);

    const db = await initSqlite();

    await db.exec("BEGIN TRANSACTION");
    try {
        // Xoá dữ liệu cũ
        await db.run("DELETE FROM users");
        await db.run("DELETE FROM domains");
        await db.run("DELETE FROM mailboxes");

        // Insert users
        await batchInsert(
            db,
            "users",
            ["id", "username", "password", "role"],
            users.map(u => [u.id, u.username, u.password, u.role])
        );

        // Insert domains
        await batchInsert(
            db,
            "domains",
            ["name", "tier", "public"],
            domains.map(d => [String(d.name || "").toLowerCase(), d.tier || "basic", d.public ? 1 : 0])
        );

        // Insert mailboxes
        await batchInsert(
            db,
            "mailboxes",
            ["email", "created_at", "last_seen"],
            mailboxes.map(m => [String(m.email || "").toLowerCase(), m.created_at || null, m.last_seen || null])
        );

        await db.exec("COMMIT");
        console.log("SQLite migration completed successfully!");

        // Force checkpoint để dữ liệu từ WAL vào file chính
        await db.exec("PRAGMA wal_checkpoint(FULL);");
        console.log("Checkpoint completed, app.db updated.");

        console.log(`Database path: ${SQLITE_PATH}`);
        console.log(`Users inserted: ${users.length}`);
        console.log(`Domains inserted: ${domains.length}`);
        console.log(`Mailboxes inserted: ${mailboxes.length}`);
    } catch (error) {
        await db.exec("ROLLBACK");
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

run().catch(error => {
    console.error("Unexpected error:", error);
    process.exit(1);
});