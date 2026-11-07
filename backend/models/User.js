
import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      maxlength: 72,
      select: false,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },

    // نوع الحساب
    role: {
      type: String,
      enum: ["owner","subscriber", "demo"],
      default: "demo",
      required: true,
    },

    // حالة الحساب
    status: {
      type: String,
      enum: ["active", "expired", "suspended"],
      default: "active",
      required: true,
    },

    // بداية ونهاية التجربة المجانية
    demoStartedAt: {
      type: Date,
      default: null,
    },

    demoExpiresAt: {
      type: Date,
      default: null,
    },

    // بيانات الاشتراك المدفوع
    subscriptionStartedAt: {
      type: Date,
      default: null,
    },

    subscriptionExpiresAt: {
      type: Date,
      default: null,
    },

    // التحقق من البريد
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // إبطال الجلسات بعد تغيير كلمة المرور
    sessionVersion: {
      type: Number,
      default: 0,
      select: false,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  }
);

// فهارس فريدة
userSchema.index(
  { email: 1 },
  { unique: true, name: "user_email_unique" }
);

userSchema.index(
  { phone: 1 },
  { unique: true, name: "user_phone_unique" }
);

userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ demoExpiresAt: 1 });

// تشفير كلمة المرور قبل الحفظ
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 12);
});

// مقارنة كلمة المرور المدخلة بالتجزئة المخزنة
userSchema.methods.comparePassword = async function (
  candidatePassword
) {
  if (
    typeof candidatePassword !== "string" ||
    candidatePassword.length === 0 ||
    candidatePassword.length > 72
  ) {
    return false;
  }

  return bcrypt.compare(candidatePassword, this.password);
};

// التحقق من انتهاء الفترة التجريبية
userSchema.methods.isDemoExpired = function () {
  return (
    this.role === "demo" &&
    this.demoExpiresAt instanceof Date &&
    this.demoExpiresAt.getTime() <= Date.now()
  );
};

const User =
  mongoose.models.User ||
  mongoose.model("User", userSchema);

export default User;
