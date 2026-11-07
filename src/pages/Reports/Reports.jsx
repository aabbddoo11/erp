
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  CreditCard,
  FileText,
  Package,
  Printer,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiRequest } from "../../services/api";
import "./Reports.css";

const tabs = [
  { id: "sales", label: "المبيعات", icon: TrendingUp },
  { id: "profit", label: "الأرباح", icon: CircleDollarSign },
  { id: "inventory", label: "المخزون", icon: Package },
];

const chartColors = [
  "#4f46e5",
  "#0d9488",
  "#f59e0b",
  "#e11d48",
  "#7c3aed",
  "#0284c7",
];

const currencyFormatter = new Intl.NumberFormat("ar-EG", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("ar-EG", {
  maximumFractionDigits: 0,
});

function localDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateInput(value) {
  if (!value) return "";

  const parts = value.split("-");
  if (parts.length !== 3) return value;

  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

function parseDateInput(value) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  return [day, month, year].filter(Boolean).join("/");
}

function isValidDateInput(value) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return false;

  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  return (
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
  );
}

function toISODate(value) {
  const [day, month, year] = value.split("/");
  return `${year}-${month}-${day}`;
}

function getInitialDates() {
  const today = new Date();

  return {
    from: localDateValue(
      new Date(today.getFullYear(), today.getMonth(), 1)
    ),
    to: localDateValue(today),
  };
}

function formatMoney(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0);
}

function formatDate(value, includeTime = false) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  const options = includeTime
    ? {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    : {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      };

  return new Intl.DateTimeFormat("en-GB", options).format(date);
}

function formatShortDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function safeText(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "object") {
    return (
      value.name ||
      value.label ||
      value.code ||
      value.title ||
      value.invoiceNumber ||
      value.purchaseNumber ||
      "—"
    );
  }

  return String(value);
}

function paymentMethodLabel(method) {
  const labels = {
    cash: "نقدي",
    card: "بطاقة",
    bank_transfer: "تحويل بنكي",
    transfer: "تحويل بنكي",
    wallet: "محفظة إلكترونية",
    cheque: "شيك",
    other: "أخرى",
  };

  return labels[method] || safeText(method);
}

function paymentStatusLabel(status) {
  const labels = {
    unpaid: "غير مدفوعة",
    partial: "مدفوعة جزئيًا",
    paid: "مدفوعة",
    refunded: "مستردة",
  };

  return labels[status] || safeText(status);
}

function movementTypeLabel(type) {
  const labels = {
    sale: "بيع",
    purchase: "شراء",
    sale_return: "مرتجع بيع",
    purchase_return: "مرتجع شراء",
    adjustment: "تسوية مخزون",
    stock_adjustment: "تسوية مخزون",
    reservation: "حجز",
    release_reservation: "إلغاء حجز",
    return: "مرتجع",
    damaged: "تالف",
  };

  return labels[type] || safeText(type);
}

function presetDates(preset) {
  const today = new Date();
  const todayValue = localDateValue(today);

  if (preset === "today") {
    return { from: todayValue, to: todayValue };
  }

  if (preset === "month") {
    return {
      from: localDateValue(
        new Date(today.getFullYear(), today.getMonth(), 1)
      ),
      to: todayValue,
    };
  }

  if (preset === "lastMonth") {
    const firstDay = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1
    );

    const lastDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      0
    );

    return {
      from: localDateValue(firstDay),
      to: localDateValue(lastDay),
    };
  }

  if (preset === "year") {
    return {
      from: localDateValue(new Date(today.getFullYear(), 0, 1)),
      to: todayValue,
    };
  }

  return getInitialDates();
}

function MetricCard({ title, value, note, icon: Icon, tone = "blue" }) {
  return (
    <article className={`report-metric report-metric-${tone}`}>
      <div className="report-metric-top">
        <span className="report-metric-icon">
          <Icon size={21} />
        </span>
        {note && <span className="report-metric-note">{note}</span>}
      </div>

      <span className="report-metric-title">{title}</span>
      <strong className="report-metric-value">{value}</strong>
    </article>
  );
}

function Panel({ title, subtitle, icon: Icon, action, children, className = "" }) {
  return (
    <section className={`report-panel ${className}`}>
      <div className="report-panel-header">
        <div className="report-panel-heading">
          {Icon && (
            <span className="report-panel-icon">
              <Icon size={19} />
            </span>
          )}

          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

function EmptyState({ message = "لا توجد بيانات خلال الفترة المحددة" }) {
  return (
    <div className="report-empty">
      <BarChart3 size={30} />
      <p>{message}</p>
    </div>
  );
}

function DataTable({
  columns,
  rows,
  emptyMessage,
  rowKey,
}) {
  if (!rows || rows.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey ? rowKey(row, index) : row._id || index}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render
                    ? column.render(row, index)
                    : safeText(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }) {
  const classMap = {
    paid: "success",
    completed: "success",
    partial: "warning",
    unpaid: "danger",
    refunded: "neutral",
  };

  return (
    <span className={`report-status ${classMap[status] || "neutral"}`}>
      {paymentStatusLabel(status)}
    </span>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="report-chart-tooltip">
      {label && <strong>{safeText(label)}</strong>}

      {payload.map((item, index) => (
        <div key={`${item.dataKey}-${index}`}>
          <span>{item.name || item.dataKey}</span>
          <b>
            {typeof item.value === "number"
              ? formatMoney(item.value)
              : safeText(item.value)}
          </b>
        </div>
      ))}
    </div>
  );
}

function ReportChart({ children, height = 280 }) {
  return (
    <div className="report-chart" style={{ height }}>
      {children}
    </div>
  );
}

function SummaryRows({ rows }) {
  return (
    <div className="report-summary-list">
      {rows.map((row) => (
        <div className="report-summary-row" key={row.label}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState("sales");
  const [dates, setDates] = useState(getInitialDates);
  const [fromInput, setFromInput] = useState(() =>
  formatDateInput(getInitialDates().from)
);

const [toInput, setToInput] = useState(() =>
  formatDateInput(getInitialDates().to)
);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const { from, to } = dates;

  useEffect(() => {
    let active = true;

    async function loadReport() {
      if (!from || !to) return;

      if (from > to) {
        setError("تاريخ البداية يجب أن يكون قبل تاريخ النهاية.");
        setReport(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setReport(null);

      try {
        const data = await apiRequest(
          `/reports/${activeTab}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        );

        if (active) {
          setReport(data);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "تعذر تحميل التقرير.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadReport();

    return () => {
      active = false;
    };
  }, [activeTab, from, to, refreshKey]);

  const currentTab = tabs.find((tab) => tab.id === activeTab);

  const periodLabel = useMemo(() => {
    if (!from || !to) return "";

    return `${formatDate(`${from}T12:00:00`)} — ${formatDate(`${to}T12:00:00`)}`;
  }, [from, to]);

  function updateDate(field, value) {
    setDates((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function applyPreset(preset) {
  const nextDates = presetDates(preset);

  setDates(nextDates);
  setFromInput(formatDateInput(nextDates.from));
  setToInput(formatDateInput(nextDates.to));
}

  function exportCsv() {
    if (!report) return;

    const sections = [];
    const addSection = (title, headers, rows) => {
      sections.push([title]);
      sections.push(headers);
      rows.forEach((row) => sections.push(row));
      sections.push([]);
    };

    if (activeTab === "sales") {
      const summary = report.summary || {};

      addSection("ملخص المبيعات", ["المؤشر", "القيمة"], [
        ["عدد الفواتير", summary.invoicesCount || 0],
        ["إجمالي المبيعات", summary.totalSales || 0],
        ["المبالغ المحصلة", summary.totalPaid || 0],
        ["المبالغ المتبقية", summary.totalDue || 0],
        ["الضرائب", summary.totalTax || 0],
        ["الخصومات", summary.totalDiscounts || 0],
      ]);

      addSection(
        "المبيعات اليومية",
        ["التاريخ", "عدد الفواتير", "المبيعات", "المحصّل"],
        (report.dailySales || []).map((item) => [
          item.date,
          item.invoicesCount,
          item.sales,
          item.paid,
        ])
      );

      addSection(
        "طرق الدفع",
        ["طريقة الدفع", "عدد العمليات", "الإجمالي"],
        (report.paymentMethods || []).map((item) => [
          paymentMethodLabel(item.method),
          item.transactionsCount,
          item.total,
        ])
      );

      addSection(
        "أفضل المنتجات مبيعًا",
        ["المنتج", "SKU", "اللون", "المقاس", "الكمية", "الإيرادات", "الربح الإجمالي"],
        (report.topProducts || []).map((item) => [
          item.productName,
          item.sku,
          item.color,
          item.size,
          item.quantitySold,
          item.revenue,
          item.grossProfit,
        ])
      );

      addSection(
        "آخر الفواتير",
        ["رقم الفاتورة", "العميل", "الإجمالي", "المدفوع", "المتبقي", "حالة الدفع", "التاريخ"],
        (report.recentInvoices || []).map((item) => [
          item.invoiceNumber,
          item.customer?.name || "عميل نقدي",
          item.total,
          item.paidAmount,
          item.dueAmount,
          paymentStatusLabel(item.paymentStatus),
          formatDate(item.createdAt),
        ])
      );
    }

    if (activeTab === "profit") {
      const profit = report.profit || {};
      const purchases = report.purchases || {};

      addSection("ملخص الأرباح", ["المؤشر", "القيمة"], [
        ["عدد الفواتير", profit.invoicesCount || 0],
        ["إيرادات المبيعات", profit.salesRevenue || 0],
        ["تكلفة البضاعة المباعة", profit.costOfGoodsSold || 0],
        ["الربح الإجمالي", profit.grossProfit || 0],
        ["هامش الربح %", profit.grossProfitMarginPercent || 0],
        ["إجمالي المشتريات", purchases.purchasesCost || 0],
        ["المبالغ المستحقة للموردين", purchases.purchasesDue || 0],
      ]);

      addSection(
        "المنتجات حسب الربح",
        ["المنتج", "SKU", "الكمية المباعة", "الإيرادات", "التكلفة", "الربح", "هامش الربح %"],
        (report.topProfitProducts || []).map((item) => [
          item.productName,
          item.sku,
          item.quantitySold,
          item.revenue,
          item.cost,
          item.grossProfit,
          item.profitMarginPercent,
        ])
      );
    }

    if (activeTab === "inventory") {
      const summary = report.summary || {};

      addSection("ملخص المخزون", ["المؤشر", "القيمة"], [
        ["عدد المتغيرات", summary.activeVariants || 0],
        ["إجمالي الوحدات", summary.totalUnits || 0],
        ["الوحدات المتاحة", summary.availableUnits || 0],
        ["الوحدات المحجوزة", summary.reservedUnits || 0],
        ["قيمة المخزون بالتكلفة", summary.costValue || 0],
        ["قيمة المخزون بسعر البيع", summary.saleValue || 0],
        ["الربح المحتمل", summary.potentialProfit || 0],
        ["منتجات منخفضة المخزون", summary.lowStockCount || 0],
      ]);

      addSection(
        "منتجات منخفضة المخزون",
        ["المنتج", "SKU", "اللون", "المقاس", "الكمية", "المحجوز", "تنبيه عند وصول المخزون إلى"],
        (report.lowStockProducts || []).map((item) => [
          item.name,
          item.sku,
          item.color,
          item.size,
          item.quantity,
          item.reservedQuantity,
          item.reorderPoint,
        ])
      );

      addSection(
        "حركات المخزون",
        ["نوع الحركة", "عدد الحركات", "تغير الكمية"],
        (report.movementSummary || []).map((item) => [
          movementTypeLabel(item.type),
          item.movementsCount,
          item.quantityChange,
        ])
      );

      addSection(
        "آخر الحركات",
        ["التاريخ", "نوع الحركة", "تغير الكمية", "قبل الحركة", "بعد الحركة", "الفاتورة", "المشتريات"],
        (report.recentMovements || []).map((item) => [
          formatDate(item.createdAt, true),
          movementTypeLabel(item.type),
          item.quantityChange,
          item.stockBefore,
          item.stockAfter,
          item.invoice?.invoiceNumber,
          item.purchase?.purchaseNumber,
        ])
      );
    }

    if (activeTab === "purchases") {
      const summary = report.summary || {};

      addSection("ملخص المشتريات", ["المؤشر", "القيمة"], [
        ["عدد عمليات الشراء", summary.purchasesCount || 0],
        ["إجمالي المشتريات", summary.totalCost || 0],
        ["المبالغ المدفوعة", summary.paidAmount || 0],
        ["المبالغ المتبقية", summary.dueAmount || 0],
      ]);

      addSection(
        "المنتجات الأكثر شراءً",
        ["المنتج", "SKU", "اللون", "المقاس", "الكمية", "التكلفة الإجمالية"],
        (report.topPurchasedProducts || []).map((item) => [
          item.productName,
          item.sku,
          item.color,
          item.size,
          item.quantityPurchased,
          item.totalCost,
        ])
      );

      addSection(
        "آخر عمليات الشراء",
        ["رقم العملية", "رقم المرجع", "الإجمالي", "المدفوع", "المتبقي", "حالة الدفع", "التاريخ"],
        (report.recentPurchases || []).map((item) => [
          item.purchaseNumber,
          item.referenceNumber,
          item.totalCost,
          item.paidAmount,
          item.dueAmount,
          paymentStatusLabel(item.paymentStatus),
          formatDate(item.createdAt),
        ])
      );
    }

    const csv = "\uFEFF" + sections
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `report-${activeTab}-${from}-${to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    window.print();
  }

  const sales = report?.summary || {};
  const profit = report?.profit || {};
  const inventory = report?.summary || {};
  const purchases = report?.summary || {};

  return (
    <section className="reports-page" dir="rtl">
      <header className="reports-header">
        <div className="reports-title">
          <div className="reports-title-icon">
            <BarChart3 size={25} />
          </div>

          <div>
            <h1>التقارير والتحليلات</h1>
            <p>رؤية تفصيلية لأداء المبيعات والأرباح والمخزون والمشتريات.</p>
          </div>
        </div>

        <div className="reports-header-actions">
          <button
            type="button"
            className="report-button report-button-light"
            onClick={printReport}
            disabled={loading || !report}
          >
            <Printer size={17} />
            طباعة التقرير
          </button>

          <button
            type="button"
            className="report-button report-button-primary"
            onClick={exportCsv}
            disabled={loading || !report}
          >
            <ArrowDownToLine size={17} />
            تصدير CSV
          </button>
        </div>
      </header>

      <section className="report-filter-panel">
        <div className="report-filter-title">
          <CalendarDays size={19} />
          <div>
            <strong>الفترة الزمنية</strong>
            <span>اختر الفترة التي تريد تحليل بياناتها</span>
          </div>
        </div>

       
<div className="report-date-fields">
  <label>
    <span>من تاريخ</span>
    <input
      type="text"
      inputMode="numeric"
      placeholder="سنة/شهر/يوم"
      value={fromInput}
      maxLength={10}
      onChange={(event) => {
        const value = parseDateInput(event.target.value);
        setFromInput(value);

        if (isValidDateInput(value)) {
          const isoDate = toISODate(value);

          if (!dates.to || isoDate <= dates.to) {
            updateDate("from", isoDate);
          }
        }
      }}
      onBlur={() => {
        if (isValidDateInput(fromInput)) {
          const isoDate = toISODate(fromInput);

          if (!dates.to || isoDate <= dates.to) {
            updateDate("from", isoDate);
          } else {
            setFromInput(formatDateInput(dates.from));
          }
        } else {
          setFromInput(formatDateInput(dates.from));
        }
      }}
    />
  </label>

  <label>
    <span>إلى تاريخ</span>
    <input
      type="text"
      inputMode="numeric"
      placeholder="DD/MM/YYYY"
      value={toInput}
      maxLength={10}
      onChange={(event) => {
        const value = parseDateInput(event.target.value);
        setToInput(value);

        if (isValidDateInput(value)) {
          const isoDate = toISODate(value);

          if (!dates.from || isoDate >= dates.from) {
            updateDate("to", isoDate);
          }
        }
      }}
      onBlur={() => {
        if (isValidDateInput(toInput)) {
          const isoDate = toISODate(toInput);

          if (!dates.from || isoDate >= dates.from) {
            updateDate("to", isoDate);
          } else {
            setToInput(formatDateInput(dates.to));
          }
        } else {
          setToInput(formatDateInput(dates.to));
        }
      }}
    />
  </label>
</div>


        <div className="report-presets">
          <button type="button" onClick={() => applyPreset("today")}>
            اليوم
          </button>
          <button type="button" onClick={() => applyPreset("month")}>
            هذا الشهر
          </button>
          <button type="button" onClick={() => applyPreset("lastMonth")}>
            الشهر السابق
          </button>
          <button type="button" onClick={() => applyPreset("year")}>
            هذا العام
          </button>
        </div>

        <button
          type="button"
          className="report-refresh-button"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
          aria-label="تحديث التقرير"
          title="تحديث التقرير"
        >
          <RefreshCw size={18} className={loading ? "report-spinning" : ""} />
        </button>
      </section>

      <div className="report-period-caption">
        <span>
          <Clock size={15} />
          الفترة المعروضة: {periodLabel}
        </span>

        {report?.period && (
          <span className="report-period-live">
            <CheckCircle2 size={15} />
            تم تحميل البيانات
          </span>
        )}
      </div>

      <nav className="report-tabs" aria-label="أنواع التقارير">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              type="button"
              key={tab.id}
              className={`report-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
            >
              <Icon size={19} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {error && (
        <div className="report-alert report-alert-error" role="alert">
          <AlertTriangle size={20} />
          <div>
            <strong>تعذر تحميل التقرير</strong>
            <p>{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {loading && (
        <div className="report-loading">
          <span className="report-loader" />
          <strong>جارٍ تحميل تقرير {currentTab?.label || ""}...</strong>
          <p>نقوم بجلب البيانات من النظام وتحليلها.</p>
        </div>
      )}

      {!loading && !error && report && (
        <div className="reports-content">
          {activeTab === "sales" && (
            <>
              <div className="report-section-intro">
                <div>
                  <h2>ملخص المبيعات</h2>
                  <p>حركة المبيعات والتحصيل والفواتير خلال الفترة المختارة.</p>
                </div>
                <span className="report-section-tag">تقرير المبيعات</span>
              </div>

              <div className="report-metrics-grid">
                <MetricCard
                  title="إجمالي المبيعات"
                  value={formatMoney(sales.totalSales)}
                  note="قيمة الفواتير المكتملة"
                  icon={CircleDollarSign}
                  tone="blue"
                />
                <MetricCard
                  title="عدد الفواتير"
                  value={formatNumber(sales.invoicesCount)}
                  note="فاتورة مكتملة"
                  icon={FileText}
                  tone="purple"
                />
                <MetricCard
                  title="المبالغ المحصلة"
                  value={formatMoney(sales.totalPaid)}
                  note="إجمالي المدفوع"
                  icon={Wallet}
                  tone="green"
                />
                <MetricCard
                  title="المبالغ المتبقية"
                  value={formatMoney(sales.totalDue)}
                  note="مستحقات العملاء"
                  icon={Clock}
                  tone="orange"
                />
                <MetricCard
                  title="إجمالي الخصومات"
                  value={formatMoney(sales.totalDiscounts)}
                  icon={TrendingDown}
                  tone="rose"
                />
                <MetricCard
                  title="إجمالي الضرائب"
                  value={formatMoney(sales.totalTax)}
                  icon={Activity}
                  tone="teal"
                />
              </div>

              <div className="report-charts-grid">
                <Panel
                  title="حركة المبيعات اليومية"
                  subtitle="قيمة المبيعات والتحصيل يومًا بيوم"
                  icon={TrendingUp}
                  className="report-panel-wide"
                >
                  {report.dailySales?.length ? (
                    <ReportChart height={320}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={report.dailySales}
                          margin={{ top: 12, right: 8, left: 8, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
                            </linearGradient>
                            <linearGradient id="paidGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0d9488" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#edf0f6" strokeDasharray="4 4" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tickFormatter={formatShortDate}
                            tick={{ fill: "#64748b", fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tickFormatter={(value) => numberFormatter.format(value)}
                            tick={{ fill: "#64748b", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={58}
                          />
                          <Tooltip
                            content={<ChartTooltip />}
                            labelFormatter={(label) => formatDate(`${label}T12:00:00`)}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="sales"
                            name="المبيعات"
                            stroke="#4f46e5"
                            strokeWidth={2.5}
                            fill="url(#salesGradient)"
                            activeDot={{ r: 5 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="paid"
                            name="المحصّل"
                            stroke="#0d9488"
                            strokeWidth={2.5}
                            fill="url(#paidGradient)"
                            activeDot={{ r: 5 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </ReportChart>
                  ) : (
                    <EmptyState />
                  )}
                </Panel>

                <Panel
                  title="طرق الدفع"
                  subtitle="توزيع التحصيل حسب وسيلة الدفع"
                  icon={CreditCard}
                >
                  {report.paymentMethods?.length ? (
                    <>
                      <ReportChart height={235}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={report.paymentMethods.map((item) => ({
                                ...item,
                                name: paymentMethodLabel(item.method),
                                value: item.total,
                              }))}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={58}
                              outerRadius={88}
                              paddingAngle={3}
                            >
                              {report.paymentMethods.map((item, index) => (
                                <Cell
                                  key={item.method || index}
                                  fill={chartColors[index % chartColors.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip content={<ChartTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </ReportChart>

                      <div className="report-legend-list">
                        {report.paymentMethods.map((item, index) => (
                          <div className="report-legend-item" key={item.method || index}>
                            <span
                              className="report-legend-dot"
                              style={{
                                backgroundColor: chartColors[index % chartColors.length],
                              }}
                            />
                            <span>{paymentMethodLabel(item.method)}</span>
                            <strong>{formatMoney(item.total)}</strong>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <EmptyState message="لا توجد دفعات مسجلة في هذه الفترة" />
                  )}
                </Panel>
              </div>

              <Panel
                title="أفضل المنتجات مبيعًا"
                subtitle="المنتجات مرتبة حسب عدد الوحدات المباعة"
                icon={Package}
              >
                <DataTable
                  rows={report.topProducts}
                  emptyMessage="لا توجد مبيعات منتجات في هذه الفترة"
                  columns={[
                    { key: "productName", label: "المنتج" },
                    { key: "sku", label: "SKU" },
                    { key: "color", label: "اللون" },
                    { key: "size", label: "المقاس" },
                    {
                      key: "quantitySold",
                      label: "الكمية المباعة",
                      render: (row) => formatNumber(row.quantitySold),
                    },
                    {
                      key: "revenue",
                      label: "الإيرادات",
                      render: (row) => formatMoney(row.revenue),
                    },
                    {
                      key: "grossProfit",
                      label: "الربح الإجمالي",
                      render: (row) => formatMoney(row.grossProfit),
                    },
                  ]}
                />
              </Panel>

              <Panel
                title="آخر الفواتير"
                subtitle="أحدث الفواتير المكتملة ضمن الفترة المختارة"
                icon={FileText}
              >
                <DataTable
                  rows={report.recentInvoices}
                  emptyMessage="لا توجد فواتير خلال الفترة المحددة"
                  columns={[
                    { key: "invoiceNumber", label: "رقم الفاتورة" },
                    {
                      key: "customer",
                      label: "العميل",
                      render: (row) => row.customer?.name || "عميل نقدي",
                    },
                    {
                      key: "total",
                      label: "الإجمالي",
                      render: (row) => formatMoney(row.total),
                    },
                    {
                      key: "paidAmount",
                      label: "المدفوع",
                      render: (row) => formatMoney(row.paidAmount),
                    },
                    {
                      key: "dueAmount",
                      label: "المتبقي",
                      render: (row) => formatMoney(row.dueAmount),
                    },
                    {
                      key: "paymentStatus",
                      label: "حالة الدفع",
                      render: (row) => <StatusPill status={row.paymentStatus} />,
                    },
                    {
                      key: "createdAt",
                      label: "التاريخ",
                      render: (row) => formatDate(row.createdAt),
                    },
                  ]}
                />
              </Panel>
            </>
          )}

          {activeTab === "profit" && (
            <>
              <div className="report-section-intro">
                <div>
                  <h2>تحليل الأرباح</h2>
                  <p>مقارنة إيرادات المبيعات بتكلفة البضاعة المباعة.</p>
                </div>
                <span className="report-section-tag">تقرير الأرباح</span>
              </div>

              <div className="report-metrics-grid">
                <MetricCard
                  title="إيرادات المبيعات"
                  value={formatMoney(profit.salesRevenue)}
                  icon={TrendingUp}
                  tone="blue"
                />
                <MetricCard
                  title="تكلفة البضاعة المباعة"
                  value={formatMoney(profit.costOfGoodsSold)}
                  icon={Package}
                  tone="orange"
                />
                <MetricCard
                  title="الربح الإجمالي"
                  value={formatMoney(profit.grossProfit)}
                  note="الإيرادات ناقص تكلفة البضاعة"
                  icon={CircleDollarSign}
                  tone="green"
                />
                <MetricCard
                  title="هامش الربح"
                  value={`${formatNumber(profit.grossProfitMarginPercent)}%`}
                  icon={Activity}
                  tone="purple"
                />
              </div>

              <div className="report-two-columns">
                <Panel
                  title="المنتجات حسب الربح"
                  subtitle="أعلى المنتجات تحقيقًا للربح الإجمالي"
                  icon={TrendingUp}
                  className="report-panel-wide"
                >
                  {report.topProfitProducts?.length ? (
                    <ReportChart height={320}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={report.topProfitProducts.slice(0, 10)}
                          margin={{ top: 12, right: 8, left: 8, bottom: 45 }}
                        >
                          <CartesianGrid stroke="#edf0f6" strokeDasharray="4 4" vertical={false} />
                          <XAxis
                            dataKey="productName"
                            interval={0}
                            angle={-25}
                            textAnchor="end"
                            height={65}
                            tick={{ fill: "#64748b", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tickFormatter={(value) => numberFormatter.format(value)}
                            tick={{ fill: "#64748b", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar
                            dataKey="grossProfit"
                            name="الربح الإجمالي"
                            fill="#0d9488"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={44}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </ReportChart>
                  ) : (
                    <EmptyState />
                  )}
                </Panel>

                <Panel
                  title="ملخص المشتريات"
                  subtitle="تكلفة المشتريات والتزامات الموردين"
                  icon={ShoppingBag}
                >
                  <SummaryRows
                    rows={[
                      {
                        label: "عدد عمليات الشراء",
                        value: formatNumber(report.purchases?.purchasesCount),
                      },
                      {
                        label: "إجمالي المشتريات",
                        value: formatMoney(report.purchases?.purchasesCost),
                      },
                      {
                        label: "المبالغ المدفوعة",
                        value: formatMoney(report.purchases?.purchasesPaid),
                      },
                      {
                        label: "المبالغ المستحقة",
                        value: formatMoney(report.purchases?.purchasesDue),
                      },
                    ]}
                  />
                  <div className="report-note">
                    <Activity size={17} />
                    <span>
                      الربح المعروض إجمالي تقديري قبل احتساب المصروفات التشغيلية
                      والمرتجعات غير المخصومة من هذه المعادلة.
                    </span>
                  </div>
                </Panel>
              </div>

              <Panel
                title="تفاصيل ربحية المنتجات"
                subtitle="مقارنة الكمية المباعة والإيرادات والتكلفة وهامش الربح"
                icon={BarChart3}
              >
                <DataTable
                  rows={report.topProfitProducts}
                  emptyMessage="لا توجد بيانات كافية لحساب الأرباح"
                  columns={[
                    { key: "productName", label: "المنتج" },
                    { key: "sku", label: "SKU" },
                    {
                      key: "quantitySold",
                      label: "الكمية المباعة",
                      render: (row) => formatNumber(row.quantitySold),
                    },
                    {
                      key: "revenue",
                      label: "الإيرادات",
                      render: (row) => formatMoney(row.revenue),
                    },
                    {
                      key: "cost",
                      label: "التكلفة",
                      render: (row) => formatMoney(row.cost),
                    },
                    {
                      key: "grossProfit",
                      label: "الربح",
                      render: (row) => (
                        <strong className={row.grossProfit < 0 ? "report-negative" : "report-positive"}>
                          {formatMoney(row.grossProfit)}
                        </strong>
                      ),
                    },
                    {
                      key: "profitMarginPercent",
                      label: "هامش الربح",
                      render: (row) => `${formatNumber(row.profitMarginPercent)}%`,
                    },
                  ]}
                />
              </Panel>
            </>
          )}

          {activeTab === "inventory" && (
            <>
              <div className="report-section-intro">
                <div>
                  <h2>تحليل المخزون</h2>
                  <p>القيمة الحالية للمخزون وحالة الكميات وحركاتها خلال الفترة.</p>
                </div>
                <span className="report-section-tag">تقرير المخزون</span>
              </div>

              <div className="report-metrics-grid">
                <MetricCard
                  title="إجمالي الوحدات"
                  value={formatNumber(inventory.totalUnits)}
                  note="كل الوحدات المسجلة"
                  icon={Package}
                  tone="blue"
                />
                <MetricCard
                  title="الوحدات المتاحة"
                  value={formatNumber(inventory.availableUnits)}
                  note="بعد خصم المحجوز"
                  icon={CheckCircle2}
                  tone="green"
                />
                <MetricCard
                  title="الوحدات المحجوزة"
                  value={formatNumber(inventory.reservedUnits)}
                  icon={Clock}
                  tone="orange"
                />
                <MetricCard
                  title="قيمة المخزون بالتكلفة"
                  value={formatMoney(inventory.costValue)}
                  icon={Wallet}
                  tone="purple"
                />
                <MetricCard
                  title="قيمة المخزون بسعر البيع"
                  value={formatMoney(inventory.saleValue)}
                  icon={CircleDollarSign}
                  tone="teal"
                />
                <MetricCard
                  title="الربح المحتمل"
                  value={formatMoney(inventory.potentialProfit)}
                  icon={TrendingUp}
                  tone="green"
                />
                <MetricCard
                  title="متغيرات المنتجات"
                  value={formatNumber(inventory.activeVariants)}
                  icon={ShoppingBag}
                  tone="blue"
                />
                <MetricCard
                  title="مخزون منخفض"
                  value={formatNumber(inventory.lowStockCount)}
                  note="يحتاج إلى مراجعة"
                  icon={AlertTriangle}
                  tone="rose"
                />
              </div>

              <div className="report-two-columns">
                <Panel
                  title="ملخص حركات المخزون"
                  subtitle="عدد الحركات وصافي تغير الكميات حسب النوع"
                  icon={Activity}
                  className="report-panel-wide"
                >
                  {report.movementSummary?.length ? (
                    <ReportChart height={300}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={report.movementSummary.map((item) => ({
                            ...item,
                            label: movementTypeLabel(item.type),
                          }))}
                          margin={{ top: 12, right: 8, left: 8, bottom: 8 }}
                        >
                          <CartesianGrid stroke="#edf0f6" strokeDasharray="4 4" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fill: "#64748b", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fill: "#64748b", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend />
                          <Bar
                            dataKey="movementsCount"
                            name="عدد الحركات"
                            fill="#4f46e5"
                            radius={[5, 5, 0, 0]}
                          />
                          <Bar
                            dataKey="quantityChange"
                            name="تغير الكمية"
                            fill="#0d9488"
                            radius={[5, 5, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </ReportChart>
                  ) : (
                    <EmptyState message="لا توجد حركات مخزون خلال هذه الفترة" />
                  )}
                </Panel>

                <Panel
                  title="قيمة المخزون"
                  subtitle="مقارنة القيمة بالتكلفة والقيمة البيعية"
                  icon={CircleDollarSign}
                >
                  <div className="inventory-value-card">
                    <div className="inventory-value-row">
                      <span className="inventory-value-dot cost" />
                      <span>قيمة المخزون بالتكلفة</span>
                      <strong>{formatMoney(inventory.costValue)}</strong>
                    </div>
                    <div className="inventory-value-row">
                      <span className="inventory-value-dot sale" />
                      <span>القيمة بسعر البيع</span>
                      <strong>{formatMoney(inventory.saleValue)}</strong>
                    </div>
                    <div className="inventory-value-highlight">
                      <span>الفرق المحتمل</span>
                      <strong>{formatMoney(inventory.potentialProfit)}</strong>
                    </div>
                  </div>

                  <div className="report-note">
                    <AlertTriangle size={17} />
                    <span>
                      القيمة البيعية والربح المحتمل تقديرات مبنية على الأسعار
                      الحالية والكميات المسجلة، وليسا أرباحًا محققة.
                    </span>
                  </div>
                </Panel>
              </div>

              <Panel
                title="المنتجات منخفضة المخزون"
                subtitle="المنتجات التي وصلت إلى حد إعادة الطلب أو انخفضت عنه"
                icon={AlertTriangle}
              >
                <DataTable
                  rows={report.lowStockProducts}
                  emptyMessage="لا توجد منتجات منخفضة المخزون حاليًا"
                  columns={[
                    { key: "name", label: "المنتج" },
                    { key: "sku", label: "SKU" },
                    { key: "color", label: "اللون" },
                    { key: "size", label: "المقاس" },
                    {
                      key: "quantity",
                      label: "الكمية الحالية",
                      render: (row) => (
                        <strong className="report-low-stock">
                          {formatNumber(row.quantity)}
                        </strong>
                      ),
                    },
                    {
                      key: "reservedQuantity",
                      label: "المحجوز",
                      render: (row) => formatNumber(row.reservedQuantity),
                    },
                    {
                      key: "reorderPoint",
                      label: "تنبيه عند وصول المخزون إلى",
                      render: (row) => formatNumber(row.reorderPoint),
                    },
                  ]}
                />
              </Panel>

              <Panel
                title="آخر حركات المخزون"
                subtitle="آخر 50 حركة مسجلة ضمن الفترة المختارة"
                icon={Activity}
              >
                <DataTable
                  rows={report.recentMovements}
                  emptyMessage="لا توجد حركات مخزون خلال الفترة المحددة"
                  columns={[
                    {
                      key: "createdAt",
                      label: "التاريخ",
                      render: (row) => formatDate(row.createdAt, true),
                    },
                    {
                      key: "type",
                      label: "نوع الحركة",
                      render: (row) => movementTypeLabel(row.type),
                    },
                    {
                      key: "quantityChange",
                      label: "تغير الكمية",
                      render: (row) => (
                        <strong className={Number(row.quantityChange) < 0 ? "report-negative" : "report-positive"}>
                          {formatNumber(row.quantityChange)}
                        </strong>
                      ),
                    },
                    {
                      key: "stockBefore",
                      label: "قبل الحركة",
                      render: (row) => formatNumber(row.stockBefore),
                    },
                    {
                      key: "stockAfter",
                      label: "بعد الحركة",
                      render: (row) => formatNumber(row.stockAfter),
                    },
                    {
                      key: "invoice",
                      label: "الفاتورة",
                      render: (row) => row.invoice?.invoiceNumber || "—",
                    },
                    {
                      key: "purchase",
                      label: "المشتريات",
                      render: (row) => row.purchase?.purchaseNumber || "—",
                    },
                    {
                      key: "performedBy",
                      label: "بواسطة",
                      render: (row) => row.performedBy?.name || "—",
                    },
                  ]}
                />
              </Panel>
            </>
          )}

          {activeTab === "purchases" && (
            <>
              <div className="report-section-intro">
                <div>
                  <h2>تحليل المشتريات</h2>
                  <p>متابعة تكلفة التوريد والمبالغ المدفوعة والمستحقة.</p>
                </div>
                <span className="report-section-tag">تقرير المشتريات</span>
              </div>

              <div className="report-metrics-grid">
                <MetricCard
                  title="إجمالي المشتريات"
                  value={formatMoney(purchases.totalCost)}
                  icon={ShoppingBag}
                  tone="blue"
                />
                <MetricCard
                  title="عدد عمليات الشراء"
                  value={formatNumber(purchases.purchasesCount)}
                  icon={FileText}
                  tone="purple"
                />
                <MetricCard
                  title="المبالغ المدفوعة"
                  value={formatMoney(purchases.paidAmount)}
                  icon={Wallet}
                  tone="green"
                />
                <MetricCard
                  title="المبالغ المستحقة"
                  value={formatMoney(purchases.dueAmount)}
                  icon={Clock}
                  tone="orange"
                />
              </div>

              <Panel
                title="المنتجات الأكثر شراءً"
                subtitle="المنتجات مرتبة حسب عدد الوحدات التي تم شراؤها"
                icon={Package}
              >
                {report.topPurchasedProducts?.length ? (
                  <>
                    <ReportChart height={310}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={report.topPurchasedProducts.slice(0, 10)}
                          margin={{ top: 12, right: 8, left: 8, bottom: 45 }}
                        >
                          <CartesianGrid stroke="#edf0f6" strokeDasharray="4 4" vertical={false} />
                          <XAxis
                            dataKey="productName"
                            interval={0}
                            angle={-25}
                            textAnchor="end"
                            height={65}
                            tick={{ fill: "#64748b", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fill: "#64748b", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar
                            dataKey="quantityPurchased"
                            name="الكمية المشتراة"
                            fill="#4f46e5"
                            radius={[5, 5, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </ReportChart>
                  </>
                ) : (
                  <EmptyState message="لا توجد منتجات مشتراة خلال الفترة المحددة" />
                )}

                <DataTable
                  rows={report.topPurchasedProducts}
                  emptyMessage="لا توجد بيانات مشتريات"
                  columns={[
                    { key: "productName", label: "المنتج" },
                    { key: "sku", label: "SKU" },
                    { key: "color", label: "اللون" },
                    { key: "size", label: "المقاس" },
                    {
                      key: "quantityPurchased",
                      label: "الكمية المشتراة",
                      render: (row) => formatNumber(row.quantityPurchased),
                    },
                    {
                      key: "totalCost",
                      label: "التكلفة الإجمالية",
                      render: (row) => formatMoney(row.totalCost),
                    },
                  ]}
                />
              </Panel>

              <Panel
                title="آخر عمليات الشراء"
                subtitle="أحدث عمليات الشراء المكتملة ضمن الفترة المختارة"
                icon={FileText}
              >
                <DataTable
                  rows={report.recentPurchases}
                  emptyMessage="لا توجد عمليات شراء خلال الفترة المحددة"
                  columns={[
                    { key: "purchaseNumber", label: "رقم الشراء" },
                    { key: "referenceNumber", label: "رقم المرجع" },
                    {
                      key: "totalCost",
                      label: "الإجمالي",
                      render: (row) => formatMoney(row.totalCost),
                    },
                    {
                      key: "paidAmount",
                      label: "المدفوع",
                      render: (row) => formatMoney(row.paidAmount),
                    },
                    {
                      key: "dueAmount",
                      label: "المتبقي",
                      render: (row) => formatMoney(row.dueAmount),
                    },
                    {
                      key: "paymentStatus",
                      label: "حالة الدفع",
                      render: (row) => <StatusPill status={row.paymentStatus} />,
                    },
                    {
                      key: "createdAt",
                      label: "التاريخ",
                      render: (row) => formatDate(row.createdAt),
                    },
                  ]}
                />
              </Panel>
            </>
          )}
        </div>
      )}

      {!loading && !error && !report && (
        <div className="report-panel">
          <EmptyState message="لا توجد بيانات لعرضها. جرّب تغيير الفترة الزمنية." />
        </div>
      )}
    </section>
  );
}
