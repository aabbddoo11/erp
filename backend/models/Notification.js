
import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema(
  {
    // صاحب حساب الـ ERP الذي سيشاهد الإشعار
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "invoice_created",
        "low_stock",
        "subscription_warning",
        "subscription_expired",
        "payment_received",
        "system",
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    // رابط داخلي اختياري للانتقال إلى الصفحة ذات الصلة
    link: {
      type: String,
      default: null,
      maxlength: 300,
    },

    entityId: {
      type: Schema.Types.ObjectId,
      default: null,
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },

    // لمنع إنشاء التنبيه نفسه بصورة متكررة
    dedupeKey: {
      type: String,
      default: null,
      maxlength: 250,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  }
);

notificationSchema.index({ owner: 1, createdAt: -1 });
notificationSchema.index({ owner: 1, isRead: 1, createdAt: -1 });

notificationSchema.index(
  { owner: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: "string" } },
    name: "owner_notification_dedupe_unique",
  }
);

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;
