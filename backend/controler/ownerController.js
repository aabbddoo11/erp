
import mongoose from "mongoose";
import User from "../models/User.js";

const MAX_DURATION_DAYS = 3650;
const EXPIRING_SOON_DAYS = 7;

const allowedAccountRoles = new Set(["demo", "subscriber"]);

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

const normalizePhone = (phone) =>
  typeof phone === "string" ? phone.trim() : "";

const isValidDuration = (days) =>
  Number.isInteger(days) &&
  days >= 1 &&
  days <= MAX_DURATION_DAYS;

const getExpiryField = (role) =>
  role === "demo" ? "demoExpiresAt" : "subscriptionExpiresAt";

const getStartField = (role) =>
  role === "demo" ? "demoStartedAt" : "subscriptionStartedAt";

const getAccountExpiry = (user) =>
  user.role === "demo"
    ? user.demoExpiresAt
    : user.role === "subscriber"
      ? user.subscriptionExpiresAt
      : null;

const isExpiredByDate = (user, now = new Date()) => {
  const expiry = getAccountExpiry(user);

  return expiry instanceof Date && expiry <= now;
};

const isValidObjectId = (id) =>
  mongoose.isValidObjectId(id);

const handleDatabaseError = (error, res, next) => {
  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];

    return res.status(409).json({
      message:
        field === "email"
          ? "البريد الإلكتروني مستخدم بالفعل"
          : field === "phone"
            ? "رقم الهاتف مستخدم بالفعل"
            : "توجد بيانات مكررة في الحساب",
    });
  }

  return next(error);
};

const accountResponse = (user) => ({
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
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// POST /api/owner/accounts
// إنشاء حساب تجريبي أو حساب اشتراك
export const createAccount = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
      accountType,
      durationDays,
    } = req.body;

    const selectedRole = accountType ?? role;
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 50
    ) {
      return res.status(400).json({
        message: "الاسم يجب أن يكون بين حرفين و50 حرفًا",
      });
    }

    if (
      !normalizedEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return res.status(400).json({
        message: "يرجى إدخال بريد إلكتروني صحيح",
      });
    }

    if (
      !normalizedPhone ||
      normalizedPhone.length > 20
    ) {
      return res.status(400).json({
        message: "يرجى إدخال رقم هاتف صحيح",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 72
    ) {
      return res.status(400).json({
        message: "كلمة المرور يجب أن تكون بين 8 و72 حرفًا",
      });
    }

    if (!allowedAccountRoles.has(selectedRole)) {
      return res.status(400).json({
        message: "نوع الحساب يجب أن يكون demo أو subscriber",
      });
    }

    if (!isValidDuration(durationDays)) {
      return res.status(400).json({
        message: `مدة الحساب يجب أن تكون عددًا صحيحًا بين 1 و${MAX_DURATION_DAYS} يوم`,
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { phone: normalizedPhone },
      ],
    }).select("_id email phone");

    if (existingUser) {
      return res.status(409).json({
        message:
          existingUser.email === normalizedEmail
            ? "البريد الإلكتروني مستخدم بالفعل"
            : "رقم الهاتف مستخدم بالفعل",
      });
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const userData = {
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password,
      role: selectedRole,
      status: "active",
      isEmailVerified: false,
    };

    userData[getStartField(selectedRole)] = now;
    userData[getExpiryField(selectedRole)] = expiresAt;

    const user = await User.create(userData);

    return res.status(201).json({
      message: "تم إنشاء الحساب بنجاح",
      account: accountResponse(user),
    });
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
};

// GET /api/owner/accounts
// عرض الحسابات مع البحث والتصفية والترقيم
export const getAccounts = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        message: "قيم الصفحة أو عدد النتائج غير صحيحة",
      });
    }

    const filter = {};

    const { role, status, search } = req.query;

    if (role !== undefined) {
      if (!allowedAccountRoles.has(role)) {
        return res.status(400).json({
          message: "نوع الحساب غير صحيح",
        });
      }

      filter.role = role;
    }

  if (status !== undefined) {
  if (!["active", "expired", "suspended"].includes(status)) {
    return res.status(400).json({
      message: "حالة الحساب غير صحيحة",
    });
  }

  if (status === "expired") {
    const now = new Date();

    filter.$and = [
      {
        $or: [
          { status: "expired" },
          {
            role: "demo",
            demoExpiresAt: { $lte: now },
          },
          {
            role: "subscriber",
            subscriptionExpiresAt: { $lte: now },
          },
        ],
      },
    ];
  } else {
    filter.status = status;
  }
}

    if (typeof search === "string" && search.trim()) {
      const escapedSearch = search.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const searchRegex = new RegExp(escapedSearch, "i");

      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    const [accounts, total] = await Promise.all([
      User.find(filter)
        .select("-password -sessionVersion")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      User.countDocuments(filter),
    ]);

    const now = new Date();

    const results = accounts.map((account) => ({
      ...account,
      // توضيح الانتهاء الفعلي حتى لو لم يجرِ تحديث status بعد
      isExpired:
        account.role === "demo"
          ? Boolean(
              account.demoExpiresAt &&
              new Date(account.demoExpiresAt) <= now
            )
          : Boolean(
              account.subscriptionExpiresAt &&
              new Date(account.subscriptionExpiresAt) <= now
            ),
    }));

    return res.status(200).json({
      accounts: results,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/owner/accounts/:id
// تفاصيل حساب واحد
export const getAccountById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "معرّف الحساب غير صحيح",
      });
    }

    const user = await User.findById(id).select(
      "-password -sessionVersion"
    );

    if (!user || user.role === "owner") {
      return res.status(404).json({
        message: "الحساب غير موجود",
      });
    }

    return res.status(200).json({
      account: {
        ...accountResponse(user),
        isExpired: isExpiredByDate(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/owner/accounts/:id
// تعديل البيانات أو تغيير نوع الحساب أو تمديد المدة
export const updateAccount = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "معرّف الحساب غير صحيح",
      });
    }

    const user = await User.findById(id);

    if (!user || user.role === "owner") {
      return res.status(404).json({
        message: "الحساب غير موجود",
      });
    }

    const {
      name,
      email,
      phone,
      role,
      accountType,
      durationDays,
    } = req.body;

    const selectedRole = accountType ?? role;

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 50
      ) {
        return res.status(400).json({
          message: "الاسم يجب أن يكون بين حرفين و50 حرفًا",
        });
      }

      user.name = name.trim();
    }

    if (email !== undefined) {
      const normalizedEmail = normalizeEmail(email);

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
      ) {
        return res.status(400).json({
          message: "البريد الإلكتروني غير صحيح",
        });
      }

      user.email = normalizedEmail;
    }

    if (phone !== undefined) {
      const normalizedPhone = normalizePhone(phone);

      if (!normalizedPhone || normalizedPhone.length > 20) {
        return res.status(400).json({
          message: "رقم الهاتف غير صحيح",
        });
      }

      user.phone = normalizedPhone;
    }

    if (
      selectedRole !== undefined &&
      !allowedAccountRoles.has(selectedRole)
    ) {
      return res.status(400).json({
        message: "نوع الحساب يجب أن يكون demo أو subscriber",
      });
    }

    const roleChanged =
      selectedRole !== undefined && selectedRole !== user.role;

    if (roleChanged && durationDays === undefined) {
      return res.status(400).json({
        message: "حدد مدة جديدة عند تغيير نوع الحساب",
      });
    }

    if (durationDays !== undefined) {
      if (!isValidDuration(durationDays)) {
        return res.status(400).json({
          message: `مدة الحساب يجب أن تكون عددًا صحيحًا بين 1 و${MAX_DURATION_DAYS} يوم`,
        });
      }
    }

    if (roleChanged || durationDays !== undefined) {
      const newRole = selectedRole ?? user.role;
      const now = new Date();
      const expiresAt = new Date(now);

      expiresAt.setDate(expiresAt.getDate() + durationDays);

      user.role = newRole;

      // إزالة تواريخ النوع السابق حتى لا تختلط بيانات التجربة والاشتراك
      user.demoStartedAt = null;
      user.demoExpiresAt = null;
      user.subscriptionStartedAt = null;
      user.subscriptionExpiresAt = null;

      user[getStartField(newRole)] = now;
      user[getExpiryField(newRole)] = expiresAt;

      // لا نرفع التعليق إلا بطلب صريح؛ الحساب المنتهي يُفعّل بعد تجديده
      if (user.status === "expired") {
        user.status = "active";
      }
    }

    await user.save();

    return res.status(200).json({
      message: "تم تحديث الحساب بنجاح",
      account: accountResponse(user),
    });
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
};

// PATCH /api/owner/accounts/:id/status
// تعليق الحساب أو إعادة تفعيله
export const updateAccountStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "معرّف الحساب غير صحيح",
      });
    }

    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({
        message: "الحالة المسموحة هي active أو suspended",
      });
    }

const user = await User.findById(id).select("+sessionVersion");

    if (!user || user.role === "owner") {
      return res.status(404).json({
        message: "الحساب غير موجود",
      });
    }

    if (status === "active" && isExpiredByDate(user)) {
      return res.status(400).json({
        message: "انتهت مدة الحساب. مدّد المدة أولًا قبل إعادة التفعيل",
      });
    }

    user.status = status;

    // إبطال الجلسات الحالية عند تعليق الحساب
    if (status === "suspended") {
      user.sessionVersion += 1;
    }

    await user.save();

    return res.status(200).json({
      message:
        status === "suspended"
          ? "تم تعليق الحساب"
          : "تم تفعيل الحساب",
      account: accountResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/owner/dashboard
// إحصائيات لوحة تحكم المالك
export const getDashboardStats = async (req, res, next) => {
  try {
    const now = new Date();
    const soon = new Date(now);

    soon.setDate(soon.getDate() + EXPIRING_SOON_DAYS);

    const expiryCondition = {
      $or: [
        {
          role: "demo",
          demoExpiresAt: { $lte: now },
        },
        {
          role: "subscriber",
          subscriptionExpiresAt: { $lte: now },
        },
      ],
    };

    const activeDemo = {
      role: "demo",
      status: "active",
      demoExpiresAt: { $gt: now },
    };

    const activeSubscriber = {
      role: "subscriber",
      status: "active",
      subscriptionExpiresAt: { $gt: now },
    };

    const expiringSoon = {
      status: "active",
      $or: [
        {
          role: "demo",
          demoExpiresAt: { $gt: now, $lte: soon },
        },
        {
          role: "subscriber",
          subscriptionExpiresAt: { $gt: now, $lte: soon },
        },
      ],
    };

    const [
      totalAccounts,
      totalDemos,
      totalSubscribers,
      activeDemos,
      activeSubscribers,
      expiredAccounts,
      suspendedAccounts,
      expiringAccounts,
    ] = await Promise.all([
      User.countDocuments({
        role: { $in: ["demo", "subscriber"] },
      }),

      User.countDocuments({ role: "demo" }),

      User.countDocuments({ role: "subscriber" }),

      User.countDocuments(activeDemo),

      User.countDocuments(activeSubscriber),

      User.countDocuments({
        $or: [
          { status: "expired" },
          {
            status: "active",
            ...expiryCondition,
          },
        ],
      }),

      User.countDocuments({ status: "suspended" }),

      User.countDocuments(expiringSoon),
    ]);

    return res.status(200).json({
      stats: {
        totalAccounts,
        totalDemos,
        totalSubscribers,
        activeDemos,
        activeSubscribers,
        activeAccounts: activeDemos + activeSubscribers,
        expiredAccounts,
        suspendedAccounts,
        expiringWithin7Days: expiringAccounts,
      },
    });
  } catch (error) {
    next(error);
  }
};
// DELETE /api/owner/accounts/:id
// حذف حساب تجريبي أو حساب اشتراك نهائيًا
export const deleteAccount = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "معرّف الحساب غير صحيح",
      });
    }

    const user = await User.findById(id);

    if (!user || user.role === "owner") {
      return res.status(404).json({
        message: "الحساب غير موجود",
      });
    }

    await User.deleteOne({ _id: user._id });

    return res.status(200).json({
      message: "تم حذف الحساب نهائيًا",
      id: user._id,
    });
  } catch (error) {
    next(error);
  }
};