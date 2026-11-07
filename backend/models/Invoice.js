import mongoose, { Schema } from "mongoose";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

const customerSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "عميل نقدي",
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: null,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: null,
    },
  },
  { _id: false }
);

const invoiceItemSchema = new Schema(
  {
    // روابط اختيارية، لكن بيانات المنتج أدناه تبقى محفوظة حتى إذا تغير المنتج لاحقًا
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variant: {
      type: Schema.Types.ObjectId,
      required: true,
    },

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
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // تكلفة القطعة وقت البيع، مهمة لاحقًا لتقرير الأرباح
    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },

    // خصم هذا السطر فقط، بقيمة نقدية وليس نسبة مئوية
    discount: {
      type: Number,
      min: 0,
      default: 0,
    },

    lineTotal: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const paymentSchema = new Schema(
  {
    method: {
      type: String,
      enum: ["cash", "card", "bank_transfer", "wallet", "mixed"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    reference: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    paidAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const invoiceSchema = new Schema(
  {
    // مالك الفاتورة: لا تسمح أبدًا بالاستعلام عن فاتورة بدون owner
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true,
    },

    // الموظف أو الكاشير الذي أنشأ الفاتورة
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
      immutable: true,
    },

    customer: {
      type: customerSchema,
      default: () => ({}),
    },

    items: {
      type: [invoiceItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "يجب أن تحتوي الفاتورة على منتج واحد على الأقل",
      },
    },

    subtotal: {
      type: Number,
      min: 0,
      default: 0,
    },

    itemsDiscount: {
      type: Number,
      min: 0,
      default: 0,
    },

    // خصم كامل الفاتورة
    invoiceDiscount: {
      type: Number,
      min: 0,
      default: 0,
    },

    taxRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    taxAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    total: {
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

    changeAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    payments: {
      type: [paymentSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ["draft", "completed", "cancelled", "partially_returned", "returned"],
      default: "draft",
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid", "refunded"],
      default: "unpaid",
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
    
deletedAt: {
  type: Date,
  default: null,
},

  },
  {
    timestamps: true,
    strict: "throw",
  }
);

// رقم الفاتورة فريد لكل مستخدم/محل
invoiceSchema.index(
  { owner: 1, invoiceNumber: 1 },
  { unique: true, name: "owner_invoice_number_unique" }
);

invoiceSchema.index({ owner: 1, status: 1, createdAt: -1 });
invoiceSchema.index({ owner: 1, paymentStatus: 1, createdAt: -1 });
invoiceSchema.index({ owner: 1, "customer.phone": 1 });

// حساب الإجماليات تلقائيًا قبل الحفظ
invoiceSchema.pre("validate", function () {
  let subtotal = 0;
  let itemsDiscount = 0;

  for (const item of this.items ?? []) {
    const rawLineTotal = item.quantity * item.unitPrice;
    const discount = money(item.discount);

    if (discount > rawLineTotal) {
      this.invalidate(
        "items",
        `خصم المنتج ${item.productName} لا يمكن أن يكون أكبر من قيمته`
      );
    }

    item.lineTotal = money(Math.max(0, rawLineTotal - discount));
    subtotal += rawLineTotal;
    itemsDiscount += discount;
  }

  this.subtotal = money(subtotal);
  this.itemsDiscount = money(itemsDiscount);

  const totalDiscount = this.itemsDiscount + money(this.invoiceDiscount);

  if (totalDiscount > this.subtotal) {
    this.invalidate(
      "invoiceDiscount",
      "إجمالي الخصم لا يمكن أن يكون أكبر من إجمالي الفاتورة"
    );
  }

  const taxableAmount = Math.max(0, this.subtotal - totalDiscount);

  this.taxAmount = money(taxableAmount * (this.taxRate / 100));
  this.total = money(taxableAmount + this.taxAmount);

  this.paidAmount = money(
    (this.payments ?? []).reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    )
  );

  this.dueAmount = money(Math.max(0, this.total - this.paidAmount));
  this.changeAmount = money(Math.max(0, this.paidAmount - this.total));

  if (this.status === "completed") {
    this.completedAt ??= new Date();

    if (this.paidAmount === 0) {
      this.paymentStatus = "unpaid";
    } else if (this.paidAmount < this.total) {
      this.paymentStatus = "partial";
    } else {
      this.paymentStatus = "paid";
    }
  }
});

const Invoice =
  mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);

export default Invoice;