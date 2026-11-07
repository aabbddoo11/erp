
import { useEffect, useState } from "react";
import {
  Users,
  UserCheck,
  Clock3,
  CalendarClock,
  RefreshCw,
  UserPlus,
  ArrowLeft,
  AlertCircle,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import "./OwnerDashboard.css";

const initialStats = [
  {
    key: "totalAccounts",
    title: "إجمالي الحسابات",
    value: "—",
    description: "جميع الحسابات المسجلة",
    icon: Users,
    color: "purple",
  },
  {
    key: "activeAccounts",
    title: "الحسابات النشطة",
    value: "—",
    description: "الحسابات القابلة للاستخدام",
    icon: UserCheck,
    color: "green",
  },
  {
    key: "demoAccounts",
    title: "الحسابات التجريبية",
    value: "—",
    description: "حسابات الفترة التجريبية",
    icon: Clock3,
    color: "blue",
  },
  {
    key: "expiredAccounts",
    title: "الحسابات المنتهية",
    value: "—",
    description: "تحتاج إلى مراجعة",
    icon: CalendarClock,
    color: "orange",
  },
];

const formatDate = (value) => {
  if (!value) return "غير محدد";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "غير محدد";

  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
};

function OwnerDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [expiringAccounts, setExpiringAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/owner/dashboard");

      setStats(data.stats || null);
      setChartData(Array.isArray(data.chartData) ? data.chartData : []);
      setExpiringAccounts(
        Array.isArray(data.expiringAccounts)
          ? data.expiringAccounts
          : []
      );
    } catch (err) {
      setError(err.message || "تعذر تحميل بيانات لوحة التحكم");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const displayedStats = initialStats.map((stat) => ({
    ...stat,
    value: loading
      ? "..."
      : stats && stats[stat.key] !== undefined
        ? Number(stats[stat.key]).toLocaleString("ar-EG")
        : "—",
  }));

  return (
    <div className="owner-dashboard" dir="rtl">
      <div className="owner-dashboard-heading">
        <div>
          <span className="owner-eyebrow">مركز إدارة النظام</span>
          <h2>لوحة تحكم المالك</h2>
          <p>تابع الحسابات والاشتراكات وأداء النظام من مكان واحد.</p>
        </div>

        <button
          type="button"
          className="owner-refresh-button"
          onClick={loadDashboard}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "owner-spin" : ""} />
          تحديث البيانات
        </button>
      </div>

      {error && (
        <div className="owner-error">
          <AlertCircle size={19} />
          <span>{error}</span>
          <button type="button" onClick={loadDashboard}>
            إعادة المحاولة
          </button>
        </div>
      )}

      <div className="owner-stats-grid">
        {displayedStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article className="owner-stat-card" key={stat.key}>
              <div className="owner-stat-top">
                <div className={`owner-stat-icon ${stat.color}`}>
                  <Icon size={21} />
                </div>
                <span className="owner-stat-indicator">
                  <TrendingUp size={14} />
                  إحصائيات الحسابات
                </span>
              </div>

              <div className="owner-stat-title">{stat.title}</div>
              <div className="owner-stat-value">{stat.value}</div>
              <div className="owner-stat-description">
                {stat.description}
              </div>
            </article>
          );
        })}
      </div>

      <div className="owner-dashboard-main-grid">
        <section className="owner-panel owner-chart-panel">
          <div className="owner-panel-heading">
            <div>
              <h3>نمو الحسابات</h3>
              <p>متابعة تسجيل الحسابات خلال الفترة المتاحة</p>
            </div>
            <div className="owner-panel-heading-icon">
              <TrendingUp size={19} />
            </div>
          </div>

          {chartData.length > 0 ? (
            <div className="owner-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 12, right: 5, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="ownerChartGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#6c5ce7"
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="100%"
                        stopColor="#6c5ce7"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="#eeeef4"
                    strokeDasharray="4 4"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#898b9b", fontSize: 11 }}
                  />

                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#898b9b", fontSize: 11 }}
                    width={35}
                  />

                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #eeeef4",
                      fontSize: 12,
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="accounts"
                    name="الحسابات الجديدة"
                    stroke="#6c5ce7"
                    strokeWidth={3}
                    fill="url(#ownerChartGradient)"
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="owner-chart-empty">
              <TrendingUp size={30} />
              <strong>
                {loading ? "جارٍ تحميل البيانات..." : "لا توجد بيانات للرسم البياني"}
              </strong>
              <span>
                سيظهر الرسم عند توفير بيانات نمو الحسابات من الخادم.
              </span>
            </div>
          )}
        </section>

        <section className="owner-panel owner-quick-panel">
          <div className="owner-panel-heading">
            <div>
              <h3>إجراءات سريعة</h3>
              <p>الوصول إلى مهام إدارة النظام</p>
            </div>
          </div>

          <button
            type="button"
            className="owner-quick-action"
            onClick={() => navigate("/owner/users")}
          >
            <span className="owner-quick-icon purple">
              <UserPlus size={20} />
            </span>
            <span className="owner-quick-text">
              <strong>إنشاء حساب جديد</strong>
              <small>إضافة حساب تجريبي أو مشترك</small>
            </span>
            <ArrowLeft size={17} />
          </button>

          <button
            type="button"
            className="owner-quick-action"
            onClick={() => navigate("/owner/users")}
          >
            <span className="owner-quick-icon green">
              <Users size={20} />
            </span>
            <span className="owner-quick-text">
              <strong>إدارة الحسابات</strong>
              <small>مراجعة الحسابات وحالاتها</small>
            </span>
            <ArrowLeft size={17} />
          </button>

          <button
            type="button"
            className="owner-quick-action"
            onClick={() => navigate("/owner/users")}
          >
            <span className="owner-quick-icon orange">
              <CreditCard size={20} />
            </span>
            <span className="owner-quick-text">
              <strong>متابعة الاشتراكات</strong>
              <small>مراجعة الاشتراكات وتواريخ الانتهاء</small>
            </span>
            <ArrowLeft size={17} />
          </button>
        </section>
      </div>

      <section className="owner-panel owner-expiring-panel">
        <div className="owner-panel-heading">
          <div>
            <h3>الحسابات التي قاربت على الانتهاء</h3>
            <p>الحسابات التي تحتاج إلى متابعة وتجديد</p>
          </div>

          <button
            type="button"
            className="owner-view-all"
            onClick={() => navigate("/owner/users")}
          >
            عرض الحسابات
            <ArrowLeft size={16} />
          </button>
        </div>

        <div className="owner-table-wrapper">
          <table className="owner-table">
            <thead>
              <tr>
                <th>الحساب</th>
                <th>البريد الإلكتروني</th>
                <th>نوع الحساب</th>
                <th>تاريخ الانتهاء</th>
                <th>الحالة</th>
              </tr>
            </thead>

            <tbody>
              {expiringAccounts.length > 0 ? (
                expiringAccounts.map((account) => (
                  <tr key={account._id}>
                    <td>
                      <div className="owner-account-name">
                        <span className="owner-account-avatar">
                          {(account.name || "م").charAt(0)}
                        </span>
                        <strong>{account.name || "بدون اسم"}</strong>
                      </div>
                    </td>
                    <td>{account.email || "—"}</td>
                    <td>
                      {account.role === "demo" ? "تجريبي" : "مشترك"}
                    </td>
                    <td>{formatDate(account.expiresAt)}</td>
                    <td>
                      <span className="owner-status-badge">
                        <Clock3 size={13} />
                        قرب الانتهاء
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">
                    <div className="owner-table-empty">
                      {loading
                        ? "جارٍ تحميل الحسابات..."
                        : "لا توجد حسابات قاربت على الانتهاء أو لم تصل بياناتها من الخادم."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default OwnerDashboard;
