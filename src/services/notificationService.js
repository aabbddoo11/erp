
import Notification from "../models/Notification.js";

export const createNotification = async ({
  owner,
  type,
  title,
  message,
  link = null,
  entityId = null,
  dedupeKey = null,
}) => {
  try {
    const notificationData = {
      owner,
      type,
      title,
      message,
      link,
      entityId,
    };

    if (dedupeKey) {
      notificationData.dedupeKey = dedupeKey;
    }

    return await Notification.create(notificationData);
  } catch (error) {
    // لا نسمح لفشل الإشعار بتعطيل عملية البيع أو تحديث المخزون.
    // نتجاهل فقط تعارض المفتاح الفريد الخاص بالإشعارات المكررة.
    if (error.code !== 11000) {
      console.error("Notification creation failed:", error.message);
    }

    return null;
  }
};
