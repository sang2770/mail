const { initSqlite, runInWriteTransaction } = require("./sqliteService");

function toBoolean(value) {
    return value === true || value === 1 || value === "1";
}

async function getDomains() {
    const db = await initSqlite();
    const rows = await db.all("SELECT name, tier, public FROM domains");
    return rows.map((item) => ({
        name: item.name,
        tier: item.tier,
        public: toBoolean(item.public),
    }));
}

async function saveDomains(domains) {
    await runInWriteTransaction(async (db) => {
        await db.run("DELETE FROM domains");

        for (const item of domains || []) {
            await db.run(
                "INSERT INTO domains (name, tier, public) VALUES (?, ?, ?)",
                [String(item.name || "").toLowerCase(), item.tier || "basic", item.public ? 1 : 0]
            );
        }
    });
}

async function getUsers() {
    const db = await initSqlite();
    return db.all("SELECT id, username, password, role FROM users");
}

async function saveUsers(users) {
    await runInWriteTransaction(async (db) => {
        await db.run("DELETE FROM users");

        for (const item of users || []) {
            await db.run(
                "INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)",
                [item.id, item.username, item.password, item.role]
            );
        }
    });
}

async function getMailboxes() {
    const db = await initSqlite();
    return db.all("SELECT email, created_at, last_seen FROM mailboxes");
}

async function saveMailboxes(mailboxes) {
    await runInWriteTransaction(async (db) => {
        await db.run("DELETE FROM mailboxes");

        for (const item of mailboxes || []) {
            await db.run(
                "INSERT INTO mailboxes (email, created_at, last_seen) VALUES (?, ?, ?)",
                [item.email, item.created_at || null, item.last_seen || null]
            );
        }
    });
}

module.exports = {
    getDomains,
    saveDomains,
    getUsers,
    saveUsers,
    getMailboxes,
    saveMailboxes,
};
