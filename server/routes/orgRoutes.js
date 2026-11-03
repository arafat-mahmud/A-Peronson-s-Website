import { Router } from "express";
import memberRoutes from "./memberRoutes.js";
import orgOperationsRoutes from "./orgOperationsRoutes.js";

const router = Router();

router.use("/members", memberRoutes);
router.use("/operations", orgOperationsRoutes);
router.use("/ops", orgOperationsRoutes);

export default router;
