const express = require("express");

const router = express.Router();

router.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "temp-mail-backend" });
});

router.get("/banners", (_req, res) => {
    res.json([]);
});

router.post("/banners/:id/click", (_req, res) => {
    res.json({ tracked: true, id: _req.params.id });
});

module.exports = router;
