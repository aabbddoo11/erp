import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
async function createFirstOwner() {
  try {
    const { OWNER_NAME, OWNER_EMAIL, OWNER_PHONE, OWNER_PASSWORD, MONGO_URI } =
      process.env;

    // التأكد من وجود البيانات المطلوبة
    if (
      !MONGO_URI ||
      !OWNER_NAME ||
      !OWNER_EMAIL ||
      !OWNER_PHONE ||
      !OWNER_PASSWORD
    ) {
      throw new Error("تأكد من إعداد متغيرات البيئة المطلوبة.");
    }

    // التحقق من قوة كلمة المرور
    if (
      OWNER_PASSWORD.length < 12 ||
      OWNER_PASSWORD.length > 72
    ) {
      throw new Error(
        "يجب أن تكون كلمة المرور بين 12 و72 حرفًا."
      );
    }

    await mongoose.connect(MONGO_URI);

    // منع إنشاء مالك إضافي بهذا السكريبت
    const existingOwner = await User.exists({ role: "owner" });

    if (existingOwner) {
      throw new Error(
        "يوجد حساب مالك بالفعل. تم إلغاء العملية."
      );
    }

    const email = OWNER_EMAIL.trim().toLowerCase();

    // التأكد من عدم تعارض البريد أو الهاتف مع حساب موجود
    const existingAccount = await User.exists({
      $or: [
        { email },
        { phone: OWNER_PHONE.trim() },
      ],
    });

    if (existingAccount) {
      throw new Error(
        "البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل."
      );
    }

    // ينفذ نموذج User تشفير كلمة المرور تلقائيًا
    const owner = await User.create({
      name: OWNER_NAME.trim(),
      email,
      phone: OWNER_PHONE.trim(),
      password: OWNER_PASSWORD,
      role: "owner",
      status: "active",
      demoStartedAt: null,
      demoExpiresAt: null,
      subscriptionStartedAt: null,
      subscriptionExpiresAt: null,
      isEmailVerified: false,
    });

    console.log("تم إنشاء حساب المالك الأول بنجاح.");
    console.log(`البريد الإلكتروني: ${owner.email}`);
    console.log(`معرّف الحساب: ${owner._id}`);
  } catch (error) {
    console.error("فشل إنشاء حساب المالك:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

createFirstOwner();
