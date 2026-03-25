const crypto = require("crypto");
const { getRedisClient } = require("../redis/redisClient");
const { extractOTP } = require("@onedaydevelopers/otp-detector");
const { getMailboxes, saveMailboxes } = require("./configService");

const EMAIL_TTL_SECONDS = 24 * 60 * 60;

function emailKey(email) {
    return `email:${email.toLowerCase()}:messages`;
}

function messageIndexKey(messageId) {
    return `message:${messageId}:email`;
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

async function getMailboxRegistry() {
    const entries = await getMailboxes();
    return Array.isArray(entries) ? entries : [];
}

async function saveMailboxRegistry(entries) {
    await saveMailboxes(entries);
}

async function registerMailbox(email) {
    const mailbox = normalizeEmail(email);
    if (!mailbox || !mailbox.includes("@")) {
        return;
    }

    const now = new Date().toISOString();
    const entries = await getMailboxRegistry();
    const existing = entries.find((item) => item.email === mailbox);

    if (existing) {
        existing.last_seen = now;
    } else {
        entries.unshift({ email: mailbox, created_at: now, last_seen: now });
    }

    await saveMailboxRegistry(entries);
}

async function getMessages(email) {
    const redis = await getRedisClient();
    const raw = await redis.get(emailKey(email));
    if (!raw) {
        return [];
    }
    return JSON.parse(raw);
}

async function saveMessages(email, messages) {
    const redis = await getRedisClient();
    await redis.setEx(emailKey(email), EMAIL_TTL_SECONDS, JSON.stringify(messages));
}

function randomUsername() {
    return crypto.randomBytes(5).toString("hex");
}

function buildEmail(username, domain) {
    return `${username}@${domain}`.toLowerCase();
}

async function generateRandomEmail(allowedDomains) {
    if (!allowedDomains.length) {
        throw new Error("No domain available for current role");
    }

    const domain = allowedDomains[Math.floor(Math.random() * allowedDomains.length)].name;
    const username = randomUsername();
    const email = buildEmail(username, domain);
    await registerMailbox(email);
    return email;
}

async function saveIncomingEmail({ to, from, subject, text, html }) {
    const messageId = crypto.randomUUID();
    await registerMailbox(to);
    
    // Detect OTP codes from email content
    const textToAnalyze = text || "";
    const htmlToAnalyze = html ? html.replace(/<[^>]*>/g, " ") : ""; // Strip HTML tags
    const combinedText = `${textToAnalyze} ${htmlToAnalyze}`;
    
    let otpCode = null;
    try {
        otpCode = extractOTP(combinedText);
        // If no OTP is detected, the function returns null
    } catch (error) {
        console.log("Error detecting OTP:", error.message);
    }
    
    const message = {
        id: messageId,
        from: from || "unknown@sender.local",
        sender: from || "unknown@sender.local",
        subject: subject || "(No subject)",
        body: text || "",
        html_body: html || "",
        time: new Date().toISOString(),
        date: new Date().toISOString(),
        otp: otpCode, // Add OTP code to message object
    };

    const messages = await getMessages(to);
    messages.unshift(message);
    await saveMessages(to, messages);

    const redis = await getRedisClient();
    await redis.setEx(messageIndexKey(messageId), EMAIL_TTL_SECONDS, to.toLowerCase());

    return message;
}

async function getInbox(email, page = 1, limit = 20) {
    await registerMailbox(email);
    const mailbox = normalizeEmail(email);
    const messages = await getMessages(mailbox);
    const offset = (page - 1) * limit;
    const paginated = messages.slice(offset, offset + limit);

    return {
        page,
        limit,
        total: messages.length,
        has_more: offset + limit < messages.length,
        emails: paginated,
        headers: paginated.map((item) => ({
            id: item.id,
            from: item.from,
            sender: item.sender,
            subject: item.subject,
            time: item.time,
            date: item.date,
            otp: item.otp,
        })),
    };
}

async function listCreatedMailboxes(page = 1, limit = 20, query = "") {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    const entries = await getMailboxRegistry();

    const filtered = entries
        .filter((item) => item && item.email)
        .filter((item) => !normalizedQuery || item.email.includes(normalizedQuery))
        .sort((a, b) => new Date(b.last_seen || b.created_at || 0) - new Date(a.last_seen || a.created_at || 0));

    const offset = (page - 1) * limit;
    const selected = filtered.slice(offset, offset + limit);

    const mailboxes = await Promise.all(
        selected.map(async (item) => {
            const messages = await getMessages(item.email);
            return {
                email: item.email,
                created_at: item.created_at || null,
                last_seen: item.last_seen || item.created_at || null,
                message_count: messages.length,
            };
        })
    );

    return {
        mailboxes,
        page,
        limit,
        total: filtered.length,
        has_more: offset + limit < filtered.length,
    };
}

async function deleteCreatedMailbox(email) {
    const mailbox = normalizeEmail(email);
    if (!mailbox) {
        return false;
    }

    const entries = await getMailboxRegistry();
    const nextEntries = entries.filter((item) => item.email !== mailbox);
    if (nextEntries.length === entries.length) {
        return false;
    }

    const messages = await getMessages(mailbox);
    const redis = await getRedisClient();

    await Promise.all(messages.map((item) => redis.del(messageIndexKey(item.id))));
    await redis.del(emailKey(mailbox));
    await saveMailboxRegistry(nextEntries);

    return true;
}

async function getEmailById(messageId) {
    const redis = await getRedisClient();
    const email = await redis.get(messageIndexKey(messageId));
    if (!email) {
        return null;
    }

    const messages = await getMessages(email);
    return messages.find((item) => item.id === messageId) || null;
}

async function getEmailByMailbox(domain, user, messageId) {
    const email = buildEmail(user, domain);
    const messages = await getMessages(email);
    return messages.find((item) => item.id === messageId) || null;
}

async function deleteEmailByMailbox(domain, user, messageId) {
    const email = buildEmail(user, domain);
    const messages = await getMessages(email);
    const before = messages.length;
    const filtered = messages.filter((item) => item.id !== messageId);

    if (filtered.length === before) {
        return false;
    }

    await saveMessages(email, filtered);
    const redis = await getRedisClient();
    await redis.del(messageIndexKey(messageId));

    return true;
}

module.exports = {
    generateRandomEmail,
    getInbox,
    saveIncomingEmail,
    getEmailById,
    getEmailByMailbox,
    deleteEmailByMailbox,
    listCreatedMailboxes,
    deleteCreatedMailbox,
    buildEmail,
};
