const express = require("express");
const { optionalAuth } = require("../middleware/auth");
const { getDomains, saveDomains } = require("../services/configService");
const { getAllowedTiers } = require("../services/permissionService");

const router = express.Router();

router.get("/domains", optionalAuth, async (req, res) => {
    try {
        const role = req.user?.role || "guest";
        const domains = await getDomains();
        const allowedTiers = getAllowedTiers(role);

        const filtered = domains.filter((item) => allowedTiers.includes(item.tier));
        return res.json({
            role,
            domains: filtered.map((item) => item.name),
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get("/random-domains", optionalAuth, async (req, res) => {
    try {
        const role = req.user?.role || "guest";
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);

        const domains = await getDomains();
        const allowedTiers = getAllowedTiers(role);
        const filtered = domains
            .filter((item) => allowedTiers.includes(item.tier) && item.public !== false)
            .map((item) => item.name);

        const offset = (page - 1) * limit;
        return res.json({
            domains: filtered.slice(offset, offset + limit),
            page,
            limit,
            total: filtered.length,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get("/check-mx/:domain", async (req, res) => {
    try {
        const domains = await getDomains();
        const found = domains.some((item) => item.name === req.params.domain);
        return res.json({
            domain: req.params.domain,
            result: found ? "online" : "offline",
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post("/add-domain/:domain", async (req, res) => {
    try {
        const domainName = String(req.params.domain || "").toLowerCase();
        if (!domainName) {
            return res.status(400).json({ detail: "Domain is required" });
        }

        const showOnHomepage = req.query.show_on_homepage === "true";
        const domains = await getDomains();
        const existing = domains.find((item) => item.name === domainName);

        if (existing) {
            existing.public = showOnHomepage;
            await saveDomains(domains);
            return res.json({
                status: "updated",
                domain: existing.name,
                tier: existing.tier,
                show_on_homepage: existing.public,
                is_online: true,
            });
        }

        const created = {
            name: domainName,
            tier: "basic",
            public: showOnHomepage,
        };
        domains.push(created);
        await saveDomains(domains);

        return res.json({
            status: "added",
            domain: created.name,
            tier: created.tier,
            show_on_homepage: created.public,
            is_online: true,
        });
    } catch (error) {
        return res.status(500).json({ detail: error.message });
    }
});

module.exports = router;
