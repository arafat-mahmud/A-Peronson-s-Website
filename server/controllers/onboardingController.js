import { updateProfile } from "../services/userService.js";

export async function submitOnboarding(req, res) {
	const patch = {
		profile_image: req.body?.profile_image || "",
		organization_name: req.body?.organization_name || "",
		categories: Array.isArray(req.body?.categories) ? req.body.categories : [],
		onboarding_completed: "true",
	};
	// The onboarding form collects these too; they used to be dropped here.
	if (typeof req.body?.bio === "string" && req.body.bio.trim()) {
		patch.bio = req.body.bio;
	}
	// Certifications are an optional step: absent or empty means "skipped",
	// which never overwrites certifications the company already listed.
	if (Array.isArray(req.body?.certifications) && req.body.certifications.length > 0) {
		patch.certifications = req.body.certifications
			.map((item) => String(item || "").trim())
			.filter(Boolean)
			.slice(0, 20);
	}
	const user = await updateProfile(req.user.id, patch);
	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}
	return res.json(user);
}
