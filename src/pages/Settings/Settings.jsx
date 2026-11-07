
import { useEffect, useState } from "react";
import {
  UserRound,
  Mail,
  Phone,
  ShieldCheck,
  CalendarDays,
  LockKeyhole,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,X
} from "lucide-react";
import { apiRequest } from "../../services/api";
import "./Settings.css";

const roleLabels = {
  owner: "المالك",
  subscriber: "مشترك مدفوع",
  demo: "حساب تجريبي",
};

const statusLabels = {
  active: "نشط",
  expired: "منتهي",
  suspended: "موقوف",
};

const formatDate = (date) => {
  if (!date) return "غير محدد";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "غير محدد";
  }

  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsedDate);
};

function Settings() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      try {
        const data = await apiRequest("/auth/me");

        if (!cancelled) {
          setUser(data.user ?? data);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage({
            type: "error",
            text: error.message || "تعذر تحميل بيانات الحساب",
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingUser(false);
        }
      }
    };

    loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setMessage({ type: "", text: "" });

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({
        type: "error",
        text: "يرجى تعبئة جميع حقول كلمة المرور",
      });
      return;
    }

    if (newPassword.length < 8 || newPassword.length > 72) {
      setMessage({
        type: "error",
        text: "كلمة المرور الجديدة يجب أن تكون بين 8 و72 حرفًا",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({
        type: "error",
        text: "كلمتا المرور الجديدتان غير متطابقتين",
      });
      return;
    }

    if (currentPassword === newPassword) {
      setMessage({
        type: "error",
        text: "يجب أن تختلف كلمة المرور الجديدة عن الحالية",
      });
      return;
    }

    setChangingPassword(true);

    try {
      const data = await apiRequest("/auth/change-password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setMessage({
        type: "success",
        text: data.message || "تم تغيير كلمة المرور بنجاح",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "تعذر تغيير كلمة المرور",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const renderPasswordField = ({
    label,
    value,
    onChange,
    visible,
    onToggle,
    placeholder,
    autoComplete,
  }) => (
    <div className="settings-field">
      <label>{label}</label>
      <div className="settings-password-input">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          maxLength={72}
        />
        <button
          type="button"
          className="settings-password-toggle"
          onClick={onToggle}
          aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="settings-page" dir="rtl">
      <div className="settings-header">
        <div>
          <span className="settings-eyebrow">الحساب</span>
          <h1>الإعدادات</h1>
          <p>إدارة بيانات حسابك وتأمينه.</p>
        </div>

        <div className="settings-header-icon">
          <UserRound size={26} />
        </div>
      </div>

     

      <section className="settings-card">
        <div className="settings-card-heading">
          <div className="settings-section-icon">
            <UserRound size={21} />
          </div>
          <div>
            <h2>بيانات الحساب</h2>
            <p>معلومات الحساب المسجل في النظام.</p>
          </div>
        </div>

        {loadingUser ? (
          <div className="settings-loading">
            <RefreshCw size={20} className="settings-spinner" />
            <span>جارٍ تحميل بيانات الحساب...</span>
          </div>
        ) : user ? (
          <>
            <div className="settings-profile">
              <div className="settings-avatar">
                {(user.name || "م").trim().charAt(0)}
              </div>
              <div className="settings-profile-info">
                <h3>{user.name || "المستخدم"}</h3>
                <span>{roleLabels[user.role] || "حساب مستخدم"}</span>
              </div>
              <span
                className={`settings-status settings-status-${user.status || "unknown"}`}
              >
                {statusLabels[user.status] || "غير محدد"}
              </span>
            </div>

            <div className="settings-info-grid">
              <div className="settings-info-item">
                <div className="settings-info-icon">
                  <UserRound size={18} />
                </div>
                <div>
                  <span>الاسم</span>
                  <strong>{user.name || "غير محدد"}</strong>
                </div>
              </div>

              <div className="settings-info-item">
                <div className="settings-info-icon">
                  <Mail size={18} />
                </div>
                <div>
                  <span>البريد الإلكتروني</span>
                  <strong dir="ltr">{user.email || "غير محدد"}</strong>
                </div>
              </div>

              <div className="settings-info-item">
                <div className="settings-info-icon">
                  <Phone size={18} />
                </div>
                <div>
                  <span>رقم الهاتف</span>
                  <strong dir="ltr">{user.phone || "غير محدد"}</strong>
                </div>
              </div>

              <div className="settings-info-item">
                <div className="settings-info-icon">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <span>نوع الحساب</span>
                  <strong>{roleLabels[user.role] || "غير محدد"}</strong>
                </div>
              </div>

              {user.role === "demo" && (
                <>
                  <div className="settings-info-item">
                    <div className="settings-info-icon">
                      <CalendarDays size={18} />
                    </div>
                    <div>
                      <span>بداية التجربة</span>
                      <strong>{formatDate(user.demoStartedAt)}</strong>
                    </div>
                  </div>

                  <div className="settings-info-item">
                    <div className="settings-info-icon">
                      <CalendarDays size={18} />
                    </div>
                    <div>
                      <span>انتهاء التجربة</span>
                      <strong>{formatDate(user.demoExpiresAt)}</strong>
                    </div>
                  </div>
                </>
              )}

              {user.role === "subscriber" && (
                <>
                  <div className="settings-info-item">
                    <div className="settings-info-icon">
                      <CalendarDays size={18} />
                    </div>
                    <div>
                      <span>بداية الاشتراك</span>
                      <strong>
                        {formatDate(user.subscriptionStartedAt)}
                      </strong>
                    </div>
                  </div>

                  <div className="settings-info-item">
                    <div className="settings-info-icon">
                      <CalendarDays size={18} />
                    </div>
                    <div>
                      <span>انتهاء الاشتراك</span>
                      <strong>
                        {formatDate(user.subscriptionExpiresAt)}
                      </strong>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="settings-empty">
            لم نتمكن من تحميل بيانات الحساب.
          </div>
        )}
      </section>
{message.text && (
  <div
    className={`settings-message settings-message-${message.type}`}
    role="status"
  >
    {message.type === "success" ? (
      <CheckCircle2 size={19} />
    ) : (
      <AlertCircle size={19} />
    )}

    <span>{message.text}</span>

    <button
      type="button"
      className="settings-message-close"
      onClick={() => setMessage({ type: "", text: "" })}
      aria-label="إغلاق الرسالة"
    >
      <X size={18} />
    </button>
  </div>
)}
      <section className="settings-card">
        <div className="settings-card-heading">
          <div className="settings-section-icon">
            <LockKeyhole size={21} />
          </div>
          <div>
            <h2>تغيير كلمة المرور</h2>
            <p>استخدم كلمة مرور قوية لحماية حسابك.</p>
          </div>
        </div>

        <form
          className="settings-password-form"
          onSubmit={handlePasswordChange}
        >
          {renderPasswordField({
            label: "كلمة المرور الحالية",
            value: currentPassword,
            onChange: setCurrentPassword,
            visible: showCurrentPassword,
            onToggle: () => setShowCurrentPassword((value) => !value),
            placeholder: "أدخل كلمة المرور الحالية",
            autoComplete: "current-password",
          })}

          {renderPasswordField({
            label: "كلمة المرور الجديدة",
            value: newPassword,
            onChange: setNewPassword,
            visible: showNewPassword,
            onToggle: () => setShowNewPassword((value) => !value),
            placeholder: "8 أحرف على الأقل",
            autoComplete: "new-password",
          })}

          {renderPasswordField({
            label: "تأكيد كلمة المرور الجديدة",
            value: confirmPassword,
            onChange: setConfirmPassword,
            visible: showConfirmPassword,
            onToggle: () => setShowConfirmPassword((value) => !value),
            placeholder: "أعد إدخال كلمة المرور الجديدة",
            autoComplete: "new-password",
          })}

          <div className="settings-password-note">
            يجب أن يتراوح طول كلمة المرور الجديدة بين 8 و72 حرفًا.
          </div>

          <div className="settings-form-actions">
            <button
              type="submit"
              className="settings-submit-button"
              disabled={changingPassword}
            >
              {changingPassword ? (
                <>
                  <RefreshCw size={17} className="settings-spinner" />
                  جارٍ تغيير كلمة المرور...
                </>
              ) : (
                <>
                  <LockKeyhole size={17} />
                  تغيير كلمة المرور
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default Settings;
