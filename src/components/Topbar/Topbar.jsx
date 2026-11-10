
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  Settings,
  ChevronDown,
  FileText,
  Package,
  Clock3,
  CreditCard,
  Info,
  CheckCheck,
  X,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import "./Topbar.css";

const notificationIcons = {
  invoice_created: FileText,
  low_stock: Package,
  subscription_warning: Clock3,
  subscription_expired: Clock3,
  payment_received: CreditCard,
  system: Info,
};

const formatDate = (date) => {
  if (!date) return "";

  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
};

const getRoleLabel = (role) => {
  const roles = {
    owner: "مالك النظام",
    subscriber: "مشترك",
    demo: "حساب تجريبي",
  };

  return roles[role] || "مستخدم";
};

const Topbar = () => {
  const {
    user,
    isAuthenticated,
    loading: authLoading,
    logout,
  } = useAuth();

  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState("");

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const loadNotifications = useCallback(async (showLoading = false) => {
    if (showLoading) setLoadingNotifications(true);

    try {
      setNotificationError("");

      const data = await apiRequest("/notifications?limit=20");

      setNotifications(data.notifications || []);
      setUnreadCount(Number(data.unreadCount) || 0);
    } catch (error) {
      setNotificationError(error.message || "تعذر تحميل الإشعارات");
    } finally {
      if (showLoading) setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    loadNotifications();

    const intervalId = window.setInterval(() => {
      loadNotifications();
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [authLoading, isAuthenticated, user, loadNotifications]);

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.isRead) {
        await apiRequest(
          `/notifications/${notification._id}/read`,
          { method: "PATCH" }
        );

        setNotifications((current) =>
          current.map((item) =>
            item._id === notification._id
              ? { ...item, isRead: true }
              : item
          )
        );

        setUnreadCount((count) => Math.max(0, count - 1));
      }

      setNotificationsOpen(false);

      if (notification.link) {
        navigate(notification.link);
      }
    } catch (error) {
      setNotificationError(error.message || "تعذر تحديث الإشعار");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest("/notifications/read-all", {
        method: "PATCH",
      });

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          isRead: true,
        }))
      );

      setUnreadCount(0);
    } catch (error) {
      setNotificationError(error.message || "تعذر تحديث الإشعارات");
    }
  };

  const displayName = user?.name?.trim() || "مستخدم";
  const avatarLetter = displayName.charAt(0) || "م";

  return (
    <header className="topbar">
      <div className="topbar-right">
        <div className="topbar-heading">
          <span className="topbar-title">نظام إدارة</span>
        </div>

        <img
          className="topbar-logo"
          src="/logo/logo.png"
          alt="حلول"
        />
      </div>

      <div className="topbar-left">
        <div className="notification-wrapper">
          <button
            className="topbar-icon-button"
            type="button"
            aria-label="الإشعارات"
            aria-expanded={notificationsOpen}
            onClick={() => {
              const nextOpen = !notificationsOpen;
              setNotificationsOpen(nextOpen);

              if (nextOpen) {
                loadNotifications(true);
              }
            }}
          >
            <Bell size={19} />

            {unreadCount > 0 && (
              <span className="notification-count">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <>
              <button
                className="notification-backdrop"
                type="button"
                aria-label="إغلاق الإشعارات"
                onClick={() => setNotificationsOpen(false)}
              />

              <section className="notification-panel" dir="rtl">
                <div className="notification-panel-header">
                  <div>
                    <h3>الإشعارات</h3>
                    <span>
                      {unreadCount > 0
                        ? `لديك ${unreadCount} إشعار غير مقروء`
                        : "لا توجد إشعارات جديدة"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="notification-close"
                    aria-label="إغلاق"
                    onClick={() => setNotificationsOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="notification-read-all"
                    onClick={handleMarkAllRead}
                  >
                    <CheckCheck size={16} />
                    تعليم الكل كمقروء
                  </button>
                )}

                {notificationError && (
                  <p className="notification-error">
                    {notificationError}
                    <button
                      type="button"
                      onClick={() => loadNotifications(true)}
                    >
                      إعادة المحاولة
                    </button>
                  </p>
                )}

                <div className="notification-list">
                  {loadingNotifications ? (
                    <div className="notification-empty">
                      جارٍ تحميل الإشعارات...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="notification-empty">
                      <Bell size={26} />
                      <span>لا توجد إشعارات حتى الآن</span>
                    </div>
                  ) : (
                    notifications.map((notification) => {
                      const Icon =
                        notificationIcons[notification.type] || Info;

                      return (
                        <button
                          type="button"
                          className={`notification-item ${
                            notification.isRead ? "is-read" : "is-unread"
                          }`}
                          key={notification._id}
                          onClick={() =>
                            handleNotificationClick(notification)
                          }
                        >
                          <span className="notification-item-icon">
                            <Icon size={19} />
                          </span>

                          <span className="notification-item-content">
                            <strong>{notification.title}</strong>
                            <span>{notification.message}</span>
                            <time>
                              {formatDate(notification.createdAt)}
                            </time>
                          </span>

                          {!notification.isRead && (
                            <span className="notification-unread-dot" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                <button
                  type="button"
                  className="notification-refresh"
                  onClick={() => loadNotifications(true)}
                >
                  تحديث الإشعارات
                </button>
              </section>
            </>
          )}
        </div>

        <button
          className="ccvc"
          type="button"
          aria-label="الإعدادات"
          onClick={() => navigate("/settings")}
        >
          <Settings size={19} />
        </button>

        <button
          className="topbar-user"
          type="button"
          aria-label={`المستخدم ${displayName}`}
        >
          <div className="user-avatar">{avatarLetter}</div>

          <div className="user-info">
            <span className="user-name">مرحبا {displayName}</span>
            <span className="user-role">
              نوع حسابك : {getRoleLabel(user?.role)}
            </span>
          </div>
        </button>

        {/* زر تسجيل الخروج - يظهر على الهاتف بعد تنسيقه في CSS */}
        <button
          type="button"
          className="topbar-logout"
          onClick={handleLogout}
          aria-label="تسجيل الخروج"
          title="تسجيل الخروج"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
};

export default Topbar;
