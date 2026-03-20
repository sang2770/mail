const fs = require("fs/promises");
const path = require("path");
const { initSqlite, SQLITE_PATH } = require("../services/sqliteService");

const DATA_DIR = path.join(__dirname, "..", "data");

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

async function run() {
    const usersPath = path.join(DATA_DIR, "users.json");
    const domainsPath = path.join(DATA_DIR, "domains.json");
    const mailboxesPath = path.join(DATA_DIR, "mailboxes.json");

    const [users, domains, mailboxes] = await Promise.all([
        readJsonArray(usersPath, []),
        readJsonArray(domainsPath, []),
        readJsonArray(mailboxesPath, []),
    ]);

    const db = await initSqlite();
    await db.exec("BEGIN IMMEDIATE TRANSACTION");

    try {
        await db.run("DELETE FROM users");
        await db.run("DELETE FROM domains");
        await db.run("DELETE FROM mailboxes");

        for (const item of users) {
            await db.run(
                "INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)",
                [item.id, item.username, item.password, item.role]
            );
        }

        for (const item of domains) {
            await db.run(
                "INSERT INTO domains (name, tier, public) VALUES (?, ?, ?)",
                [String(item.name || "").toLowerCase(), item.tier || "basic", item.public ? 1 : 0]
            );
        }

        for (const item of mailboxes) {
            await db.run(
                "INSERT INTO mailboxes (email, created_at, last_seen) VALUES (?, ?, ?)",
                [String(item.email || "").toLowerCase(), item.created_at || null, item.last_seen || null]
            );
        }

        await db.exec("COMMIT");
    } catch (error) {
        await db.exec("ROLLBACK");
        throw error;
    }

    console.log(`SQLite migration completed.`);
    console.log(`Database: ${SQLITE_PATH}`);
    console.log(`Users: ${users.length}`);
    console.log(`Domains: ${domains.length}`);
    console.log(`Mailboxes: ${mailboxes.length}`);
}

run().catch((error) => {
    console.error("Migration failed:", error.message);
    process.exit(1);
});
