
export const ownerOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "owner") {
    return res.status(403).json({
      message: "غير مصرح لك بالوصول إلى هذه الوظيفة",
    });
  }

  next();
};
