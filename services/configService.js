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
        const stmt = await db.prepare("INSERT INTO domains (name, tier, public) VALUES (?, ?, ?)");
        for (const item of domains || []) {
            await stmt.run(String(item.name || "").toLowerCase(), item.tier || "basic", item.public ? 1 : 0);
        }
        await stmt.finalize();
    });
}

async function addDomain(name, tier, isPublic) {
    const db = await initSqlite();
    await db.run(
        "INSERT INTO domains (name, tier, public) VALUES (?, ?, ?)",
        [String(name).toLowerCase(), tier || "basic", isPublic ? 1 : 0]
    );
}

async function updateDomain(name, updates) {
    const db = await initSqlite();
    const sets = [];
    const params = [];
    if (updates.tier) {
        sets.push("tier = ?");
        params.push(updates.tier);
    }
    if (typeof updates.public === "boolean") {
        sets.push("public = ?");
        params.push(updates.public ? 1 : 0);
    }
    if (sets.length === 0) return;
    params.push(String(name).toLowerCase());
    await db.run(`UPDATE domains SET ${sets.join(", ")} WHERE name = ?`, params);
}

async function deleteDomain(name) {
    const db = await initSqlite();
    await db.run("DELETE FROM domains WHERE name = ?", [String(name).toLowerCase()]);
}

async function getUsers() {
    const db = await initSqlite();
    return db.all("SELECT id, username, password, role FROM users");
}

async function saveUsers(users) {
    await runInWriteTransaction(async (db) => {
        await db.run("DELETE FROM users");
        const stmt = await db.prepare("INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)");
        for (const item of users || []) {
            await stmt.run(item.id, item.username, item.password, item.role);
        }
        await stmt.finalize();
    });
}

async function addUser(user) {
    const db = await initSqlite();
    await db.run(
        "INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)",
        [user.id, user.username, user.password, user.role]
    );
}

async function updateUser(username, updates) {
    const db = await initSqlite();
    const sets = [];
    const params = [];
    if (updates.password) {
        sets.push("password = ?");
        params.push(updates.password);
    }
    if (updates.role) {
        sets.push("role = ?");
        params.push(updates.role);
    }
    if (sets.length === 0) return;
    params.push(username);
    await db.run(`UPDATE users SET ${sets.join(", ")} WHERE username = ?`, params);
}

async function deleteUser(username) {
    const db = await initSqlite();
    await db.run("DELETE FROM users WHERE username = ?", [username]);
}

async function getMailboxes() {
    const db = await initSqlite();
    return db.all("SELECT email, created_at, last_seen FROM mailboxes");
}

async function upsertMailbox(email, createdAt, lastSeen) {
    const db = await initSqlite();
    await db.run(
        `INSERT INTO mailboxes (email, created_at, last_seen) 
         VALUES (?, ?, ?) 
         ON CONFLICT(email) DO UPDATE SET last_seen = excluded.last_seen`,
        [String(email).toLowerCase(), createdAt, lastSeen]
    );
}

async function deleteMailbox(email) {
    const db = await initSqlite();
    await db.run("DELETE FROM mailboxes WHERE email = ?", [String(email).toLowerCase()]);
}

async function saveMailboxes(mailboxes) {
    await runInWriteTransaction(async (db) => {
        await db.run("DELETE FROM mailboxes");
        const stmt = await db.prepare("INSERT INTO mailboxes (email, created_at, last_seen) VALUES (?, ?, ?)");
        for (const item of mailboxes || []) {
            await stmt.run(String(item.email || "").toLowerCase(), item.created_at || null, item.last_seen || null);
        }
        await stmt.finalize();
    });
}

async function getCards() {
    const db = await initSqlite();
    return db.all("SELECT cardnumber, card_time, created_at FROM cards ORDER BY datetime(created_at) DESC");
}

async function addCard(card) {
    const db = await initSqlite();
    await db.run(
        "INSERT INTO cards (cardnumber, card_time, created_at) VALUES (?, ?, ?)",
        [String(card.cardnumber || ""), String(card.card_time || ""), card.created_at || new Date().toISOString()]
    );
}

async function updateCard(currentCardnumber, updates) {
    const db = await initSqlite();
    const sets = [];
    const params = [];
    if (updates.cardnumber) {
        sets.push("cardnumber = ?");
        params.push(updates.cardnumber);
    }
    if (updates.card_time) {
        sets.push("card_time = ?");
        params.push(updates.card_time);
    }
    if (sets.length === 0) return;
    params.push(currentCardnumber);
    await db.run(`UPDATE cards SET ${sets.join(", ")} WHERE cardnumber = ?`, params);
}

async function deleteCard(cardnumber) {
    const db = await initSqlite();
    await db.run("DELETE FROM cards WHERE cardnumber = ?", [cardnumber]);
}

async function saveCards(cards) {
    await runInWriteTransaction(async (db) => {
        await db.run("DELETE FROM cards");
        const stmt = await db.prepare("INSERT INTO cards (cardnumber, card_time, created_at) VALUES (?, ?, ?)");
        for (const item of cards || []) {
            await stmt.run(String(item.cardnumber || ""), String(item.card_time || ""), item.created_at || null);
        }
        await stmt.finalize();
    });
}

module.exports = {
    getDomains,
    saveDomains,
    addDomain,
    updateDomain,
    deleteDomain,
    getUsers,
    saveUsers,
    addUser,
    updateUser,
    deleteUser,
    getMailboxes,
    saveMailboxes,
    upsertMailbox,
    deleteMailbox,
    getCards,
    saveCards,
    addCard,
    updateCard,
    deleteCard,
};

