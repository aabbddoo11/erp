import mongoose from "mongoose";
import Product from "../models/Product.js";
import Invoice from "../models/Invoice.js";
import InventoryMovement from "../models/InventoryMovement.js";
import { createNotification } from "../services/notificationService.js";
const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidId = (id) => mongoose.isValidObjectId(id);

const createInvoiceNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${date}-${random}`;
};

export const createInvoice = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { items, customer, invoiceDiscount, taxRate, payments, notes } =
      req.body;

    if (!Array.isArray(items) || items.length === 0) {
      throw createError("يجب أن تحتوي الفاتورة على منتج واحد على الأقل");
    }

    const requestedItems = new Map();

    for (const item of items) {
      const { productId, variantId, quantity, discount = 0 } = item;

      if (!isValidId(productId) || !isValidId(variantId)) {
        throw createError("معرف المنتج أو المتغير غير صالح");
      }

      if (!Number.isInteger(quantity) || quantity < 1) {
        throw createError(
          "كمية كل منتج يجب أن تكون رقمًا صحيحًا أكبر من صفر"
        );
      }

      const parsedDiscount = Number(discount);

      if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0) {
        throw createError("خصم المنتج لا يمكن أن يكون أقل من صفر");
      }

      const key = `${productId}:${variantId}`;

      if (requestedItems.has(key)) {
        throw createError(
          "لا يمكن تكرار نفس اللون والمقاس في الفاتورة، اجمع الكمية في سطر واحد"
        );
      }

      requestedItems.set(key, {
        productId,
        variantId,
        quantity,
        discount: parsedDiscount,
      });
    }

    let createdInvoice;
    let saleMovementsForNotifications = [];

    await session.withTransaction(async () => {
      const productIds = [
        ...new Set(
          [...requestedItems.values()].map((item) => item.productId)
        ),
      ];

      const products = await Product.find({
        _id: { $in: productIds },
        owner: req.user.id,
        status: "active",
      }).session(session);

      if (products.length !== productIds.length) {
        throw createError(
          "يوجد منتج غير موجود أو غير نشط أو لا تملك صلاحية بيعه",
          404
        );
      }

      const productsMap = new Map(
        products.map((product) => [product._id.toString(), product])
      );

      const invoiceItems = [];
      const saleMovements = [];

      for (const requestedItem of requestedItems.values()) {
        const product = productsMap.get(requestedItem.productId);
        const variant = product.variants.id(requestedItem.variantId);

        if (!variant) {
          throw createError(
            `اللون أو المقاس المطلوب غير موجود في المنتج: ${product.name}`,
            404
          );
        }

        if (!variant.isActive) {
          throw createError(
            `هذا اللون أو المقاس غير متاح للبيع: ${product.name}`,
            409
          );
        }

        const stockBefore = variant.stock.quantity;
        const stockAfter = stockBefore - requestedItem.quantity;

        if (stockAfter < 0) {
          throw createError(
            `الكمية غير متوفرة للمنتج: ${product.name} (${variant.color.name} - ${variant.size.code})`,
            409
          );
        }

        const lineGross = requestedItem.quantity * variant.salePrice;

        if (requestedItem.discount > lineGross) {
          throw createError(
            `خصم المنتج ${product.name} أكبر من قيمة السطر`
          );
        }

        variant.stock.quantity = stockAfter;
        product.markModified("variants");

        invoiceItems.push({
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
          unitPrice: variant.salePrice,
          unitCost: variant.costPrice,
          discount: requestedItem.discount,
        });

        saleMovements.push({
          owner: req.user.id,
          product: product._id,
          variant: variant._id,
          type: "sale",
          quantityChange: -requestedItem.quantity,
          stockBefore,
          stockAfter,
          snapshot: {
            productName: product.name,
            sku: variant.sku,
            colorName: variant.color.name,
            sizeCode: variant.size.code,
          },
          unitCost: variant.costPrice,
          performedBy: req.user.id,
        });
      }

      const [invoice] = await Invoice.create(
        [
          {
            owner: req.user.id,
            createdBy: req.user.id,
            invoiceNumber: createInvoiceNumber(),
            customer: customer || {},
            items: invoiceItems,
            invoiceDiscount: Number(invoiceDiscount) || 0,
            taxRate: Number(taxRate) || 0,
            payments: payments || [],
            notes: notes || "",
            status: "completed",
          },
        ],
        { session }
      );

      await Promise.all(products.map((product) => product.save({ session })))

      await InventoryMovement.create(
        saleMovements.map((movement) => ({
          ...movement,
          invoice: invoice._id,
        })),
        { session }
      );

      saleMovementsForNotifications = saleMovements.map((movement) => ({
        product: movement.product,
        variant: movement.variant,
        stockBefore: movement.stockBefore,
        stockAfter: movement.stockAfter,
        snapshot: { ...movement.snapshot },
      }));

      createdInvoice = invoice;
    });

    try {
      await createNotification({
        owner: req.user.id,
        type: "invoice_created",
        title: "تم إنشاء فاتورة جديدة",
        message: `تم إنشاء الفاتورة رقم ${createdInvoice.invoiceNumber} بإجمالي ${createdInvoice.total}.`,
        link: "/sales",
        entityId: createdInvoice._id,
        dedupeKey: `invoice-created:${createdInvoice._id}`,
      });
    } catch (notificationError) {
      console.error(
        "Failed to create invoice notification:",
        notificationError
      );
    }

    for (const movement of saleMovementsForNotifications) {
      if (movement.stockBefore > 5 && movement.stockAfter <= 5) {
        try {
          await createNotification({
            owner: req.user.id,
            type: "low_stock",
            title: "تنبيه انخفاض المخزون",
            message:
              `تبقى ${movement.stockAfter} قطع من ${movement.snapshot.productName}` +
              ` (${movement.snapshot.colorName || ""} - ${movement.snapshot.sizeCode || ""}).`,
            link: "/products",
            entityId: movement.product,
            dedupeKey: `low-stock:${createdInvoice._id}:${movement.variant}`,
          });
        } catch (notificationError) {
          console.error(
            "Failed to create low-stock notification:",
            notificationError
          );
        }
      }
    }

    return res.status(201).json({
      message: "تم إنشاء الفاتورة وخصم المخزون وتسجيل حركة البيع بنجاح",
      invoice: createdInvoice,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

export const getInvoices = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
      100
    );

    const filter = {
      owner: req.user.id,
      deletedAt: null,
    };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }

    if (req.query.phone) {
      filter["customer.phone"] = req.query.phone.trim();
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Invoice.countDocuments(filter),
    ]);

    return res.status(200).json({
      invoices,
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

export const getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      throw createError("معرف الفاتورة غير صالح");
    }

    const invoice = await Invoice.findOne({
      _id: id,
      owner: req.user.id,
      deletedAt: null,
    });

    if (!invoice) {
      throw createError("الفاتورة غير موجودة", 404);
    }

    return res.status(200).json({ invoice });
  } catch (error) {
    next(error);
  }
};

export const cancelInvoice = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      throw createError("معرف الفاتورة غير صالح");
    }

    let cancelledInvoice;

    await session.withTransaction(async () => {
      const invoice = await Invoice.findOne({
        _id: id,
        owner: req.user.id,
      }).session(session);

      if (!invoice) {
        throw createError("الفاتورة غير موجودة", 404);
      }

      if (invoice.status === "cancelled") {
        throw createError("هذه الفاتورة ملغاة بالفعل", 409);
      }

      if (invoice.status !== "completed") {
        throw createError("يمكن إلغاء الفواتير المكتملة فقط", 409);
      }

      const cancelledMovements = [];

      for (const item of invoice.items) {
        const product = await Product.findOne({
          _id: item.product,
          owner: req.user.id,
        }).session(session);

        if (!product) {
          throw createError(
            `تعذر إعادة المخزون لأن المنتج ${item.productName} غير موجود`,
            409
          );
        }

        const variant = product.variants.id(item.variant);

        if (!variant) {
          throw createError(
            `تعذر إعادة المخزون لأن المتغير ${item.sku} غير موجود`,
            409
          );
        }

        const stockBefore = variant.stock.quantity;
        const stockAfter = stockBefore + item.quantity;

        variant.stock.quantity = stockAfter;
        product.markModified("variants");

        await product.save({ session });

        cancelledMovements.push({
          owner: req.user.id,
          product: product._id,
          variant: variant._id,
          invoice: invoice._id,
          type: "sale_cancelled",
          quantityChange: item.quantity,
          stockBefore,
          stockAfter,
          snapshot: {
            productName: item.productName,
            sku: item.sku,
            colorName: item.color?.name || null,
            sizeCode: item.size?.code || null,
          },
          unitCost: item.unitCost,
          notes: "إلغاء فاتورة البيع",
          performedBy: req.user.id,
        });
      }

      invoice.status = "cancelled";
      invoice.cancelledAt = new Date();

      if (invoice.paidAmount > 0) {
        invoice.paymentStatus = "refunded";
      } else {
        invoice.paymentStatus = "unpaid";
      }

      await invoice.save({ session });
      await InventoryMovement.create(cancelledMovements, { session });

      cancelledInvoice = invoice;
    });

    return res.status(200).json({
      message:
        "تم إلغاء الفاتورة وإعادة الكميات إلى المخزون وتسجيل حركة الإلغاء",
      invoice: cancelledInvoice,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

export const addInvoicePayment = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    const { amount, method, reference } = req.body;

    if (!isValidId(id)) {
      throw createError("معرف الفاتورة غير صالح");
    }

    const paymentAmount = Number(amount);
    const allowedMethods = ["cash", "card", "bank_transfer", "wallet"];

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      throw createError("مبلغ الدفعة يجب أن يكون أكبر من صفر");
    }

    if (!allowedMethods.includes(method)) {
      throw createError("طريقة الدفع غير صالحة");
    }

    let updatedInvoice;

    await session.withTransaction(async () => {
      const invoice = await Invoice.findOne({
        _id: id,
        owner: req.user.id,
      }).session(session);

      if (!invoice) {
        throw createError("الفاتورة غير موجودة", 404);
      }

      if (invoice.status !== "completed") {
        throw createError(
          "يمكن تسجيل الدفعات للفواتير المكتملة فقط",
          409
        );
      }

      if (invoice.paymentStatus === "refunded") {
        throw createError(
          "لا يمكن إضافة دفعة إلى فاتورة مستردة",
          409
        );
      }

      const dueAmount = Math.max(
        0,
        Number(invoice.total) -
          invoice.payments.reduce(
            (sum, payment) => sum + Number(payment.amount || 0),
            0
          )
      );

      if (paymentAmount > dueAmount + 0.001) {
        throw createError(
          "مبلغ الدفعة أكبر من المبلغ المتبقي على الفاتورة"
        );
      }

      invoice.payments.push({
        amount: paymentAmount,
        method,
        reference: String(reference || "").trim() || null,
        paidAt: new Date(),
      });

      await invoice.save({ session });
      updatedInvoice = invoice;
    });

    return res.status(200).json({
      message: "تم تسجيل الدفعة بنجاح",
      invoice: updatedInvoice,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

export const updateInvoice = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    const { items, customer, invoiceDiscount, taxRate, notes } = req.body;

    if (!isValidId(id)) {
      throw createError("معرف الفاتورة غير صالح");
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw createError("يجب أن تحتوي الفاتورة على منتج واحد على الأقل");
    }

    const requestedItems = new Map();

    for (const item of items) {
      const { productId, variantId, quantity, discount = 0 } = item;

      if (!isValidId(productId) || !isValidId(variantId)) {
        throw createError("معرف المنتج أو المتغير غير صالح");
      }

      if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
        throw createError("الكمية يجب أن تكون عددًا صحيحًا أكبر من صفر");
      }

      const parsedDiscount = Number(discount);

      if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0) {
        throw createError("قيمة الخصم غير صالحة");
      }

      const key = `${productId}:${variantId}`;

      if (requestedItems.has(key)) {
        throw createError(
          "لا يمكن تكرار المنتج نفسه باللون والمقاس نفسيهما"
        );
      }

      requestedItems.set(key, {
        productId: String(productId),
        variantId: String(variantId),
        quantity: Number(quantity),
        discount: parsedDiscount,
      });
    }

    let updatedInvoice;

    await session.withTransaction(async () => {
      const invoice = await Invoice.findOne({
        _id: id,
        owner: req.user.id,
        deletedAt: null,
      }).session(session);

      if (!invoice) {
        throw createError("الفاتورة غير موجودة", 404);
      }

      if (invoice.status !== "completed") {
        throw createError("يمكن تعديل الفواتير المكتملة فقط", 409);
      }

      if (invoice.payments.length > 0) {
        throw createError(
          "لا يمكن تعديل فاتورة سُجلت عليها دفعات. عالج الدفعات أولًا.",
          409
        );
      }

      const productIds = [
        ...new Set([
          ...invoice.items.map((item) => String(item.product)),
          ...[...requestedItems.values()].map((item) => item.productId),
        ]),
      ];

      const products = await Product.find({
        _id: { $in: productIds },
        owner: req.user.id,
      }).session(session);

      const productsMap = new Map(
        products.map((product) => [String(product._id), product])
      );

      const movements = [];

      for (const item of invoice.items) {
        const product = productsMap.get(String(item.product));

        if (!product) {
          throw createError(
            `تعذر تعديل الفاتورة لأن المنتج ${item.productName} غير موجود`,
            409
          );
        }

        const variant = product.variants.id(item.variant);

        if (!variant) {
          throw createError(
            `تعذر تعديل الفاتورة لأن المتغير ${item.sku} غير موجود`,
            409
          );
        }

        const stockBefore = variant.stock.quantity;
        const stockAfter = stockBefore + item.quantity;

        variant.stock.quantity = stockAfter;
        product.markModified("variants");

        movements.push({
          owner: req.user.id,
          product: product._id,
          variant: variant._id,
          invoice: invoice._id,
          type: "sale_cancelled",
          quantityChange: item.quantity,
          stockBefore,
          stockAfter,
          snapshot: {
            productName: item.productName,
            sku: item.sku,
            colorName: item.color?.name || null,
            sizeCode: item.size?.code || null,
          },
          unitCost: item.unitCost,
          notes: "إعادة كمية مؤقتة أثناء تعديل الفاتورة",
          performedBy: req.user.id,
        });
      }

      const newInvoiceItems = [];

      for (const item of requestedItems.values()) {
        const product = productsMap.get(item.productId);

        if (!product || product.status !== "active") {
          throw createError("يوجد منتج غير موجود أو غير نشط", 404);
        }

        const variant = product.variants.id(item.variantId);

        if (!variant || !variant.isActive) {
          throw createError(
            `اللون أو المقاس غير متاح للبيع في المنتج ${product.name}`,
            409
          );
        }

        const stockBefore = variant.stock.quantity;
        const stockAfter = stockBefore - item.quantity;

        if (stockAfter < 0) {
          throw createError(
            `الكمية غير متوفرة للمنتج ${product.name}`,
            409
          );
        }

        const lineGross = item.quantity * variant.salePrice;

        if (item.discount > lineGross) {
          throw createError(
            `خصم المنتج ${product.name} أكبر من قيمة السطر`
          );
        }

        variant.stock.quantity = stockAfter;
        product.markModified("variants");

        newInvoiceItems.push({
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
          quantity: item.quantity,
          unitPrice: variant.salePrice,
          unitCost: variant.costPrice,
          discount: item.discount,
        });

        movements.push({
          owner: req.user.id,
          product: product._id,
          variant: variant._id,
          invoice: invoice._id,
          type: "sale",
          quantityChange: -item.quantity,
          stockBefore,
          stockAfter,
          snapshot: {
            productName: product.name,
            sku: variant.sku,
            colorName: variant.color.name,
            sizeCode: variant.size.code,
          },
          unitCost: variant.costPrice,
          notes: "تسجيل حركة بيع بعد تعديل الفاتورة",
          performedBy: req.user.id,
        });
      }

      invoice.items = newInvoiceItems;
      invoice.customer = customer || {};
      invoice.invoiceDiscount = Number(invoiceDiscount) || 0;
      invoice.taxRate = Number(taxRate) || 0;
      invoice.notes = String(notes || "");
      invoice.markModified("items");

      await invoice.save({ session });

      await Promise.all(
        products.map((product) => product.save({ session }))
      );

      await InventoryMovement.create(movements, { session });

      updatedInvoice = invoice;
    });

    return res.status(200).json({
      message: "تم تعديل الفاتورة وتحديث المخزون بنجاح",
      invoice: updatedInvoice,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

export const deleteInvoice = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      throw createError("معرف الفاتورة غير صالح");
    }

    await session.withTransaction(async () => {
      const invoice = await Invoice.findOne({
        _id: id,
        owner: req.user.id,
        deletedAt: null,
      }).session(session);

      if (!invoice) {
        throw createError("الفاتورة غير موجودة", 404);
      }

      const productsMap = new Map();
      const movements = [];

      if (invoice.status === "completed") {
        for (const item of invoice.items) {
          const productId = String(item.product);
          let product = productsMap.get(productId);

          if (!product) {
            product = await Product.findOne({
              _id: item.product,
              owner: req.user.id,
            }).session(session);

            if (!product) {
              throw createError(
                `تعذر حذف الفاتورة لأن المنتج ${item.productName} غير موجود`,
                409
              );
            }

            productsMap.set(productId, product);
          }

          const variant = product.variants.id(item.variant);

          if (!variant) {
            throw createError(
              `تعذر حذف الفاتورة لأن المتغير ${item.sku} غير موجود`,
              409
            );
          }

          const stockBefore = variant.stock.quantity;
          const stockAfter = stockBefore + item.quantity;

          variant.stock.quantity = stockAfter;
          product.markModified("variants");

          movements.push({
            owner: req.user.id,
            product: product._id,
            variant: variant._id,
            invoice: invoice._id,
            type: "sale_cancelled",
            quantityChange: item.quantity,
            stockBefore,
            stockAfter,
            snapshot: {
              productName: item.productName,
              sku: item.sku,
              colorName: item.color?.name || null,
              sizeCode: item.size?.code || null,
            },
            unitCost: item.unitCost,
            notes: "إعادة المخزون بسبب حذف الفاتورة",
            performedBy: req.user.id,
          });
        }
      }

      invoice.deletedAt = new Date();

      await invoice.save({ session });

      if (productsMap.size > 0) {
        await Promise.all(
          [...productsMap.values()].map((product) =>
            product.save({ session })
          )
        );
      }

      if (movements.length > 0) {
        await InventoryMovement.create(movements, { session });
      }
    });

    return res.status(200).json({
      message:
        "تم حذف الفاتورة بنجاح ومعالجة المخزون وفق حالة الفاتورة",
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};