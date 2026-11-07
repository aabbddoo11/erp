import jwt from "jsonwebtoken";
import User from "../models/User.js";

const DEMO_DURATION_DAYS = 3;

const createToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET غير موجود في متغيرات البيئة");
  }

  return jwt.sign(
    {
      userId: user._id.toString(),
      sessionVersion: user.sessionVersion,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
};

const userResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  demoStartedAt: user.demoStartedAt,
  demoExpiresAt: user.demoExpiresAt,
  subscriptionStartedAt: user.subscriptionStartedAt,
  subscriptionExpiresAt: user.subscriptionExpiresAt,
  isEmailVerified: user.isEmailVerified,
});

const isSubscriptionExpired = (user) => {
  const now = new Date();

  if (
    user.role === "demo" &&
    user.demoExpiresAt &&
    user.demoExpiresAt <= now
  ) {
    return true;
  }

  if (
    user.role === "subscriber" &&
    user.subscriptionExpiresAt &&
    user.subscriptionExpiresAt <= now
  ) {
    return true;
  }

  return false;
};



// POST /api/auth/register
export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        message: "الاسم والبريد الإلكتروني وكلمة المرور ورقم الهاتف مطلوبة",
      });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { phone: normalizedPhone },
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        message:
          existingUser.email === normalizedEmail
            ? "البريد الإلكتروني مستخدم بالفعل"
            : "رقم الهاتف مستخدم بالفعل",
      });
    }

    const demoStartedAt = new Date();
    const demoExpiresAt = new Date(demoStartedAt);
    demoExpiresAt.setDate(demoExpiresAt.getDate() + DEMO_DURATION_DAYS);

    // لا تأخذ role أو status من req.body حتى لا يستطيع المستخدم إنشاء اشتراك مدفوع بنفسه
    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      phone: normalizedPhone,
      role: "demo",
      status: "active",
      demoStartedAt,
      demoExpiresAt,
    });

    const userWithSession = await User.findById(user._id)
      .select("+sessionVersion");

    const token = createToken(userWithSession);

    return res.status(201).json({
      message: "تم إنشاء الحساب التجريبي بنجاح",
      token,
      user: userResponse(userWithSession),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل",
      });
    }

    next(error);
  }
};

const expireUserIfNeeded = async (user) => {
  const now = new Date();

  const demoExpired =
    user.role === "demo" &&
    user.demoExpiresAt &&
    user.demoExpiresAt.getTime() <= now.getTime();

  const subscriptionExpired =
    user.role === "subscriber" &&
    user.subscriptionExpiresAt &&
    user.subscriptionExpiresAt.getTime() <= now.getTime();

  if (!demoExpired && !subscriptionExpired) {
    return false;
  }

  // لا تحفظ دون داعٍ إن كانت حالته منتهية سابقًا
  if (user.status !== "expired") {
    user.status = "expired";
    await user.save();
  }

  return true;
};
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "البريد الإلكتروني وكلمة المرور مطلوبان",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password +sessionVersion");

    // رسالة واحدة في الحالتين حتى لا نكشف إن كان البريد مسجلاً
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        message: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
      });
    }

    if (await expireUserIfNeeded(user)) {
      return res.status(403).json({
        message: "انتهت مدة التجربة أو الاشتراك، يرجى تجديد الحساب",
      });
    }

    if (user.status === "suspended") {
      return res.status(403).json({
        message: "تم إيقاف هذا الحساب، يرجى التواصل مع الدعم",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        message: "هذا الحساب غير نشط",
      });
    }

    const token = createToken(user);

    return res.status(200).json({
      message: "تم تسجيل الدخول بنجاح",
      token,
      user: userResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
// يتطلب authMiddleware، والذي سيضع المستخدم في req.user
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "المستخدم غير موجود",
      });
    }

    return res.status(200).json({
      user: userResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/auth/change-password
// يتطلب authMiddleware
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "كلمة المرور الحالية والجديدة مطلوبتان",
      });
    }

    if (
      typeof newPassword !== "string" ||
      newPassword.length < 8 ||
      newPassword.length > 72
    ) {
      return res.status(400).json({
        message: "كلمة المرور الجديدة يجب أن تكون بين 8 و72 حرفًا",
      });
    }

    const user = await User.findById(req.user.id)
      .select("+password +sessionVersion");

    if (!user) {
      return res.status(404).json({
        message: "المستخدم غير موجود",
      });
    }

    const isCorrectPassword = await user.comparePassword(currentPassword);

    if (!isCorrectPassword) {
      return res.status(401).json({
        message: "كلمة المرور الحالية غير صحيحة",
      });
    }

    user.password = newPassword;

    // يبطل كل التوكنات القديمة؛ middleware سيتحقق من القيمة
    user.sessionVersion += 1;

    await user.save();

    const token = createToken(user);

    return res.status(200).json({
      message: "تم تغيير كلمة المرور بنجاح",
      token,
    });
  } catch (error) {
    next(error);
  }
};