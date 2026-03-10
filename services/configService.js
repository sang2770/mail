const fs = require("fs/promises");
const path = require("path");

const DOMAIN_FILE = path.join(__dirname, "..", "data", "domains.json");
const USER_FILE = path.join(__dirname, "..", "data", "users.json");

async function readJson(filePath) {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
}

async function writeJson(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

async function getDomains() {
    return readJson(DOMAIN_FILE);
}

async function saveDomains(domains) {
    return writeJson(DOMAIN_FILE, domains);
}

async function getUsers() {
    return readJson(USER_FILE);
}

async function saveUsers(users) {
    return writeJson(USER_FILE, users);
}

module.exports = {
    getDomains,
    saveDomains,
    getUsers,
    saveUsers,
};
