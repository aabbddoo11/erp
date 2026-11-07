import mongoose from "mongoose";
import Product from "../models/Product.js";
import InventoryMovement from "../models/InventoryMovement.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidId = (id) => mongoose.isValidObjectId(id);

// GET /api/inventory/movements
export const getInventoryMovements = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);

    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
      100
    );

    const filter = {
      owner: req.user.id,
    };

    if (req.query.productId) {
      if (!isValidId(req.query.productId)) {
        throw createError("معرف المنتج غير صالح");
      }

      filter.product = req.query.productId;
    }

    if (req.query.variantId) {
      if (!isValidId(req.query.variantId)) {
        throw createError("معرف المتغير غير صالح");
      }

      filter.variant = req.query.variantId;
    }

    if (req.query.invoiceId) {
      if (!isValidId(req.query.invoiceId)) {
        throw createError("معرف الفاتورة غير صالح");
      }

      filter.invoice = req.query.invoiceId;
    }

    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.from || req.query.to) {
      filter.createdAt = {};

      if (req.query.from) {
        filter.createdAt.$gte = new Date(req.query.from);
      }

      if (req.query.to) {
        const endDate = new Date(req.query.to);
        endDate.setHours(23, 59, 59, 999);

        filter.createdAt.$lte = endDate;
      }
    }

    const [movements, total] = await Promise.all([
      InventoryMovement.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("invoice", "invoiceNumber status")
        .populate("performedBy", "name email"),
      InventoryMovement.countDocuments(filter),
    ]);

    return res.status(200).json({
      movements,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/inventory/movements/:id
export const getInventoryMovementById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      throw createError("معرف حركة المخزون غير صالح");
    }

    const movement = await InventoryMovement.findOne({
      _id: id,
      owner: req.user.id,
    })
      .populate("invoice", "invoiceNumber status")
      .populate("performedBy", "name email");

    if (!movement) {
      throw createError("حركة المخزون غير موجودة", 404);
    }

    return res.status(200).json({ movement });
  } catch (error) {
    next(error);
  }
};

// POST /api/inventory/adjustments
export const createInventoryAdjustment = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { productId, variantId, quantityChange, notes } = req.body;

    if (!isValidId(productId) || !isValidId(variantId)) {
      throw createError("معرف المنتج أو المتغير غير صالح");
    }

    if (
      !Number.isInteger(quantityChange) ||
      quantityChange === 0
    ) {
      throw createError(
        "تغير الكمية يجب أن يكون رقمًا صحيحًا ومختلفًا عن صفر"
      );
    }

    if (!notes || typeof notes !== "string" || notes.trim().length < 3) {
      throw createError(
        "يجب كتابة سبب واضح لتعديل المخزون، ثلاثة أحرف على الأقل"
      );
    }

    let createdMovement;

    await session.withTransaction(async () => {
      const product = await Product.findOne({
        _id: productId,
        owner: req.user.id,
      }).session(session);

      if (!product) {
        throw createError("المنتج غير موجود", 404);
      }

      const variant = product.variants.id(variantId);

      if (!variant) {
        throw createError("اللون أو المقاس غير موجود داخل المنتج", 404);
      }

      const stockBefore = variant.stock.quantity;
      const stockAfter = stockBefore + quantityChange;

      if (stockAfter < 0) {
        throw createError(
          `لا يمكن خصم ${Math.abs(quantityChange)} قطعة؛ المتوفر حاليًا هو ${stockBefore}`,
          409
        );
      }

      const movementType =
        quantityChange > 0 ? "adjustment_in" : "adjustment_out";

      variant.stock.quantity = stockAfter;
      product.markModified("variants");

      await product.save({ session });

      const [movement] = await InventoryMovement.create(
        [
          {
            owner: req.user.id,
            product: product._id,
            variant: variant._id,
            type: movementType,
            quantityChange,
            stockBefore,
            stockAfter,
            snapshot: {
              productName: product.name,
              sku: variant.sku,
              colorName: variant.color.name,
              sizeCode: variant.size.code,
            },
            unitCost: variant.costPrice,
            notes: notes.trim(),
            performedBy: req.user.id,
          },
        ],
        { session }
      );

      createdMovement = movement;
    });

    return res.status(201).json({
      message: "تم تعديل المخزون وتسجيل الحركة بنجاح",
      movement: createdMovement,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};