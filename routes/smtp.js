const { SMTPServer } = require("smtp-server");
const { simpleParser } = require("mailparser");
const { saveIncomingEmail } = require("../services/emailService");
const { getDomains } = require("../services/configService");
const { getIO } = require("../socket/socket");

function extractValidRecipients(recipients, allowedDomainSet) {
    const unique = new Set();

    for (const recipient of recipients || []) {
        const address = String(recipient?.address || "").toLowerCase();
        if (!address || !address.includes("@")) {
            continue;
        }

        const domain = address.split("@")[1];
        if (allowedDomainSet.has(domain)) {
            unique.add(address);
        }
    }

    return Array.from(unique);
}

async function startSmtpServer() {
    const smtpPort = Number(process.env.SMTP_PORT || 2525);
    const smtpHost = process.env.SMTP_HOST || "0.0.0.0";

    const server = new SMTPServer({
        disabledCommands: ["AUTH", "STARTTLS"],
        authOptional: true,
        logger: false,
        onRcptTo(address, session, callback) {
            callback(); // Chấp nhận tất cả địa chỉ người nhận, sẽ kiểm tra sau trong onData
        },
        onData(stream, session, callback) {
            simpleParser(stream)
                .then(async (parsed) => {
                    const domains = await getDomains();
                    const allowedDomainSet = new Set(domains.map((item) => String(item.name).toLowerCase()));

                    const recipients = extractValidRecipients(session.envelope?.rcptTo, allowedDomainSet);
                    if (!recipients.length) {
                        callback(new Error("550 No valid recipient domain"));
                        return;
                    }

                    const senderAddress =
                        parsed.from?.value?.[0]?.address ||
                        session.envelope?.mailFrom?.address ||
                        "unknown@sender.local";

                    const subject = parsed.subject || "(No subject)";
                    const textBody = parsed.text || "";
                    const htmlBody = parsed.html ? String(parsed.html) : "";

                    const io = getIO();

                    for (const recipient of recipients) {
                        const message = await saveIncomingEmail({
                            to: recipient,
                            from: senderAddress,
                            subject,
                            text: textBody,
                            html: htmlBody,
                        });

                        io.to(`inbox:${recipient}`).emit("new_email", {
                            id: message.id,
                            from: message.from,
                            subject: message.subject,
                            time: message.time,
                            otp: message.otp,
                        });

                        io.emit("new_email", {
                            to: recipient,
                            id: message.id,
                            from: message.from,
                            subject: message.subject,
                            time: message.time,
                            otp: message.otp,
                        });
                    }

                    callback();
                })
                .catch((error) => {
                    console.error("SMTP parse/save error:", error.message);
                    callback(error);
                });
        },
    });

    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(smtpPort, smtpHost, () => {
            server.removeListener("error", reject);
            resolve();
        });
    });

    console.log(`SMTP server listening on ${smtpHost}:${smtpPort}`);
    return server;
}

module.exports = {
    startSmtpServer,
};

