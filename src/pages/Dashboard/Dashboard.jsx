
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Package,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiRequest } from "../../services/api";
import "./Dashboard.css";

const currency = new Intl.NumberFormat("ar-EG", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 0,
});

const numberFormat = new Intl.NumberFormat("ar-EG", {
  maximumFractionDigits: 0,
});

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const shortDateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

function formatMoney(value) {
  return currency.format(Number(value) || 0);
}

function formatNumber(value) {
  return numberFormat.format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : dateFormat.format(date);
}

function formatShortDate(value) {
  if (!value) return "";

  // التعامل مع YYYY-MM-DD كتاريخ محلي لتجنب اختلاف اليوم بسبب المنطقة الزمنية.
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : shortDateFormat.format(date);
}

function getCustomerName(invoice) {
  return invoice?.customer?.name || "عميل نقدي";
}

function getPaymentStatus(invoice) {
  const status = invoice?.paymentStatus || invoice?.status || "unknown";

  const labels = {
    paid: "مدفوعة",
    completed: "مكتملة",
    partial: "مدفوعة جزئيًا",
    unpaid: "غير مدفوعة",
    refunded: "مستردة",
    cancelled: "ملغاة",
    pending: "قيد الانتظار",
    unknown: "غير محددة",
  };

  const tones = {
    paid: "success",
    completed: "success",
    partial: "warning",
    unpaid: "danger",
    refunded: "neutral",
    cancelled: "neutral",
    pending: "warning",
    unknown: "neutral",
  };

  return {
    label: labels[status] || status,
    tone: tones[status] || "neutral",
  };
}

function StatCard({
  title,
  value,
  note,
  icon: Icon,
  tone = "blue",
}) {
  return (
    <article className={`dashboard-stat dashboard-stat-${tone}`}>
      <div className="dashboard-stat-top">
        <span className="dashboard-stat-icon">
          <Icon size={21} />
        </span>

        <span className="dashboard-stat-label">{title}</span>
      </div>

      <strong className="dashboard-stat-value">{value}</strong>

      {note && <span className="dashboard-stat-note">{note}</span>}
    </article>
  );
}

function Panel({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className = "",
}) {
  return (
    <section className={`dashboard-panel ${className}`}>
      <header className="dashboard-panel-header">
        <div className="dashboard-panel-heading">
          {Icon && (
            <span className="dashboard-panel-icon">
              <Icon size={19} />
            </span>
          )}

          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>

        {action}
      </header>

      {children}
    </section>
  );
}

function EmptyState({ message }) {
  return (
    <div className="dashboard-empty">
      <Package size={28} />
      <p>{message}</p>
    </div>
  );
}

function SalesTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="dashboard-chart-tooltip">
      <strong>{formatShortDate(label)}</strong>

      {payload.map((item) => (
        <div key={item.dataKey}>
          <span>{item.name || "المبيعات"}</span>
          <b>{formatMoney(item.value)}</b>
        </div>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="dashboard-state">
      <span className="dashboard-loader" />
      <h2>جارٍ تحميل لوحة التحكم</h2>
      <p>نجهّز ملخص المبيعات والمخزون والفواتير.</p>
    </div>
  );
}

function ErrorState({ message, onRetry, loading }) {
  return (
    <div className="dashboard-state dashboard-state-error">
      <span className="dashboard-state-icon">
        <AlertTriangle size={26} />
      </span>

      <h2>تعذر تحميل لوحة التحكم</h2>
      <p>{message}</p>

      <button
        type="button"
        className="dashboard-button dashboard-button-primary"
        onClick={onRetry}
        disabled={loading}
      >
        <RefreshCw size={16} />
        إعادة المحاولة
      </button>
    </div>
  );
}

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/dashboard");
      setDashboard(data);
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تحميل البيانات.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, refreshKey]);

  const refreshDashboard = () => {
    setRefreshKey((value) => value + 1);
  };

  if (loading && !dashboard) {
    return (
      <section className="dashboard-page" dir="rtl">
        <LoadingState />
      </section>
    );
  }

  if (error && !dashboard) {
    return (
      <section className="dashboard-page" dir="rtl">
        <ErrorState
          message={error}
          onRetry={refreshDashboard}
          loading={loading}
        />
      </section>
    );
  }

  const sales = dashboard?.sales || {};
  const purchases = dashboard?.purchases || {};
  const profit = dashboard?.profit || {};
  const inventory = dashboard?.inventory || {};
  const receivables = dashboard?.receivables || {};

  const salesToday = sales.today || {};
  const salesMonth = sales.month || {};
  const purchasesMonth = purchases.month || {};

  const salesChart = dashboard?.salesChart || [];
  const lowStockProducts = inventory.lowStockProducts || [];
  const recentInvoices = dashboard?.recentInvoices || [];

  return (
    <section className="dashboard-page" dir="rtl">
      <header className="dashboard-header">
        <div className="dashboard-heading">
          <span className="dashboard-heading-icon">
            <Activity size={25} />
          </span>

          <div>
            <h1>لوحة التحكم</h1>
            <p>نظرة شاملة على أداء المتجر والمبيعات والمخزون.</p>
          </div>
        </div>

        <button
          type="button"
          className="dashboard-button dashboard-button-light"
          onClick={refreshDashboard}
          disabled={loading}
        >
          <RefreshCw
            size={17}
            className={loading ? "dashboard-spin" : ""}
          />
          تحديث البيانات
        </button>
      </header>

      {error && (
        <div className="dashboard-inline-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error} — تُعرض آخر بيانات تم تحميلها إن وجدت.</span>
          <button type="button" onClick={refreshDashboard}>
            إعادة المحاولة
          </button>
        </div>
      )}

      <div className="dashboard-welcome">
        <div>
          <span className="dashboard-welcome-eyebrow">
            <CalendarDays size={15} />
            ملخص النشاط التجاري
          </span>
          <h2>أهلاً بك في لوحة إدارة متجرك</h2>
          <p>تابع المبيعات والتحصيل والمخزون من مكان واحد.</p>
        </div>

        <span className="dashboard-welcome-art">
          <ShoppingBag size={45} strokeWidth={1.5} />
        </span>
      </div>

      <div className="dashboard-section-heading">
        <div>
          <h2>المؤشرات الرئيسية</h2>
          <p>ملخص سريع لأهم أرقام نشاطك التجاري.</p>
        </div>
      </div>

      <div className="dashboard-stats-grid">
        <StatCard
          title="مبيعات اليوم"
          value={formatMoney(salesToday.total)}
          note={`${formatNumber(salesToday.count)} فاتورة`}
          icon={Banknote}
          tone="blue"
        />

        <StatCard
          title="مبيعات الشهر"
          value={formatMoney(salesMonth.total)}
          note={`${formatNumber(salesMonth.count)} فاتورة`}
          icon={TrendingUp}
          tone="green"
        />

        

        <StatCard
          title="الربح الإجمالي الشهري"
          value={formatMoney(profit.monthGrossProfit)}
          note="قبل المصروفات التشغيلية"
          icon={ArrowUpRight}
          tone="purple"
        />

        <StatCard
          title="المخزون المتاح"
          value={`${formatNumber(inventory.availableUnits)} قطعة`}
          note={`${formatNumber(inventory.activeProductsCount)} منتج نشط`}
          icon={Package}
          tone="teal"
        />

        <StatCard
          title="المبالغ المستحقة"
          value={formatMoney(receivables.totalDue)}
          note={`${formatNumber(receivables.invoicesCount)} فاتورة`}
          icon={Wallet}
          tone="rose"
        />
      </div>

      <div className="dashboard-main-grid">
        <Panel
          title="حركة المبيعات"
          subtitle="المبيعات خلال آخر 7 أيام"
          icon={TrendingUp}
          className="dashboard-sales-panel"
        >
          {salesChart.length > 0 ? (
            <div className="dashboard-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={salesChart}
                  margin={{ top: 12, right: 4, left: 4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="dashboardSalesGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#4f46e5"
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="95%"
                        stopColor="#4f46e5"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="#edf0f6"
                    strokeDasharray="4 4"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShortDate}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    tickFormatter={(value) =>
                      numberFormat.format(Number(value) || 0)
                    }
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={58}
                  />

                  <Tooltip content={<SalesTooltip />} />

                  <Area
                    type="monotone"
                    dataKey="sales"
                    name="المبيعات"
                    stroke="#4f46e5"
                    strokeWidth={2.5}
                    fill="url(#dashboardSalesGradient)"
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="لا توجد بيانات مبيعات لعرض الرسم البياني." />
          )}
        </Panel>

        <Panel
          title="حالة المخزون"
          subtitle="المنتجات التي تحتاج إلى إعادة تعبئة مخزونها"
          icon={AlertTriangle}
          className="dashboard-stock-panel"
          action={
            <span className="dashboard-count-badge">
              {formatNumber(lowStockProducts.length)}
            </span>
          }
        >
          {lowStockProducts.length === 0 ? (
            <div className="dashboard-stock-success">
              <CheckCircle2 size={25} />
              <strong>المخزون بحالة جيدة</strong>
              <p>لا توجد منتجات وصلت إلى حد إعادة الطلب.</p>
            </div>
          ) : (
            <div className="dashboard-stock-list">
              {lowStockProducts.slice(0, 6).map((item, index) => (
                <div
                  className="dashboard-stock-item"
                  key={item.variantId || item.sku || index}
                >
                  <span className="dashboard-stock-icon">
                    <Package size={18} />
                  </span>

                  <div className="dashboard-stock-info">
                    <strong>{item.name || "منتج بدون اسم"}</strong>
                    <span>
                      {[item.color, item.size, item.sku]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>

                  <div className="dashboard-stock-quantity">
                    <strong>{formatNumber(item.quantity)}</strong>
                    <span>
                      الحد {formatNumber(item.reorderPoint)}
                    </span>
                  </div>
                </div>
              ))}

              {lowStockProducts.length > 6 && (
                <p className="dashboard-list-footer">
                  يوجد {formatNumber(lowStockProducts.length - 6)} منتجات
                  أخرى تحتاج إلى مراجعة.
                </p>
              )}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="آخر الفواتير"
        subtitle="أحدث الفواتير المسجلة في النظام"
        icon={FileText}
        className="dashboard-invoices-panel"
        action={
          <span className="dashboard-table-count">
            {formatNumber(recentInvoices.length)} فاتورة
          </span>
        }
      >
        {recentInvoices.length === 0 ? (
          <EmptyState message="لا توجد فواتير مسجلة حتى الآن." />
        ) : (
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>رقم الفاتورة</th>
                  <th>العميل</th>
                  <th>الإجمالي</th>
                  <th>المدفوع</th>
                  <th>المتبقي</th>
                  <th>حالة الدفع</th>
                  <th>التاريخ</th>
                </tr>
              </thead>

              <tbody>
                {recentInvoices.map((invoice, index) => {
                  const status = getPaymentStatus(invoice);
                  const total = Number(invoice.total) || 0;
                  const paid = Number(invoice.paidAmount) || 0;
                  const due = invoice.dueAmount !== undefined
                    ? Number(invoice.dueAmount) || 0
                    : Math.max(total - paid, 0);

                  return (
                    <tr key={invoice._id || invoice.invoiceNumber || index}>
                      <td>
                        <strong className="dashboard-invoice-number">
                          {invoice.invoiceNumber || "—"}
                        </strong>
                      </td>

                      <td>{getCustomerName(invoice)}</td>

                      <td className="dashboard-money-cell">
                        {formatMoney(total)}
                      </td>

                      <td className="dashboard-paid-cell">
                        {formatMoney(paid)}
                      </td>

                      <td className={due > 0 ? "dashboard-due-cell" : ""}>
                        {formatMoney(due)}
                      </td>

                      <td>
                        <span
                          className={`dashboard-status dashboard-status-${status.tone}`}
                        >
                          <span />
                          {status.label}
                        </span>
                      </td>

                      <td className="dashboard-date-cell">
                        {formatDate(invoice.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <footer className="dashboard-footer">
        <span>
          <CheckCircle2 size={15} />
          لوحة التحكم متصلة ببيانات النظام
        </span>

        <button
          type="button"
          className="dashboard-footer-refresh"
          onClick={refreshDashboard}
          disabled={loading}
        >
          <RefreshCw size={14} />
          تحديث
        </button>
      </footer>
    </section>
  );
}
