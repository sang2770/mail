const express = require("express");
const { getCards, saveCards } = require("../services/configService");

const router = express.Router();

function parsePaging(req) {
	const page = Math.max(1, Number(req.query.page || 1));
	const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
	return { page, limit };
}

function normalizeCard(value) {
	return String(value || "").trim();
}

function parseBulkRaw(raw) {
	const lines = String(raw || "")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#"));

	return lines.map((line) => {
		let parts = line.split(/\s*[\t,|;]\s*/);
		if (parts.length < 2) {
			parts = line.split(/\s+/);
		}

		return {
			cardnumber: parts[0] || "",
			card_time: parts.slice(1).join(" ") || "",
		};
	});
}

function toCardInputList(body) {
	if (Array.isArray(body)) {
		return body;
	}

	if (Array.isArray(body.cards)) {
		return body.cards;
	}

	if (body && (body.cardnumber || body.card_time)) {
		return [body];
	}

	if (body && typeof body.raw === "string") {
		return parseBulkRaw(body.raw);
	}

	return [];
}

router.get("/cards", async (req, res) => {
	try {
		const { page, limit } = parsePaging(req);
		const q = String(req.query.q || "").trim().toLowerCase();
		const entries = await getCards();

		const filtered = entries.filter((item) => {
			if (!q) return true;
			return String(item.cardnumber || "").toLowerCase().includes(q)
				|| String(item.card_time || "").toLowerCase().includes(q);
		});

		const offset = (page - 1) * limit;
		const cards = filtered.slice(offset, offset + limit).map((item) => ({
			cardnumber: item.cardnumber,
			card_time: item.card_time,
			created_at: item.created_at,
		}));

		return res.json({
			cards,
			page,
			limit,
			total: filtered.length,
			has_more: offset + limit < filtered.length,
		});
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});

router.post("/cards", async (req, res) => {
	try {
		const inputs = toCardInputList(req.body || {});
		if (!inputs.length) {
			return res.status(400).json({
				error: "Provide card data via { cardnumber, card_time }, { cards: [] }, array body, or { raw }",
			});
		}

		const existingCards = await getCards();
		const existingSet = new Set(existingCards.map((item) => item.cardnumber));
		const payloadSet = new Set();

		const created = [];
		const invalid = [];
		const duplicates = [];

		inputs.forEach((item, index) => {
			const cardnumber = normalizeCard(item && item.cardnumber);
			const card_time = normalizeCard(item && item.card_time);

			if (!cardnumber || !card_time) {
				invalid.push({ index, cardnumber, card_time, reason: "cardnumber and card_time are required" });
				return;
			}

			if (existingSet.has(cardnumber) || payloadSet.has(cardnumber)) {
				duplicates.push({ index, cardnumber, reason: "Card already exists" });
				return;
			}

			payloadSet.add(cardnumber);
			created.push({
				cardnumber,
				card_time,
				created_at: new Date().toISOString(),
			});
		});

		if (!created.length) {
			const statusCode = duplicates.length ? 409 : 400;
			return res.status(statusCode).json({
				created: 0,
				total: inputs.length,
				invalid,
				duplicates,
			});
		}

		await saveCards([...created, ...existingCards]);

		if (inputs.length === 1 && created.length === 1 && !invalid.length && !duplicates.length) {
			return res.status(201).json(created[0]);
		}

		return res.status(201).json({
			created: created.length,
			total: inputs.length,
			invalid,
			duplicates,
			cards: created,
		});
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});

module.exports = router;
