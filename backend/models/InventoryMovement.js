import mongoose, { Schema } from "mongoose";

const movementTypes = [
  "sale",
  "sale_cancelled",
  "purchase",
  "purchase_cancelled",
  "customer_return",
  "supplier_return",
  "adjustment_in",
  "adjustment_out",
];

const stockSnapshotSchema = new Schema(
  {
    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },

    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },

    colorName: {
      type: String,
      trim: true,
      maxlength: 60,
      default: null,
    },

    sizeCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 30,
      default: null,
    },
  },
  { _id: false }
);

const inventoryMovementSchema = new Schema(
  {
    // صاحب المحل؛ يستخدم دائمًا في الاستعلامات
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true,
    },

    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      immutable: true,
    },

    // معرف الـvariant داخل Product.variants
    variant: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },

    // اختياري: يكون موجودًا إذا كانت الحركة ناتجة عن فاتورة بيع
    invoice: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      immutable: true,
    },
purchase: {
  type: Schema.Types.ObjectId,
  ref: "Purchase",
  immutable: true,
},
    type: {
      type: String,
      enum: movementTypes,
      required: true,
      immutable: true,
    },

    /*
      قيمة موجبة: زيادة مخزون
      قيمة سالبة: خصم مخزون

      أمثلة:
      sale: -2
      sale_cancelled: +2
      purchase: +10
      customer_return: +1
    */
    quantityChange: {
      type: Number,
      required: true,
      validate: {
        validator: (value) =>
          Number.isInteger(value) && value !== 0,
        message: "تغير الكمية يجب أن يكون عددًا صحيحًا وغير صفر",
      },
      immutable: true,
    },

    // قيمة المخزون قبل وبعد تنفيذ الحركة، للمراجعة والتدقيق
    stockBefore: {
      type: Number,
      required: true,
      min: 0,
      immutable: true,
    },

    stockAfter: {
      type: Number,
      required: true,
      min: 0,
      immutable: true,
    },

    // لقطة من بيانات المنتج وقت الحركة، مفيدة لو تغير اسم المنتج لاحقًا
    snapshot: {
      type: stockSnapshotSchema,
      required: true,
      immutable: true,
    },

    // تكلفة القطعة وقت الحركة، لتقارير الأرباح لاحقًا
    unitCost: {
      type: Number,
      min: 0,
      default: null,
      immutable: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
      immutable: true,
    },

    // المستخدم أو الموظف الذي نفذ العملية
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  }
);

// منع تناقض اتجاه الكمية مع نوع الحركة
inventoryMovementSchema.pre("validate", function () {
  const outgoingTypes = [
    "sale",
    "purchase_cancelled",
    "supplier_return",
    "adjustment_out",
  ];

  const incomingTypes = [
    "sale_cancelled",
    "purchase",
    "customer_return",
    "adjustment_in",
  ];

  if (
    outgoingTypes.includes(this.type) &&
    this.quantityChange >= 0
  ) {
    this.invalidate(
      "quantityChange",
      `نوع الحركة ${this.type} يجب أن يحتوي كمية سالبة`
    );
  }

  if (
    incomingTypes.includes(this.type) &&
    this.quantityChange <= 0
  ) {
    this.invalidate(
      "quantityChange",
      `نوع الحركة ${this.type} يجب أن يحتوي كمية موجبة`
    );
  }

  if (this.stockAfter !== this.stockBefore + this.quantityChange) {
    this.invalidate(
      "stockAfter",
      "المخزون بعد الحركة يجب أن يساوي المخزون السابق مع تغير الكمية"
    );
  }
});

inventoryMovementSchema.index({
  owner: 1,
  product: 1,
  variant: 1,
  createdAt: -1,
});

inventoryMovementSchema.index({
  owner: 1,
  invoice: 1,
  createdAt: -1,
});

inventoryMovementSchema.index(
  {
    owner: 1,
    invoice: 1,
    variant: 1,
    type: 1,
  },
  
  {
    unique: true,
    partialFilterExpression: {
      invoice: { $exists: true },
    },
    name: "invoice_variant_movement_unique",
  }
);
inventoryMovementSchema.index({
  owner: 1,
  purchase: 1,
  createdAt: -1,
});

inventoryMovementSchema.index(
  {
    owner: 1,
    purchase: 1,
    variant: 1,
    type: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      purchase: { $exists: true },
    },
    name: "purchase_variant_movement_unique",
  }
);
const InventoryMovement =
  mongoose.models.InventoryMovement ||
  mongoose.model("InventoryMovement", inventoryMovementSchema);

export default InventoryMovement;