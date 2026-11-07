
import mongoose from "mongoose";
import Notification from "../models/Notification.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// GET /api/notifications
export const getNotifications = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
      50
    );

    const owner = req.user.id;

    const [notifications, unreadCount, total] = await Promise.all([
      Notification.find({ owner })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Notification.countDocuments({ owner, isRead: false }),

      Notification.countDocuments({ owner }),
    ]);

    res.status(200).json({
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/:id/read
export const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      throw createError("معرف الإشعار غير صالح");
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, owner: req.user.id },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true, runValidators: true }
    );

    if (!notification) {
      throw createError("الإشعار غير موجود", 404);
    }

    res.status(200).json({
      message: "تم تعليم الإشعار كمقروء",
      notification,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/read-all
export const markAllNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { owner: req.user.id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    res.status(200).json({
      message: "تم تعليم جميع الإشعارات كمقروءة",
    });
  } catch (error) {
    next(error);
  }
};
