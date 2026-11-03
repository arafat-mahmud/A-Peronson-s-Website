import { Router } from "express";
import { getMyCertification, getOrgCertification } from "../controllers/certificationController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/me", requireAuth, getMyCertification);
router.get("/org/:orgId", requireAuth, getOrgCertification);

export default router;
