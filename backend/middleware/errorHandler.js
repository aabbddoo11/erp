const errorHandler = (err, req, res, next) => {
  console.error(err);

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || "حدث خطأ غير متوقع في الخادم";

  // MongoDB: تكرار قيمة في حقل فريد
  if (err.code === 11000) {
    statusCode = 409;

    const field = Object.keys(err.keyValue || {})[0];

    message = field
      ? `القيمة المدخلة في حقل ${field} مستخدمة بالفعل`
      : "هذه القيمة مستخدمة بالفعل";
  }

  // Mongoose: فشل التحقق من بيانات الموديل
  if (err.name === "ValidationError") {
    statusCode = 400;

    message = Object.values(err.errors)
      .map((item) => item.message)
      .join("، ");
  }

  // Mongoose: ObjectId غير صالح
  if (err.name === "CastError") {
    statusCode = 400;
    message = `القيمة المدخلة للحقل ${err.path} غير صالحة`;
  }

  // strict: throw في Mongoose عند إرسال حقل غير مسموح
  if (err.name === "StrictModeError") {
    statusCode = 400;
    message = "تم إرسال حقل غير مسموح به";
  }

  // أخطاء JWT الاحتياطية
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "رمز الدخول غير صالح";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "انتهت صلاحية رمز الدخول، يرجى تسجيل الدخول مجددًا";
  }

  const response = {
    message,
  };

  // يظهر الـstack في التطوير فقط، ولا يظهر في الإنتاج
  if (process.env.NODE_ENV !== "production") {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export default errorHandler;