
import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";

const router = express.Router();

router.post("/create-owner", async (req, res) => {
  try {
    // لا تسمح بالتنفيذ إذا كانت قاعدة البيانات غير متصلة
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: "قاعدة البيانات غير متصلة",
      });
    }

    const { name, email, phone, password, bootstrapKey } = req.body;

    // مفتاح سري موجود في ملف البيئة
    if (
      !process.env.BOOTSTRAP_KEY ||
      !bootstrapKey ||
      bootstrapKey !== process.env.BOOTSTRAP_KEY
    ) {
      return res.status(403).json({
        message: "غير مصرح بتنفيذ العملية",
      });
    }

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        message: "جميع الحقول مطلوبة",
      });
    }

    if (password.length < 12 || password.length > 72) {
      return res.status(400).json({
        message: "يجب أن تكون كلمة المرور بين 12 و72 حرفًا",
      });
    }

    const existingOwner = await User.exists({ role: "owner" });

    if (existingOwner) {
      return res.status(409).json({
        message: "يوجد حساب مالك بالفعل",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    const existingUser = await User.exists({
      $or: [
        { email: normalizedEmail },
        { phone: normalizedPhone },
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        message: "البريد الإلكتروني أو الهاتف مستخدم بالفعل",
      });
    }

    const owner = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password,
      role: "owner",
      status: "active",
      demoStartedAt: null,
      demoExpiresAt: null,
      subscriptionStartedAt: null,
      subscriptionExpiresAt: null,
      isEmailVerified: false,
    });

    return res.status(201).json({
      message: "تم إنشاء حساب المالك بنجاح",
      user: {
        id: owner._id,
        name: owner.name,
        email: owner.email,
        role: owner.role,
      },
    });
  } catch (error) {
    console.error("Create owner error:", error.message);

    return res.status(500).json({
      message: "حدث خطأ أثناء إنشاء الحساب",
    });
  }
});

export default router;
