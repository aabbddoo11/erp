
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { ownerOnly } from "../middleware/ownerMiddleware.js";

import {
  createAccount,
  getAccounts,
  getAccountById,
  updateAccount,
  updateAccountStatus,
  getDashboardStats,deleteAccount
} from "../controler/ownerController.js";

const router = express.Router();

// جميع مسارات المالك تتطلب تسجيل الدخول وصلاحية المالك
router.use(protect, ownerOnly);

// إحصائيات لوحة تحكم المالك
router.get("/dashboard", getDashboardStats);

router.delete("/accounts/:id", deleteAccount);
router.post("/accounts", createAccount);
router.get("/accounts", getAccounts);
router.get("/accounts/:id", getAccountById);
router.patch("/accounts/:id", updateAccount);
router.patch("/accounts/:id/status", updateAccountStatus);

export default router;
