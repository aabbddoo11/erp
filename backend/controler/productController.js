import mongoose from "mongoose";
import Product from "../models/Product.js";

const PRODUCT_FIELDS = [
  "name",
  "productCode",
  "description",
  "brand",
  "category",
  "gender",
  "season",
  "material",  "variants",
  "tags",
  "images",
 
  "status",
  "notes",
];

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isValidId = (id) => mongoose.isValidObjectId(id);

const handleDuplicateKeyError = (error, res) => {
  if (error?.code !== 11000) return false;

  const field = Object.keys(error.keyPattern ?? {}).find(
    (key) => key !== "owner"
  );

  const value = field ? error.keyValue?.[field] : "";

  res.status(409).json({
    message: `القيمة مكررة في الحقل: ${field || "غير معروف"}${
      value ? ` (${value})` : ""
    }`,
  });

  return true;
};

const getAllowedProductData = (body) => {
  const data = {};

  for (const field of PRODUCT_FIELDS) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }

  return data;
};

// POST /api/products
export const createProduct = async (req, res, next) => {
  try {
    const productData = getAllowedProductData(req.body);

    if (!productData.name) {
      return res.status(400).json({
        message: "اسم المنتج مطلوب",
      });
    }

    if (
      !Array.isArray(productData.variants) ||
      productData.variants.length === 0
    ) {
      return res.status(400).json({
        message: "يجب إضافة لون ومقاس واحد على الأقل للمنتج",
      });
    }

    // owner لا يأتي من الواجهة؛ يؤخذ دائمًا من التوكن
    const product = await Product.create({
      ...productData,
      owner: req.user.id,
    });

    return res.status(201).json({
      message: "تم إنشاء المنتج بنجاح",
      product,
    });
  } catch (error) {
    if (handleDuplicateKeyError(error, res)) return;
    next(error);
  }
};

// GET /api/products?page=1&limit=20&status=active&search=shirt
export const getProducts = async (req, res, next) => {
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
    } else {
      // لا نعرض المؤرشف افتراضيًا
      filter.status = { $ne: "archived" };
    }

    if (req.query.category) {
      filter.category = req.query.category.trim();
    }

    if (req.query.search?.trim()) {
      const search = new RegExp(
        escapeRegex(req.query.search.trim()),
        "i"
      );

      filter.$or = [
        { name: search },
        { productCode: search },
        { brand: search },
        { "variants.sku": search },
        { "variants.barcode": search },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      products,
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

// GET /api/products/:id
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: "معرف المنتج غير صالح",
      });
    }

    const product = await Product.findOne({
      _id: id,
      owner: req.user.id,
    });

    if (!product) {
      return res.status(404).json({
        message: "المنتج غير موجود",
      });
    }

    return res.status(200).json({ product });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/products/:id
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: "معرف المنتج غير صالح",
      });
    }

    const product = await Product.findOne({
      _id: id,
      owner: req.user.id,
    });

    if (!product) {
      return res.status(404).json({
        message: "المنتج غير موجود",
      });
    }

    if (product.status === "archived") {
      return res.status(409).json({
        message: "لا يمكن تعديل منتج مؤرشف، فعّله أولًا",
      });
    }

    const updates = getAllowedProductData(req.body);

    // owner لا يمكن تغييره؛ وحتى لو أرسله العميل فسيتم تجاهله
    for (const [field, value] of Object.entries(updates)) {
      product.set(field, value);
    }

    // save يفعّل validators وpre("validate") في Product model
    await product.save();

    return res.status(200).json({
      message: "تم تحديث المنتج بنجاح",
      product,
    });
  } catch (error) {
    if (handleDuplicateKeyError(error, res)) return;
    next(error);
  }
};

// PATCH /api/products/:id/archive
export const archiveProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: "معرف المنتج غير صالح",
      });
    }

    const product = await Product.findOne({
      _id: id,
      owner: req.user.id,
    });

    if (!product) {
      return res.status(404).json({
        message: "المنتج غير موجود",
      });
    }

    product.status = "archived";
    await product.save();

    return res.status(200).json({
      message: "تم أرشفة المنتج بنجاح",
      product,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: "معرف المنتج غير صالح",
      });
    }

    const product = await Product.findOne({
      _id: id,
      owner: req.user.id,
    });

    if (!product) {
      return res.status(404).json({
        message: "المنتج غير موجود",
      });
    }

    await product.deleteOne();

    return res.status(200).json({
      message: "تم حذف المنتج بنجاح",
      deletedId: id,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProducts = async (req, res, next) => {
  try {
    const { productIds } = req.body;

    if (
      !Array.isArray(productIds) ||
      productIds.length === 0 ||
      productIds.length > 100
    ) {
      return res.status(400).json({
        message: "يجب إرسال قائمة منتجات صحيحة، بحد أقصى 100 منتج",
      });
    }

    if (!productIds.every((id) => isValidId(id))) {
      return res.status(400).json({
        message: "تحتوي القائمة على معرف منتج غير صالح",
      });
    }

    const products = await Product.find({
      _id: { $in: productIds },
      owner: req.user.id,
    }).select("_id");

    const deletedIds = products.map((product) => product._id.toString());

    await Product.deleteMany({
      _id: { $in: deletedIds },
      owner: req.user.id,
    });

    return res.status(200).json({
      message: `تم حذف ${deletedIds.length} منتج بنجاح`,
      deletedIds,
    });
  } catch (error) {
    next(error);
  }
};