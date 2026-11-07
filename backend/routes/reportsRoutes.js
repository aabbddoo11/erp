import express from "express";
import {
  getSalesReport,
  getProfitReport,
  getInventoryReport,
  getPurchasesReport,
} from "../controler/reportsController.js";
import { protect } from "../middleware/authMiddleware.js";

const reportsRouter = express.Router();

// كل التقارير خاصة بالمستخدم المسجل فقط
reportsRouter.use(protect);

reportsRouter.get("/sales", getSalesReport);
reportsRouter.get("/profit", getProfitReport);
reportsRouter.get("/inventory", getInventoryReport);
reportsRouter.get("/purchases", getPurchasesReport);

export default reportsRouter;