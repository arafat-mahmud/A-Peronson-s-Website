import { Router } from "express";
import {
	deleteProduct,
	getMyViewedProducts,
	getProducts,
	postProduct,
	recordProductView,
	searchProducts,
	updateProduct,
} from "../controllers/productController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import validateFiltersMiddleware from "../middleware/validateSearchFilters.js";

const router = Router();
router.get("/", requireAuth, getProducts);
router.get("/search", requireAuth, validateFiltersMiddleware, searchProducts);
router.get("/views/me", requireAuth, getMyViewedProducts);
router.post("/", requireAuth, allowRoles("factory", "buying_house", "admin", "agent"), postProduct);
router.patch(
	"/:productId",
	requireAuth,
	allowRoles("factory", "buying_house", "admin", "agent"),
	updateProduct,
);
router.delete(
	"/:productId",
	requireAuth,
	allowRoles("factory", "buying_house", "admin", "agent"),
	deleteProduct,
);
router.post("/:productId/view", requireAuth, recordProductView);
export default router;
