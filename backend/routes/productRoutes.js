import express from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  archiveProduct,
  deleteProductById,  deleteProducts,
} from "../controler/productController.js";
import { protect } from "../middleware/authMiddleware.js";

const productRoutes = express.Router();

productRoutes.use(protect);

productRoutes
  .route("/")
  .post(createProduct)
  .get(getProducts)
  .delete(deleteProducts);

productRoutes
  .route("/:id")
  .get(getProductById)
  .patch(updateProduct)
  .delete(deleteProductById);

productRoutes.patch("/:id/archive", archiveProduct);

export default productRoutes;