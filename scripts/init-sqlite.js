const { initSqlite, SQLITE_PATH } = require("../services/sqliteService");

initSqlite()
    .then(() => {
        console.log(`SQLite initialized at: ${SQLITE_PATH}`);
    })
    .catch((error) => {
        console.error("SQLite init failed:", error.message);
        process.exit(1);
    });
