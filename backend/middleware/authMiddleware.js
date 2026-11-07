import jwt from "jsonwebtoken";
import User from "../models/User.js";

const expireUserIfNeeded = async (user) => {
  const now = Date.now();

  const expiresAt =
    user.role === "demo"
      ? user.demoExpiresAt
      : user.role === "subscriber"
        ? user.subscriptionExpiresAt
        : null;

  // لا يوجد تاريخ انتهاء للحساب
  if (!expiresAt) {
    return false;
  }

  // الحساب ما زال صالحًا
  if (expiresAt.getTime() > now) {
    return false;
  }

  // انتهت الصلاحية: حدّث الحالة وأبطل التوكنات السابقة
  if (user.status !== "expired") {
    user.status = "expired";
    user.sessionVersion += 1;

    await user.save();
  }

  return true;
};

// حماية أي route يتطلب تسجيل دخول
export const protect = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "يجب تسجيل الدخول للوصول إلى هذا المورد",
      });
    }

    const token = authorization.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "رمز الدخول غير موجود",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET غير موجود في متغيرات البيئة");
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(payload.userId).select(
      "+sessionVersion"
    );

    if (!user) {
      return res.status(401).json({
        message: "المستخدم المرتبط برمز الدخول غير موجود",
      });
    }

    // يقارن تاريخ الانتهاء بالوقت الحالي ويحدّث الحالة تلقائيًا
    if (await expireUserIfNeeded(user)) {
      return res.status(403).json({
        message:
          "انتهت مدة التجربة أو الاشتراك. يرجى تجديد الحساب للدخول.",
      });
    }

    // في حال كان قد تم وضع الحساب كمنتهي مسبقًا
    if (user.status === "expired") {
      return res.status(403).json({
        message:
          "انتهت مدة التجربة أو الاشتراك. يرجى تجديد الحساب للدخول.",
      });
    }

    // يبطل التوكنات الصادرة قبل تغيير كلمة المرور أو انتهاء الاشتراك
    if (user.sessionVersion !== payload.sessionVersion) {
      return res.status(401).json({
        message: "انتهت الجلسة، يرجى تسجيل الدخول مجددًا",
      });
    }

    if (user.status === "suspended") {
      return res.status(403).json({
        message: "تم إيقاف هذا الحساب، يرجى التواصل مع الدعم",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        message: "الحساب غير نشط",
      });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "انتهت صلاحية رمز الدخول، يرجى تسجيل الدخول مجددًا",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "رمز الدخول غير صالح",
      });
    }

    next(error);
  }
};