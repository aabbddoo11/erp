import express from "express";
import {
  createPurchase,
  getPurchases,
  getPurchaseById,
  cancelPurchase,
} from "../controler/purchaseController.js";
import { protect } from "../middleware/authMiddleware.js";

const purchaseRouter = express.Router();

// كل مسارات المشتريات تتطلب تسجيل الدخول
purchaseRouter.use(protect);

purchaseRouter
  .route("/")
  .post(createPurchase)
  .get(getPurchases);

purchaseRouter.get("/:id", getPurchaseById);

purchaseRouter.patch("/:id/cancel", cancelPurchase);

export default purchaseRouter;