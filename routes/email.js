const express = require("express");
const { optionalAuth } = require("../middleware/auth");
const { getDomains } = require("../services/configService");
const { getAllowedTiers } = require("../services/permissionService");
const {
    generateRandomEmail,
    getInbox,
    getEmailById,
    getEmailByMailbox,
    deleteEmailByMailbox,
    buildEmail,
} = require("../services/emailService");

const router = express.Router();

function parsePaging(req) {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
    return { page, limit };
}

async function getAllowedDomainsByRole(role) {
    const domains = await getDomains();
    const allowedTiers = getAllowedTiers(role);
    return domains.filter((item) => allowedTiers.includes(item.tier));
}

router.get("/new-email", optionalAuth, async (req, res) => {
    try {
        const role = req.user?.role || "guest";
        const allowedDomains = await getAllowedDomainsByRole(role);
        const email = await generateRandomEmail(allowedDomains);
        return res.json({ email });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

router.get("/inbox/:email", optionalAuth, async (req, res) => {
    try {
        const { page, limit } = parsePaging(req);
        const inbox = await getInbox(String(req.params.email).toLowerCase(), page, limit);

        return res.json(
            inbox.headers.map((item) => ({
                id: item.id,
                from: item.from,
                subject: item.subject,
                time: item.time,
            }))
        );
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get("/email/:id", async (req, res) => {
    try {
        const email = await getEmailById(req.params.id);
        if (!email) {
            return res.status(404).json({ error: "Email not found" });
        }

        return res.json({
            from: email.from,
            subject: email.subject,
            body: email.body,
            html_body: email.html_body,
            time: email.time,
            id: email.id,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get("/email/:domain/:user/", async (req, res) => {
    try {
        const { page, limit } = parsePaging(req);
        const mailbox = buildEmail(req.params.user, req.params.domain);
        const inbox = await getInbox(mailbox, page, limit);

        return res.json({
            emails: inbox.emails,
            page: inbox.page,
            limit: inbox.limit,
            total: inbox.total,
            has_more: inbox.has_more,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get("/email/:domain/:user/:id", async (req, res) => {
    try {
        const email = await getEmailByMailbox(req.params.domain, req.params.user, req.params.id);
        if (!email) {
            return res.status(404).json({ error: "Email not found" });
        }
        return res.json(email);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.delete("/email/:domain/:user/:id", async (req, res) => {
    try {
        const deleted = await deleteEmailByMailbox(req.params.domain, req.params.user, req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: "Email not found" });
        }
        return res.json({ deleted: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

module.exports = router;
