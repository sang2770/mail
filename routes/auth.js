const express = require("express");
const jwt = require("jsonwebtoken");
const { getUsers } = require("../services/configService");

const router = express.Router();

router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: "username and password are required" });
        }

        const users = await getUsers();
        const user = users.find((item) => item.username === username && item.password === password);

        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET || "change-me-in-production",
            { expiresIn: "7d" }
        );

        return res.json({ token, role: user.role });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

module.exports = router;
