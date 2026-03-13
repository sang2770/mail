const express = require("express");
const crypto = require("crypto");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { getUsers, saveUsers, getDomains, saveDomains } = require("../services/configService");
const { listCreatedMailboxes, deleteCreatedMailbox } = require("../services/emailService");

const router = express.Router();

router.use(requireAuth, requireAdmin);

function parsePaging(req) {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
    return { page, limit };
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

        users.push(user);
        await saveUsers(users);

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

        if (req.body.role) user.role = req.body.role;
        if (req.body.password) user.password = req.body.password;

        await saveUsers(users);
        const { password, ...safe } = user;
        return res.json(safe);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.delete("/users/:username", async (req, res) => {
    try {
        const users = await getUsers();
        const filtered = users.filter((item) => item.username !== req.params.username);
        if (filtered.length === users.length) {
            return res.status(404).json({ error: "User not found" });
        }

        await saveUsers(filtered);
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

        const domain = {
            name: String(name).toLowerCase(),
            tier,
            public: Boolean(isPublic),
        };

        domains.push(domain);
        await saveDomains(domains);

        return res.status(201).json(domain);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.patch("/domains/:name", async (req, res) => {
    try {
        const domains = await getDomains();
        const domain = domains.find((item) => item.name === req.params.name);
        if (!domain) {
            return res.status(404).json({ error: "Domain not found" });
        }

        if (req.body.tier) domain.tier = req.body.tier;
        if (typeof req.body.public === "boolean") domain.public = req.body.public;

        await saveDomains(domains);
        return res.json(domain);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.delete("/domains/:name", async (req, res) => {
    try {
        const domains = await getDomains();
        const filtered = domains.filter((item) => item.name !== req.params.name);
        if (filtered.length === domains.length) {
            return res.status(404).json({ error: "Domain not found" });
        }

        await saveDomains(filtered);
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

module.exports = router;
