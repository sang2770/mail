const crypto = require("crypto");
const { getRedisClient } = require("../redis/redisClient");
const { extractOTP } = require("@onedaydevelopers/otp-detector");

const EMAIL_TTL_SECONDS = 24 * 60 * 60;

function emailKey(email) {
    return `email:${email.toLowerCase()}:messages`;
}

function messageIndexKey(messageId) {
    return `message:${messageId}:email`;
}

async function getMessages(email) {
    const redis = getRedisClient();
    const raw = await redis.get(emailKey(email));
    if (!raw) {
        return [];
    }
    return JSON.parse(raw);
}

async function saveMessages(email, messages) {
    const redis = getRedisClient();
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
    return buildEmail(username, domain);
}

async function saveIncomingEmail({ to, from, subject, text, html }) {
    const messageId = crypto.randomUUID();
    
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

    const redis = getRedisClient();
    await redis.setEx(messageIndexKey(messageId), EMAIL_TTL_SECONDS, to.toLowerCase());

    return message;
}

async function getInbox(email, page = 1, limit = 20) {
    const messages = await getMessages(email);
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

async function getEmailById(messageId) {
    const redis = getRedisClient();
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
    const redis = getRedisClient();
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
    buildEmail,
};
