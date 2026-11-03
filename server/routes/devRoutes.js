import crypto from "node:crypto";
import axios from "axios";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

const BASE_URL = (
	process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 4000}`
).replace(/\/+$/, "");

// Create a simple signing session (sandbox)
router.post("/esign/signing_sessions", (req, res) => {
	const { contractId } = req.body || {};
	const sessionId = crypto.randomUUID();
	const signing_url = `${BASE_URL}/api/dev/esign/embedded?contractId=${encodeURIComponent(contractId)}&sessionId=${sessionId}`;
	return res.json({ signing_url, session_id: sessionId });
});

// Embedded signing simulator page
router.get("/esign/embedded", (req, res) => {
	const contractId = req.query.contractId || "";
	const sessionId = req.query.sessionId || "";
	res.set("Content-Type", "text/html");
	res.send(
		`<!doctype html><html><head><meta charset="utf-8"><title>ESign Sandbox</title></head><body><h2>ESign Sandbox</h2><p>Contract: ${contractId}</p><p>Session: ${sessionId}</p><button id="buyer">Sign as Buyer</button> <button id="factory">Sign as Factory</button><script>async function post(role){ const resp = await fetch('/api/dev/esign/simulate_callback?contractId=${encodeURIComponent(contractId)}&role='+role,{method:'POST'}); const json=await resp.json(); alert(JSON.stringify(json)); }document.getElementById('buyer').onclick=()=>post('buyer');document.getElementById('factory').onclick=()=>post('factory');</script></body></html>`,
	);
});

// Simulate provider webhook callback: posts to the real webhook endpoint with HMAC header
router.post("/esign/simulate_callback", async (req, res) => {
	try {
		const contractId = String(req.query.contractId || req.body?.contractId || "");
		const role = String(req.query.role || req.body?.role || "buyer").toLowerCase();
		if (!contractId) {
			return res.status(400).json({ error: "contractId required" });
		}

		const payload = role === "factory" ? { factory_signed: true } : { buyer_signed: true };
		const payloadString = JSON.stringify(payload);

		const secret = String(process.env.ESIGN_WEBHOOK_SECRET || "");
		const headers = { "Content-Type": "application/json" };
		if (secret) {
			const timestamp = Math.floor(Date.now() / 1000);
			const signedPayload = `${timestamp}.${payloadString}`;
			const sig = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
			headers["x-esign-signature"] = `t=${timestamp},v1=${sig}`;
		}

		const target = `${BASE_URL}/api/documents/contracts/${encodeURIComponent(contractId)}/sign-callback`;
		const response = await axios.post(target, payloadString, {
			headers,
			timeout: 10_000,
		});
		return res.json({
			ok: true,
			proxiedStatus: response.status,
			proxiedBody: response.data,
		});
	} catch (err) {
		return res.status(500).json({ ok: false, error: err?.message || String(err) });
	}
});

export default router;
