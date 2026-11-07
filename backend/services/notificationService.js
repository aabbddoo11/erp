
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
    if (error.code !== 11000) {
      console.error("Notification creation failed:", error.message);
    }

    return null;
  }
};
