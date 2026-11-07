import mongoose, { Schema } from "mongoose";

// نحفظ بيانات رابط الصورة في R2 فقط، وليس الصورة نفسها داخل MongoDB
const imageSchema = new Schema(
  {
    key: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null, // مسار الملف داخل R2
    },
    url: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: null, // رابط CDN أو رابط موقّع
    },
    alt: {
      type: String,
      trim: true,
      maxlength: 180,
      default: "",
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    sortOrder: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

// كل Variant هو منتج قابل للبيع، مثل: قميص أسود / مقاس M
const variantSchema = new Schema(
  {
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },

    barcode: {
      type: String,
      trim: true,
      maxlength: 80,
      default: null,
    },

    color: {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 60,
      },
      hex: {
        type: String,
        trim: true,
        uppercase: true,
        match: [/^#[0-9A-F]{6}$/, "لون HEX يجب أن يكون بالشكل #RRGGBB"],
        default: null,
      },
    },

    size: {
      code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        maxlength: 30,
      },
      label: {
        type: String,
        trim: true,
        maxlength: 60,
        default: null,
      },
    },

    costPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    salePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    compareAtPrice: {
      type: Number,
      min: 0,
      default: null,
    },

    stock: {
      quantity: {
        type: Number,
        min: 0,
        default: 0,
      },
      reservedQuantity: {
        type: Number,
        min: 0,
        default: 0,
      },
      reorderPoint: {
        type: Number,
        min: 0,
        default: 0,
      },
    },

    // صورة خاصة بهذا اللون/المقاس إن لزم
    image: {
      type: imageSchema,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

const productSchema = new Schema(
  {
    // ربط المنتج بصاحب الحساب؛ يجب استخدامه في كل استعلام
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },

    productCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },

    brand: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    category: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    gender: {
      type: String,
      enum: ["men", "women", "unisex", "boys", "girls", "kids"],
      default: "unisex",
    },

    season: {
      type: String,
      enum: ["spring", "summer", "autumn", "winter", "all-season"],
      default: "all-season",
    },

    material: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },

    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 50,
      },
    ],

    // صور المنتج العامة
    images: {
      type: [imageSchema],
      default: [],
    },

    variants: {
      type: [variantSchema],
      required: true,
      validate: {
        validator: (variants) =>
          Array.isArray(variants) && variants.length > 0,
        message: "يجب إضافة متغير واحد للمنتج على الأقل",
      },
    },

    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
  },
  {
    timestamps: true,
    strict: "throw",
  }
);

// كود المنتج فريد لكل مستخدم فقط
productSchema.index(
  { owner: 1, productCode: 1 },
  {
    unique: true,
    sparse: true,
    name: "owner_product_code_unique",
  }
);

productSchema.index({ owner: 1, status: 1 });
productSchema.index({ owner: 1, category: 1 });
productSchema.index({ owner: 1, "variants.sku": 1 });
productSchema.index({ owner: 1, "variants.barcode": 1 });

// منع تكرار نفس اللون والمقاس أو SKU داخل المنتج
productSchema.pre("validate", function () {
  const combinations = new Set();
  const skus = new Set();

  for (const variant of this.variants ?? []) {
    const color = variant.color?.name?.trim().toLowerCase();
    const size = variant.size?.code?.trim().toUpperCase();
    const sku = variant.sku?.trim().toUpperCase();

    const combination = `${color}::${size}`;

    if (combinations.has(combination)) {
      this.invalidate(
        "variants",
        "لا يمكن تكرار نفس تركيبة اللون والمقاس"
      );
    }

    combinations.add(combination);

    if (skus.has(sku)) {
      this.invalidate("variants", "لا يمكن تكرار SKU داخل المنتج نفسه");
    }

    skus.add(sku);
  }
});

const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);

export default Product;