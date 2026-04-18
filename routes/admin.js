const express = require("express");
const crypto = require("crypto");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { 
    getUsers, addUser, updateUser, deleteUser,
    getDomains, addDomain, updateDomain, deleteDomain, 
    getCards, addCard, updateCard, deleteCard 
} = require("../services/configService");
const { listCreatedMailboxes, deleteCreatedMailbox } = require("../services/emailService");

const router = express.Router();

router.use(requireAuth, requireAdmin);

function parsePaging(req) {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
    return { page, limit };
}

function normalizeCard(value) {
    return String(value || "").trim();
}

router.get("/users", async (_req, res) => {
    try {
        const users = await getUsers();
        const safeUsers = users.map(({ password, ...rest }) => rest);
        return res.json(safeUsers);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post("/users", async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!username || !password || !role) {
            return res.status(400).json({ error: "username, password, role are required" });
        }

        const users = await getUsers();
        if (users.some((item) => item.username === username)) {
            return res.status(409).json({ error: "Username already exists" });
        }

        const user = {
            id: `u-${crypto.randomUUID()}`,
            username,
            password,
            role,
        };

        await addUser(user);

        const { password: _pw, ...safe } = user;
        return res.status(201).json(safe);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.patch("/users/:username", async (req, res) => {
    try {
        const users = await getUsers();
        const user = users.find((item) => item.username === req.params.username);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        await updateUser(req.params.username, {
            password: req.body.password,
            role: req.body.role
        });

        const updatedUser = { ...user, ...req.body };
        const { password, ...safe } = updatedUser;
        return res.json(safe);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.delete("/users/:username", async (req, res) => {
    try {
        await deleteUser(req.params.username);
        return res.json({ deleted: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get("/domains", async (_req, res) => {
    try {
        const domains = await getDomains();
        return res.json(domains);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post("/domains", async (req, res) => {
    try {
        const { name, tier, public: isPublic } = req.body;
        if (!name || !tier) {
            return res.status(400).json({ error: "name and tier are required" });
        }

        const domains = await getDomains();
        if (domains.some((item) => item.name === name)) {
            return res.status(409).json({ error: "Domain already exists" });
        }

        await addDomain(name, tier, isPublic);
        return res.status(201).json({ name, tier, public: !!isPublic });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.patch("/domains/:name", async (req, res) => {
    try {
        await updateDomain(req.params.name, req.body);
        return res.json({ name: req.params.name, ...req.body });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.delete("/domains/:name", async (req, res) => {
    try {
        await deleteDomain(req.params.name);
        return res.json({ deleted: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get("/mailboxes", async (req, res) => {
    try {
        const { page, limit } = parsePaging(req);
        const q = String(req.query.q || "").trim().toLowerCase();
        const result = await listCreatedMailboxes(page, limit, q);
        return res.json(result);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get("/mailboxes/export.txt", async (req, res) => {
    try {
        const q = String(req.query.q || "").trim().toLowerCase();
        const result = await listCreatedMailboxes(1, 100000, q);
        const now = new Date().toISOString();
        const lines = [
            `# Mailboxes export`,
            `# Generated at: ${now}`,
            `# Total: ${result.total}`,
            "",
            ...result.mailboxes.map((item) => item.email),
        ];

        const text = `${lines.join("\n")}\n`;
        const safeTimestamp = now.replace(/[:.]/g, "-");
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename=mailboxes-${safeTimestamp}.txt`);
        return res.status(200).send(text);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.delete("/mailboxes", async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        if (!email) {
            return res.status(400).json({ error: "email is required" });
        }

        const deleted = await deleteCreatedMailbox(email);
        if (!deleted) {
            return res.status(404).json({ error: "Mailbox not found" });
        }

        return res.json({ deleted: true, email });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get("/cards", async (req, res) => {
    try {
        const { page, limit } = parsePaging(req);
        const q = String(req.query.q || "").trim().toLowerCase();
        const entries = await getCards();

        const filtered = entries.filter((item) => {
            if (!q) return true;
            return String(item.cardnumber || "").toLowerCase().includes(q)
                || String(item.card_time || "").toLowerCase().includes(q);
        });

        const offset = (page - 1) * limit;
        const cards = filtered.slice(offset, offset + limit);

        return res.json({
            cards,
            page,
            limit,
            total: filtered.length,
            has_more: offset + limit < filtered.length,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post("/cards", async (req, res) => {
    try {
        const cardnumber = normalizeCard(req.body.cardnumber);
        const card_time = normalizeCard(req.body.card_time);

        if (!cardnumber || !card_time) {
            return res.status(400).json({ error: "cardnumber and card_time are required" });
        }

        const card = {
            cardnumber,
            card_time,
            created_at: new Date().toISOString(),
        };

        await addCard(card);
        return res.status(201).json(card);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get("/cards/export.txt", async (req, res) => {
    try {
        const q = String(req.query.q || "").trim().toLowerCase();
        const entries = await getCards();
        const filtered = entries.filter((item) => {
            if (!q) return true;
            return String(item.cardnumber || "").toLowerCase().includes(q)
                || String(item.card_time || "").toLowerCase().includes(q);
        });

        const now = new Date().toISOString();
        const lines = [
            `# Cards export`,
            `# Generated at: ${now}`,
            `# Total: ${filtered.length}`,
            "",
            ...filtered.map((item) => `${item.cardnumber}\t${item.card_time}`),
        ];

        const text = `${lines.join("\n")}\n`;
        const safeTimestamp = now.replace(/[:.]/g, "-");
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename=cards-${safeTimestamp}.txt`);
        return res.status(200).send(text);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.patch("/cards/:cardnumber", async (req, res) => {
    try {
        const currentCardnumber = normalizeCard(req.params.cardnumber);
        const nextCardnumber = normalizeCard(req.body.cardnumber || currentCardnumber);
        const nextCardTime = normalizeCard(req.body.card_time);

        if (!currentCardnumber) {
            return res.status(400).json({ error: "cardnumber is required" });
        }

        await updateCard(currentCardnumber, {
            cardnumber: nextCardnumber,
            card_time: nextCardTime
        });

        return res.json({ cardnumber: nextCardnumber, card_time: nextCardTime });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.delete("/cards/:cardnumber", async (req, res) => {
    try {
        await deleteCard(req.params.cardnumber);
        return res.json({ deleted: true, cardnumber: req.params.cardnumber });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

module.exports = router;
