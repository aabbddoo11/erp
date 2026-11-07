import mongoose, { Schema } from "mongoose";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

const purchaseItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // معرف اللون/المقاس داخل Product.variants
    variant: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    // لقطة لبيانات المنتج وقت الشراء
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

    color: {
      name: {
        type: String,
        trim: true,
        maxlength: 60,
        default: null,
      },
      hex: {
        type: String,
        trim: true,
        uppercase: true,
        default: null,
      },
    },

    size: {
      code: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 30,
        default: null,
      },
      label: {
        type: String,
        trim: true,
        maxlength: 60,
        default: null,
      },
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "كمية الشراء يجب أن تكون عددًا صحيحًا",
      },
    },

    // تكلفة القطعة عند شرائها
    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },

    lineTotal: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const purchaseSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    purchaseNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
      immutable: true,
    },

    // رقم الإيصال أو الفاتورة الخارجية اختياري
    referenceNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    items: {
      type: [purchaseItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "يجب أن يحتوي سند الشراء على منتج واحد على الأقل",
      },
    },

    totalCost: {
      type: Number,
      min: 0,
      default: 0,
    },

    paidAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    dueAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "unpaid",
    },

    status: {
      type: String,
      enum: ["draft", "completed", "cancelled"],
      default: "draft",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    completedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  }
);

// رقم الشراء فريد لكل مستخدم
purchaseSchema.index(
  { owner: 1, purchaseNumber: 1 },
  { unique: true, name: "owner_purchase_number_unique" }
);

purchaseSchema.index({ owner: 1, status: 1, createdAt: -1 });
purchaseSchema.index({ owner: 1, createdAt: -1 });

// حساب إجماليات الشراء تلقائيًا
purchaseSchema.pre("validate", function () {
  let totalCost = 0;

  for (const item of this.items ?? []) {
    item.lineTotal = money(item.quantity * item.unitCost);
    totalCost += item.lineTotal;
  }

  this.totalCost = money(totalCost);

  if (this.paidAmount > this.totalCost) {
    this.invalidate(
      "paidAmount",
      "المبلغ المدفوع لا يمكن أن يكون أكبر من إجمالي الشراء"
    );
  }

  this.dueAmount = money(this.totalCost - this.paidAmount);

  if (this.paidAmount === 0) {
    this.paymentStatus = "unpaid";
  } else if (this.paidAmount < this.totalCost) {
    this.paymentStatus = "partial";
  } else {
    this.paymentStatus = "paid";
  }

  if (this.status === "completed") {
    this.completedAt ??= new Date();
  }
});

const Purchase =
  mongoose.models.Purchase || mongoose.model("Purchase", purchaseSchema);

export default Purchase;