import express from "express";
import { getDashboard } from "../controler/dashboardController.js";
import { protect } from "../middleware/authMiddleware.js";

const dashboardRouter = express.Router();

dashboardRouter.use(protect);

dashboardRouter.get("/", getDashboard);

export default dashboardRouter;