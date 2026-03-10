const jwt = require("jsonwebtoken");

function parseBearerToken(req) {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
        return null;
    }
    return authHeader.replace("Bearer ", "").trim();
}

function optionalAuth(req, _res, next) {
    const token = parseBearerToken(req);
    if (!token) {
        req.user = { role: "guest" };
        return next();
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || "change-me-in-production");
        req.user = payload;
    } catch (_error) {
        req.user = { role: "guest" };
    }

    return next();
}

function requireAuth(req, res, next) {
    const token = parseBearerToken(req);
    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || "change-me-in-production");
        req.user = payload;
        return next();
    } catch (_error) {
        return res.status(401).json({ error: "Invalid token" });
    }
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Admin only" });
    }
    return next();
}

module.exports = {
    optionalAuth,
    requireAuth,
    requireAdmin,
};
