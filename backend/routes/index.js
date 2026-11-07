
import express from "express";
import userRouter from "./authRoutes.js";
import productRoutes from "./productRoutes.js";
import invoiceRouter from "./invoiceRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import inventoryRoutes from "./inventoryRoutes.js";
import purchaseRouter from "./purchaseRoutes.js";
import dashboardRouter from "./dashboardRoutes.js";
import uploadRoutes from "./uploadRoutes.js";
import reportsRouter from "./reportsRoutes.js";
import ownerRoutes from "./ownerRoutes.js";

const router = express.Router();

router.use("/invoices", invoiceRouter);
router.use("/auth", userRouter);
router.use("/reports", reportsRouter);
router.use("/owner", ownerRoutes);
router.use("/notifications", notificationRoutes);
router.use("/products", productRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/uploads", uploadRoutes);
router.use("/purchases", purchaseRouter);
router.use("/dashboard", dashboardRouter);

export default router;
