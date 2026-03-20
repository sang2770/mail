require("dotenv").config();

const http = require("http");
const path = require("path");
const express = require("express");
const cors = require("cors");

const { connectRedis } = require("./redis/redisClient");
const { initSocket } = require("./socket/socket");
const { initSqlite } = require("./services/sqliteService");

const authRoutes = require("./routes/auth");
const domainRoutes = require("./routes/domain");
const emailRoutes = require("./routes/email");
const webhookRoutes = require("./routes/webhook");
const adminRoutes = require("./routes/admin");
const systemRoutes = require("./routes/system");
const { startSmtpServer } = require("./routes/smtp");

async function bootstrap() {
    const app = express();
    const server = http.createServer(app);

    app.use(cors());
    app.use(express.json({ limit: "2mb" }));
    app.use(express.urlencoded({ extended: true }));

    app.use("/api", authRoutes);
    app.use("/api", domainRoutes);
    app.use("/api", emailRoutes);
    app.use("/api", webhookRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api", systemRoutes);

    const publicDir = path.join(__dirname, "public");
    app.use(express.static(publicDir));
    app.get("/", (_req, res) => {
        res.sendFile(path.join(publicDir, "index.html"));
    });

    await initSqlite();
    await connectRedis();
    initSocket(server);
    await startSmtpServer();

    const port = Number(process.env.PORT || 3000);
    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

bootstrap().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});
