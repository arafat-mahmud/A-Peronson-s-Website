/**
 * Normalize incoming e-sign provider webhook payloads to our internal shape.
 * Returns an object possibly containing `buyer_signed` and/or `factory_signed` booleans.
 * This is best-effort mapping across multiple vendor payload shapes (Dropbox Sign,
 * HelloSign, DocuSign, Adobe Sign, etc.). If mapping can't be determined, an
 * empty object is returned so the original payload is preserved.
 */
export function normalizeProviderWebhook(rawPayload = {}) {
	const payload = rawPayload || {};

	// If already in our internal shape, pass through
	if (payload.buyer_signed || payload.factory_signed) {
		return {
			buyer_signed: Boolean(payload.buyer_signed),
			factory_signed: Boolean(payload.factory_signed),
		};
	}

	const result = {};

	const eventType =
		(payload.event && (payload.event.event_type || payload.event.type)) ||
		payload.type ||
		payload.event_type ||
		"";
	const le = String(eventType || "").toLowerCase();

	const detectRoleFromObj = (obj) => {
		if (!obj) {
			return null;
		}
		const role = String(
			obj.role || obj.signer_role || obj.role_name || obj.roleType || "",
		).toLowerCase();
		if (role.includes("buyer")) {
			return "buyer";
		}
		if (role.includes("factory") || role.includes("supplier")) {
			return "factory";
		}

		const email = String(
			obj.email || obj.signer_email_address || obj.email_address || obj.signer_email || "",
		).toLowerCase();
		if (email) {
			if (email.includes("buyer")) {
				return "buyer";
			}
			if (email.includes("factory") || email.includes("supplier")) {
				return "factory";
			}
		}

		const name = String(obj.name || obj.signer_name || obj.signer || "").toLowerCase();
		if (name) {
			if (name.includes("buyer")) {
				return "buyer";
			}
			if (name.includes("factory") || name.includes("supplier")) {
				return "factory";
			}
		}
		return null;
	};

	// Collect common signature arrays from different provider shapes
	const signatures = [];
	if (Array.isArray(payload.signature_request?.signatures)) {
		signatures.push(...payload.signature_request.signatures);
	}
	if (Array.isArray(payload.signatures)) {
		signatures.push(...payload.signatures);
	}
	if (Array.isArray(payload.signers)) {
		signatures.push(...payload.signers);
	}
	if (Array.isArray(payload.recipientStatuses)) {
		signatures.push(...payload.recipientStatuses);
	}
	if (Array.isArray(payload.signerStatuses)) {
		signatures.push(...payload.signerStatuses);
	}
	// single objects
	if (payload.signature && !Array.isArray(payload.signature)) {
		signatures.push(payload.signature);
	}
	if (payload.signer && !Array.isArray(payload.signer)) {
		signatures.push(payload.signer);
	}

	for (const s of signatures) {
		const role = detectRoleFromObj(s);
		const status = String(
			s.status || s.status_code || s.signed || s.signer_status || "",
		).toLowerCase();
		if (role === "buyer") {
			result.buyer_signed =
				result.buyer_signed || status === "signed" || Boolean(s.signed) || Boolean(s.signed_at);
		}
		if (role === "factory") {
			result.factory_signed =
				result.factory_signed || status === "signed" || Boolean(s.signed) || Boolean(s.signed_at);
		}
	}

	// Provider-level event hints meaning "all signers signed"
	if (!(result.buyer_signed || result.factory_signed)) {
		if (
			le.includes("all_signed") ||
			le.includes("all_signers") ||
			le.includes("signature_request_all_signed") ||
			le.includes("signatures:all")
		) {
			result.buyer_signed = true;
			result.factory_signed = true;
		} else if (le.includes("signed") || le.includes("signature")) {
			// If payload has exactly one signature object, try to map it
			if (signatures.length === 1) {
				const s = signatures[0];
				const role = detectRoleFromObj(s);
				const status = String(s.status || s.signed || s.status_code || "").toLowerCase();
				if (role === "buyer") {
					result.buyer_signed = status === "signed" || Boolean(s.signed) || Boolean(s.signed_at);
				}
				if (role === "factory") {
					result.factory_signed = status === "signed" || Boolean(s.signed) || Boolean(s.signed_at);
				}
			}
		}
	}

	if (!(result.buyer_signed || result.factory_signed)) {
		return {};
	}

	// Attach some provider metadata to help debugging
	result.provider_event_type = eventType || "";
	return result;
}
