
import express from "express";
import {
  createInvoice,
  getInvoices,
  getInvoiceById,
  cancelInvoice,
  addInvoicePayment,
  updateInvoice,
  deleteInvoice,
} from "../controler/invoiceController.js";
import { protect } from "../middleware/authMiddleware.js";

const invoiceRouter = express.Router();

invoiceRouter.use(protect);

invoiceRouter
  .route("/")
  .post(createInvoice)
  .get(getInvoices);

invoiceRouter.post("/:id/payments", addInvoicePayment);
invoiceRouter.patch("/:id/cancel", cancelInvoice);

invoiceRouter
  .route("/:id")
  .get(getInvoiceById)
  .patch(updateInvoice)
  .delete(deleteInvoice);

export default invoiceRouter;
