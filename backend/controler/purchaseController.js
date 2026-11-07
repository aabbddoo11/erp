import mongoose from "mongoose";
import Product from "../models/Product.js";
import Purchase from "../models/Purchase.js";
import InventoryMovement from "../models/InventoryMovement.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidId = (id) => mongoose.isValidObjectId(id);

const createPurchaseNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `PUR-${date}-${random}`;
};

// POST /api/purchases
export const createPurchase = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const {
      items,
      paidAmount = 0,
      referenceNumber,
      notes,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      throw createError("يجب أن يحتوي سند الشراء على منتج واحد على الأقل");
    }

    if (!Number.isFinite(Number(paidAmount)) || Number(paidAmount) < 0) {
      throw createError("المبلغ المدفوع غير صالح");
    }

    const requestedItems = new Map();

    for (const item of items) {
      const { productId, variantId, quantity, unitCost } = item;

      if (!isValidId(productId) || !isValidId(variantId)) {
        throw createError("معرف المنتج أو المتغير غير صالح");
      }

      if (!Number.isInteger(quantity) || quantity < 1) {
        throw createError("كمية الشراء يجب أن تكون رقمًا صحيحًا أكبر من صفر");
      }

      if (
        unitCost === undefined ||
        !Number.isFinite(Number(unitCost)) ||
        Number(unitCost) < 0
      ) {
        throw createError("تكلفة شراء القطعة غير صالحة");
      }

      const key = `${productId}:${variantId}`;

      if (requestedItems.has(key)) {
        throw createError(
          "لا يمكن تكرار نفس اللون والمقاس؛ اجمع الكمية في سطر واحد"
        );
      }

      requestedItems.set(key, {
        productId,
        variantId,
        quantity,
        unitCost: Number(unitCost),
      });
    }

    let createdPurchase;

    await session.withTransaction(async () => {
      const productIds = [
        ...new Set(
          [...requestedItems.values()].map((item) => item.productId)
        ),
      ];

      const products = await Product.find({
        _id: { $in: productIds },
        owner: req.user.id,
        status: { $ne: "archived" },
      }).session(session);

      if (products.length !== productIds.length) {
        throw createError(
          "يوجد منتج غير موجود أو مؤرشف أو لا تملك صلاحية تعديله",
          404
        );
      }

      const productsMap = new Map(
        products.map((product) => [product._id.toString(), product])
      );

      const purchaseItems = [];
      const purchaseMovements = [];

      for (const requestedItem of requestedItems.values()) {
        const product = productsMap.get(requestedItem.productId);

        const variant = product.variants.id(requestedItem.variantId);

        if (!variant) {
          throw createError(
            `اللون أو المقاس غير موجود في المنتج: ${product.name}`,
            404
          );
        }

        const stockBefore = variant.stock.quantity;
        const stockAfter = stockBefore + requestedItem.quantity;

        // في النسخة البسيطة: تكلفة آخر شراء تصبح تكلفة المنتج الحالية
        variant.costPrice = requestedItem.unitCost;
        variant.stock.quantity = stockAfter;

        product.markModified("variants");

        purchaseItems.push({
          product: product._id,
          variant: variant._id,
          productName: product.name,
          sku: variant.sku,
          color: {
            name: variant.color.name,
            hex: variant.color.hex,
          },
          size: {
            code: variant.size.code,
            label: variant.size.label,
          },
          quantity: requestedItem.quantity,
          unitCost: requestedItem.unitCost,
        });

        purchaseMovements.push({
          owner: req.user.id,
          product: product._id,
          variant: variant._id,
          type: "purchase",
          quantityChange: requestedItem.quantity,
          stockBefore,
          stockAfter,
          snapshot: {
            productName: product.name,
            sku: variant.sku,
            colorName: variant.color.name,
            sizeCode: variant.size.code,
          },
          unitCost: requestedItem.unitCost,
          performedBy: req.user.id,
        });
      }

      const [purchase] = await Purchase.create(
        [
          {
            owner: req.user.id,
            createdBy: req.user.id,
            purchaseNumber: createPurchaseNumber(),
            referenceNumber: referenceNumber || null,
            items: purchaseItems,
            paidAmount: Number(paidAmount),
            notes: notes || "",
            status: "completed",
          },
        ],
        { session }
      );

      // تحفظ المنتجات بعد تحديث الكمية والتكلفة
      await Promise.all(products.map((product) => product.save({ session })));

      // تحفظ حركة إدخال المخزون
      await InventoryMovement.create(
        purchaseMovements.map((movement) => ({
          ...movement,
          purchase: purchase._id,
        })),
        { session }
      );

      createdPurchase = purchase;
    });

    return res.status(201).json({
      message: "تم إنشاء سند الشراء وزيادة المخزون بنجاح",
      purchase: createdPurchase,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

// GET /api/purchases?page=1&limit=20&status=completed
export const getPurchases = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);

    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
      100
    );

    const filter = {
      owner: req.user.id,
    };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }

    const [purchases, total] = await Promise.all([
      Purchase.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Purchase.countDocuments(filter),
    ]);

    return res.status(200).json({
      purchases,
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

// GET /api/purchases/:id
export const getPurchaseById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      throw createError("معرف سند الشراء غير صالح");
    }

    const purchase = await Purchase.findOne({
      _id: id,
      owner: req.user.id,
    });

    if (!purchase) {
      throw createError("سند الشراء غير موجود", 404);
    }

    return res.status(200).json({ purchase });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/purchases/:id/cancel
// يلغي سند شراء كامل ويخصم الكميات التي أضافها.
export const cancelPurchase = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      throw createError("معرف سند الشراء غير صالح");
    }

    let cancelledPurchase;

    await session.withTransaction(async () => {
      const purchase = await Purchase.findOne({
        _id: id,
        owner: req.user.id,
      }).session(session);

      if (!purchase) {
        throw createError("سند الشراء غير موجود", 404);
      }

      if (purchase.status === "cancelled") {
        throw createError("سند الشراء ملغى بالفعل", 409);
      }

      if (purchase.status !== "completed") {
        throw createError("يمكن إلغاء سند شراء مكتمل فقط", 409);
      }

      const cancellationMovements = [];

      for (const item of purchase.items) {
        const product = await Product.findOne({
          _id: item.product,
          owner: req.user.id,
        }).session(session);

        if (!product) {
          throw createError(
            `تعذر إلغاء الشراء لأن المنتج ${item.productName} غير موجود`,
            409
          );
        }

        const variant = product.variants.id(item.variant);

        if (!variant) {
          throw createError(
            `تعذر إلغاء الشراء لأن المتغير ${item.sku} غير موجود`,
            409
          );
        }

        const stockBefore = variant.stock.quantity;
        const stockAfter = stockBefore - item.quantity;

        if (stockAfter < 0) {
          throw createError(
            `لا يمكن إلغاء الشراء؛ المخزون المتاح من ${item.sku} أقل من كمية الشراء`,
            409
          );
        }

        variant.stock.quantity = stockAfter;
        product.markModified("variants");

        await product.save({ session });

        cancellationMovements.push({
          owner: req.user.id,
          product: product._id,
          variant: variant._id,
          purchase: purchase._id,
          type: "purchase_cancelled",
          quantityChange: -item.quantity,
          stockBefore,
          stockAfter,
          snapshot: {
            productName: item.productName,
            sku: item.sku,
            colorName: item.color?.name || null,
            sizeCode: item.size?.code || null,
          },
          unitCost: item.unitCost,
          notes: "إلغاء سند شراء",
          performedBy: req.user.id,
        });
      }

      purchase.status = "cancelled";
      purchase.cancelledAt = new Date();

      await purchase.save({ session });

      await InventoryMovement.create(cancellationMovements, { session });

      cancelledPurchase = purchase;
    });

    return res.status(200).json({
      message: "تم إلغاء سند الشراء وخصم الكميات من المخزون",
      purchase: cancelledPurchase,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};