
import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Eye,
  Ban,
  CheckCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Users,
} from "lucide-react";
import { apiRequest } from "../../services/api";
import "./Accounts.css";

const initialForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "demo",
  durationDays: "30",
};

const roleLabels = {
  demo: "تجريبي",
  subscriber: "اشتراك",
};

const statusLabels = {
  active: "نشط",
  expired: "منتهي",
  suspended: "معلّق",
};

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getExpiry(account) {
  return account.role === "demo"
    ? account.demoExpiresAt
    : account.subscriptionExpiresAt;
}

function getStart(account) {
  return account.role === "demo"
    ? account.demoStartedAt
    : account.subscriptionStartedAt;
}

function getEffectiveStatus(account) {
  if (account.status === "suspended") return "suspended";

  const expiry = getExpiry(account);
  if (expiry && new Date(expiry) <= new Date()) return "expired";

  return account.status;
}

function getErrorMessage(error) {
  return error?.message || "حدث خطأ، يرجى المحاولة مرة أخرى";
}

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [modal, setModal] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [renewDuration, setRenewDuration] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadAccounts = useCallback(async (page = 1) => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.limit),
      });

      if (search.trim()) params.set("search", search.trim());
      if (roleFilter) params.set("role", roleFilter);
      if (statusFilter) params.set("status", statusFilter);

      const data = await apiRequest(
        `/owner/accounts?${params.toString()}`
      );

      setAccounts(data.accounts || []);
      setPagination(
        data.pagination || {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
        }
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, search, roleFilter, statusFilter]);

  useEffect(() => {
    loadAccounts(1);
  }, [loadAccounts]);

  function openCreate() {
    setForm(initialForm);
    setSelectedAccount(null);
    setRenewDuration(false);
    setModal("create");
    setError("");
    setNotice("");
  }

  async function openDetails(account) {
    setError("");
    setNotice("");

    try {
      const data = await apiRequest(
        `/owner/accounts/${account._id || account.id}`
      );

      setSelectedAccount(data.account);
      setModal("details");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function openEdit(account) {
    const expiry = getExpiry(account);
    const start = getStart(account);

    let duration = "30";

    if (expiry && start) {
      const diff = Math.ceil(
        (new Date(expiry) - new Date(start)) / 86400000
      );

      if (Number.isFinite(diff) && diff > 0) {
        duration = String(diff);
      }
    }

    setSelectedAccount(account);
    setForm({
      name: account.name || "",
      email: account.email || "",
      phone: account.phone || "",
      password: "",
      role: account.role,
      durationDays: duration,
    });
    setRenewDuration(false);
    setError("");
    setNotice("");
    setModal("edit");
  }

  function closeModal() {
    if (saving) return;

    setModal(null);
    setSelectedAccount(null);
    setError("");
  }

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function submitForm(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const duration = Number(form.durationDays);

      if (
        !Number.isInteger(duration) ||
        duration < 1 ||
        duration > 3650
      ) {
        throw new Error("المدة يجب أن تكون عددًا صحيحًا بين 1 و3650 يومًا");
      }

      if (modal === "create") {
        await apiRequest("/owner/accounts", {
          method: "POST",
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            phone: form.phone,
            password: form.password,
            role: form.role,
            durationDays: duration,
          }),
        });

        setNotice("تم إنشاء الحساب بنجاح");
      } else {
        const originalRole = selectedAccount.role;
        const roleChanged = form.role !== originalRole;

        const payload = {
          name: form.name,
          email: form.email,
          phone: form.phone,
        };

        if (roleChanged) {
          payload.role = form.role;
          payload.durationDays = duration;
        } else if (renewDuration) {
          payload.durationDays = duration;
        }

        await apiRequest(
          `/owner/accounts/${selectedAccount._id || selectedAccount.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          }
        );

        setNotice(
          roleChanged || renewDuration
            ? "تم تحديث الحساب وتجديد المدة حسب اختيارك"
            : "تم تحديث بيانات الحساب"
        );
      }

      setModal(null);
      setSelectedAccount(null);
      await loadAccounts(pagination.page);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(account) {
    const id = account._id || account.id;
    const currentStatus = getEffectiveStatus(account);
    const nextStatus =
      currentStatus === "suspended" ? "active" : "suspended";

    const confirmation =
      nextStatus === "suspended"
        ? `هل تريد تعليق حساب ${account.name}؟`
        : `هل تريد إعادة تفعيل حساب ${account.name}؟`;

    if (!window.confirm(confirmation)) return;

    setError("");
    setNotice("");

    try {
      await apiRequest(`/owner/accounts/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });

      setNotice(
        nextStatus === "suspended"
          ? "تم تعليق الحساب"
          : "تم تفعيل الحساب"
      );

      await loadAccounts(pagination.page);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function deleteAccount(account) {
    const confirmation = window.confirm(
      `سيتم حذف حساب "${account.name}" نهائيًا. لا يمكن التراجع عن هذه العملية. هل تريد المتابعة؟`
    );

    if (!confirmation) return;

    setError("");
    setNotice("");

    try {
      await apiRequest(
        `/owner/accounts/${account._id || account.id}`,
        { method: "DELETE" }
      );

      setNotice("تم حذف الحساب نهائيًا");

      const nextPage =
        accounts.length === 1 && pagination.page > 1
          ? pagination.page - 1
          : pagination.page;

      await loadAccounts(nextPage);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function applySearch(event) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  return (
    <section className="accounts-page" dir="rtl">
      <header className="accounts-header">
        <div>
          <h1>إدارة الحسابات</h1>
          <p>إنشاء الحسابات ومتابعة الاشتراكات والمدد والحالات.</p>
        </div>

        <button className="accounts-primary-btn" onClick={openCreate}>
          <Plus size={18} />
          إنشاء حساب
        </button>
      </header>

      {notice && (
        <div className="accounts-alert success">
          <CheckCircle size={18} />
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="إغلاق">
            <X size={17} />
          </button>
        </div>
      )}

      {error && !modal && (
        <div className="accounts-alert error">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="إغلاق">
            <X size={17} />
          </button>
        </div>
      )}

      <div className="accounts-summary">
        <div className="accounts-summary-icon">
          <Users size={23} />
        </div>
        <div>
          <span>إجمالي نتائج البحث</span>
          <strong>{pagination.total}</strong>
        </div>
      </div>

      <div className="accounts-toolbar">
        <form className="accounts-search" onSubmit={applySearch}>
          <Search size={18} />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="ابحث بالاسم أو البريد أو الهاتف..."
          />
          <button type="submit">بحث</button>
        </form>

        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          aria-label="تصفية حسب نوع الحساب"
        >
          <option value="">كل أنواع الحسابات</option>
          <option value="demo">تجريبي</option>
          <option value="subscriber">اشتراك</option>
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="تصفية حسب الحالة"
        >
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="expired">منتهي</option>
          <option value="suspended">معلّق</option>
        </select>

        <button
          className="accounts-icon-btn"
          onClick={() => loadAccounts(1)}
          title="تحديث النتائج"
          aria-label="تحديث النتائج"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="accounts-table-wrap">
        <table className="accounts-table">
          <thead>
            <tr>
              <th>الحساب</th>
              <th>الهاتف</th>
              <th>النوع</th>
              <th>الحالة</th>
              <th>بداية المدة</th>
              <th>تاريخ الانتهاء</th>
              <th>الإجراءات</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="accounts-empty">
                  جارٍ تحميل الحسابات...
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan="7" className="accounts-empty">
                  لا توجد حسابات مطابقة للبحث.
                </td>
              </tr>
            ) : (
              accounts.map((account) => {
                const status = getEffectiveStatus(account);
                const id = account._id || account.id;

                return (
                  <tr key={id}>
                    <td>
                      <div className="accounts-user">
                        <div className="accounts-avatar">
                          {(account.name || "?").charAt(0)}
                        </div>
                        <div>
                          <strong>{account.name}</strong>
                          <span>{account.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>{account.phone || "—"}</td>
                    <td>
                      <span className={`accounts-role ${account.role}`}>
                        {roleLabels[account.role] || account.role}
                      </span>
                    </td>
                    <td>
                      <span className={`accounts-status ${status}`}>
                        {statusLabels[status] || status}
                      </span>
                    </td>
                    <td>{formatDate(getStart(account))}</td>
                    <td>{formatDate(getExpiry(account))}</td>
                    <td>
                      <div className="accounts-actions">
                        <button
                          title="التفاصيل"
                          aria-label="التفاصيل"
                          onClick={() => openDetails(account)}
                        >
                          <Eye size={17} />
                        </button>
                        <button
                          title="تعديل"
                          aria-label="تعديل"
                          onClick={() => openEdit(account)}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          title={
                            status === "suspended"
                              ? "إعادة التفعيل"
                              : "تعليق الحساب"
                          }
                          aria-label={
                            status === "suspended"
                              ? "إعادة التفعيل"
                              : "تعليق الحساب"
                          }
                          onClick={() => toggleStatus(account)}
                          disabled={status === "expired"}
                        >
                          {status === "suspended" ? (
                            <CheckCircle size={17} />
                          ) : (
                            <Ban size={17} />
                          )}
                        </button>
                        <button
                          className="delete-action"
                          title="حذف نهائي"
                          aria-label="حذف نهائي"
                          onClick={() => deleteAccount(account)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <footer className="accounts-pagination">
        <span>
          الصفحة {pagination.page} من {Math.max(pagination.totalPages, 1)}
          {" · "}
          {pagination.total} حساب
        </span>

        <div>
          <button
            disabled={loading || pagination.page <= 1}
            onClick={() => loadAccounts(pagination.page - 1)}
            aria-label="الصفحة السابقة"
          >
            <ChevronRight size={18} />
          </button>
          <button
            disabled={
              loading ||
              pagination.page >= Math.max(pagination.totalPages, 1)
            }
            onClick={() => loadAccounts(pagination.page + 1)}
            aria-label="الصفحة التالية"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
      </footer>

      {(modal === "create" || modal === "edit") && (
        <div className="accounts-modal-backdrop" onMouseDown={closeModal}>
          <div
            className="accounts-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-form-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="accounts-modal-header">
              <div>
                <h2 id="account-form-title">
                  {modal === "create" ? "إنشاء حساب جديد" : "تعديل الحساب"}
                </h2>
                <p>
                  {modal === "create"
                    ? "أدخل بيانات الحساب وحدد مدته."
                    : "عدّل البيانات المطلوبة ثم احفظ التغييرات."}
                </p>
              </div>
              <button onClick={closeModal} aria-label="إغلاق">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitForm}>
              <div className="accounts-form-grid">
                <label>
                  الاسم الكامل
                  <input
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    minLength={2}
                    maxLength={50}
                    required
                  />
                </label>

                <label>
                  البريد الإلكتروني
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={updateField}
                    maxLength={254}
                    required
                  />
                </label>

                <label>
                  رقم الهاتف
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={updateField}
                    maxLength={20}
                    required
                  />
                </label>

                {modal === "create" && (
                  <label>
                    كلمة المرور
                    <input
                      name="password"
                      type="password"
                      value={form.password}
                      onChange={updateField}
                      minLength={8}
                      maxLength={72}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                )}

                <label>
                  نوع الحساب
                  <select
                    name="role"
                    value={form.role}
                    onChange={updateField}
                  >
                    <option value="demo">حساب تجريبي</option>
                    <option value="subscriber">حساب اشتراك</option>
                  </select>
                </label>

                {modal === "create" && (
                  <label>
                    مدة الحساب بالأيام
                    <input
                      name="durationDays"
                      type="number"
                      min="1"
                      max="3650"
                      step="1"
                      value={form.durationDays}
                      onChange={updateField}
                      required
                    />
                  </label>
                )}
              </div>

              {modal === "edit" && (
                <div className="accounts-renew-box">
                  <label className="accounts-checkbox-label">
                    <input
                      type="checkbox"
                      checked={renewDuration}
                      onChange={(event) =>
                        setRenewDuration(event.target.checked)
                      }
                    />
                    تجديد المدة من تاريخ اليوم
                  </label>

                  {(renewDuration ||
                    form.role !== selectedAccount?.role) && (
                    <label className="accounts-duration-field">
                      المدة الجديدة بالأيام
                      <input
                        name="durationDays"
                        type="number"
                        min="1"
                        max="3650"
                        step="1"
                        value={form.durationDays}
                        onChange={updateField}
                        required
                      />
                    </label>
                  )}

                  <p>
                    لن تتغير المدة الحالية إلا عند اختيار التجديد أو تغيير نوع
                    الحساب. عند التجديد تبدأ المدة من تاريخ اليوم.
                  </p>
                </div>
              )}

              {error && (
                <div className="accounts-alert error">{error}</div>
              )}

              <div className="accounts-modal-footer">
                <button
                  type="button"
                  className="accounts-secondary-btn"
                  onClick={closeModal}
                  disabled={saving}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="accounts-primary-btn"
                  disabled={saving}
                >
                  {saving
                    ? "جارٍ الحفظ..."
                    : modal === "create"
                      ? "إنشاء الحساب"
                      : "حفظ التعديلات"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === "details" && selectedAccount && (
        <div className="accounts-modal-backdrop" onMouseDown={closeModal}>
          <div
            className="accounts-modal accounts-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-details-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="accounts-modal-header">
              <div>
                <h2 id="account-details-title">تفاصيل الحساب</h2>
                <p>معلومات الحساب ومدته وحالته.</p>
              </div>
              <button onClick={closeModal} aria-label="إغلاق">
                <X size={20} />
              </button>
            </div>

            <div className="accounts-detail-profile">
              <div className="accounts-avatar large">
                {(selectedAccount.name || "?").charAt(0)}
              </div>
              <div>
                <h3>{selectedAccount.name}</h3>
                <p>{selectedAccount.email}</p>
                <span
                  className={`accounts-status ${getEffectiveStatus(selectedAccount)}`}
                >
                  {statusLabels[getEffectiveStatus(selectedAccount)]}
                </span>
              </div>
            </div>

            <div className="accounts-detail-grid">
              <div>
                <span>رقم الهاتف</span>
                <strong>{selectedAccount.phone || "—"}</strong>
              </div>
              <div>
                <span>نوع الحساب</span>
                <strong>{roleLabels[selectedAccount.role]}</strong>
              </div>
              <div>
                <span>بداية المدة الحالية</span>
                <strong>{formatDate(getStart(selectedAccount))}</strong>
              </div>
              <div>
                <span>تاريخ الانتهاء</span>
                <strong>{formatDate(getExpiry(selectedAccount))}</strong>
              </div>
              <div>
                <span>تاريخ إنشاء الحساب</span>
                <strong>{formatDate(selectedAccount.createdAt)}</strong>
              </div>
              <div>
                <span>آخر تحديث</span>
                <strong>{formatDate(selectedAccount.updatedAt)}</strong>
              </div>
              <div>
                <span>البريد موثّق</span>
                <strong>
                  {selectedAccount.isEmailVerified ? "نعم" : "لا"}
                </strong>
              </div>
            </div>

            <div className="accounts-modal-footer">
              <button
                className="accounts-secondary-btn"
                onClick={closeModal}
              >
                إغلاق
              </button>
              <button
                className="accounts-primary-btn"
                onClick={() => openEdit(selectedAccount)}
              >
                <Pencil size={17} />
                تعديل الحساب
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
