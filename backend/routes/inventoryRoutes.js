import express from "express";
import {
  getInventoryMovements,
  getInventoryMovementById,
  createInventoryAdjustment,
} from "../controler/inventoryController.js";
import { protect } from "../middleware/authMiddleware.js";
const inventoryRoutes = express.Router();

inventoryRoutes.use(protect);

inventoryRoutes.get("/movements", getInventoryMovements);
inventoryRoutes.get("/movements/:id", getInventoryMovementById);
inventoryRoutes.post("/adjustments", createInventoryAdjustment);

export default inventoryRoutes;