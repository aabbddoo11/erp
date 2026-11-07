import express from "express";
import {
  createUploadUrl,
  deleteUpload,
} from "../controler/uploadController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post(
  "/presign",
  protect,
  createUploadUrl
);

router.delete(
  "/",
 protect,
  deleteUpload
);

export default router;