const express = require("express");
const { saveIncomingEmail } = require("../services/emailService");
const { getIO } = require("../socket/socket");

const router = express.Router();

router.post("/webhook/mail", async (req, res) => {
    try {
        const to = String(req.body.to || "").toLowerCase();
        if (!to || !to.includes("@")) {
            return res.status(400).json({ error: "Invalid recipient" });
        }

        const payload = {
            to,
            from: req.body.from,
            subject: req.body.subject,
            text: req.body.text || req.body.body || "",
            html: req.body.html || "",
        };

        const message = await saveIncomingEmail(payload);

        const io = getIO();
        io.to(`inbox:${to}`).emit("new_email", {
            id: message.id,
            from: message.from,
            subject: message.subject,
            time: message.time,
        });
        io.emit("new_email", {
            to,
            id: message.id,
            from: message.from,
            subject: message.subject,
            time: message.time,
        });

        return res.json({ status: "ok", id: message.id });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

module.exports = router;
