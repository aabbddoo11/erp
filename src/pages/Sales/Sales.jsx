
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Eye,
  Pencil,
  Trash2,
  CreditCard,
  RefreshCw,
  Search,
  X,
  PlusCircle,
  MinusCircle,
  Printer,
} from "lucide-react";
import { apiRequest } from "../../services/api";
import "./Sales.css";

const invoiceStatusLabels = {
  draft: "مسودة",
  completed: "مكتملة",
  cancelled: "ملغاة",
  partially_returned: "مُعاد جزء منها",
  returned: "مُعادة بالكامل",
};

const paymentStatusLabels = {
  unpaid: "غير مدفوعة",
  partial: "مدفوعة جزئيًا",
  paid: "مدفوعة",
  refunded: "مستردة",
};

const currencyFormatter = new Intl.NumberFormat("ar-EG", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 0,
  useGrouping: false,
});

const dateFormatter = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const emptyItem = () => ({
  product: "",
  variant: "",
  productName: "",
  sku: "",
  color: "",
  size: "",
  quantity: 1,
  unitPrice: 0,
  unitCost: 0,
  discount: 0,
});

const emptyInvoice = () => ({
  customer: "",
  items: [emptyItem()],
  invoiceDiscount: 0,
  taxRate: 0,
  notes: "",
});

function unwrap(response) {
  return response?.data ?? response;
}

function getId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return String(value._id || value.id || "");
  }
  return String(value);
}

function displayValue(value, fallback = "—") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return (
        value
          .map((item) => displayValue(item, ""))
          .filter(Boolean)
          .join("، ") || fallback
      );
    }

    return (
      value.name ??
      value.label ??
      value.value ??
      value.title ??
      getId(value) ??
      fallback
    );
  }

  return String(value);
}

function formatMoney(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : dateFormatter.format(date);
}

function getStatusClass(status) {
  switch (status) {
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "draft":
      return "draft";
    case "returned":
      return "returned";
    case "partially_returned":
      return "partial";
    default:
      return "unknown";
  }
}

function getPaymentClass(status) {
  switch (status) {
    case "paid":
      return "paid";
    case "partial":
      return "partial";
    case "unpaid":
      return "unpaid";
    case "refunded":
      return "refunded";
    default:
      return "unknown";
  }
}

function getInvoiceId(invoice) {
  return getId(invoice?._id || invoice?.id);
}

function getCustomerName(customer) {
  if (!customer) return "عميل نقدي";

  if (typeof customer === "object") {
    return displayValue(
      customer.name || customer.fullName || customer,
      "عميل نقدي"
    );
  }

  return displayValue(customer, "عميل نقدي");
}

function getItemFromInvoice(item = {}) {
  return {
    product: getId(item.product),
    variant: getId(item.variant),
    productName: displayValue(item.productName, ""),
    sku: displayValue(item.sku, ""),
    color: displayValue(item.color, ""),
    size: displayValue(item.size, ""),
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.unitPrice) || 0,
    unitCost: Number(item.unitCost) || 0,
    discount: Number(item.discount) || 0,
  };
}

function getInvoiceFormData(invoice) {
  return {
    customer: getId(invoice.customer),
    items:
      Array.isArray(invoice.items) && invoice.items.length
        ? invoice.items.map(getItemFromInvoice)
        : [emptyItem()],
    invoiceDiscount: Number(invoice.invoiceDiscount) || 0,
    taxRate: Number(invoice.taxRate) || 0,
    notes: displayValue(invoice.notes, ""),
  };
}

function getErrorMessage(error, fallback) {
  return error?.message || fallback;
}

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div
      className="sales-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`sales-payment-modal ${wide ? "sales-modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sales-modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>

          <button
            type="button"
            className="sales-modal-close"
            onClick={onClose}
            aria-label="إغلاق"
          >
            <X size={19} />
          </button>
        </div>

        {children}
      </section>
    </div>
  );
}

function InvoiceDetails({ invoice }) {
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  return (
    <div className="sales-details">
      <div className="sales-payment-details">
        <div>
          <span>رقم الفاتورة</span>
          <strong>{displayValue(invoice.invoiceNumber)}</strong>
        </div>
        <div>
          <span>العميل</span>
          <strong>{getCustomerName(invoice.customer)}</strong>
        </div>
        <div>
          <span>التاريخ</span>
          <strong>{formatDate(invoice.createdAt)}</strong>
        </div>
        <div>
          <span>حالة الفاتورة</span>
          <strong>
            {displayValue(invoiceStatusLabels[invoice.status] || invoice.status)}
          </strong>
        </div>
      </div>

      <h3>منتجات الفاتورة</h3>

      <div className="sales-table-wrapper">
        <table className="sales-table">
          <thead>
            <tr>
              <th>المنتج</th>
              <th>SKU</th>
              <th>اللون</th>
              <th>المقاس</th>
              <th>الكمية</th>
              <th>سعر الوحدة</th>
              <th>الخصم</th>
              <th>الإجمالي</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => (
              <tr key={item._id || `${item.sku || "item"}-${index}`}>
                <td>{displayValue(item.productName)}</td>
                <td>{displayValue(item.sku)}</td>
                <td>{displayValue(item.color)}</td>
                <td>{displayValue(item.size)}</td>
                <td>{Number(item.quantity) || 0}</td>
                <td>{formatMoney(item.unitPrice)}</td>
                <td>{formatMoney(item.discount)}</td>
                <td>
                  {formatMoney(
                    item.lineTotal ??
                      Number(item.quantity || 0) *
                        Number(item.unitPrice || 0) -
                        Number(item.discount || 0)
                  )}
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan={8}>لا توجد منتجات في هذه الفاتورة.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="sales-invoice-totals">
        <div>
          <span>الإجمالي قبل الخصومات</span>
          <strong>{formatMoney(invoice.subtotal)}</strong>
        </div>
        <div>
          <span>خصم الفاتورة</span>
          <strong>{formatMoney(invoice.invoiceDiscount)}</strong>
        </div>
        <div>
          <span>الضريبة</span>
          <strong>{formatMoney(invoice.taxAmount)}</strong>
        </div>
        <div>
          <span>إجمالي الفاتورة</span>
          <strong>{formatMoney(invoice.total)}</strong>
        </div>
        <div>
          <span>المدفوع</span>
          <strong>{formatMoney(invoice.paidAmount)}</strong>
        </div>
        <div>
          <span>المتبقي</span>
          <strong>{formatMoney(invoice.dueAmount)}</strong>
        </div>
      </div>

      {invoice.notes && (
        <div className="sales-invoice-notes">
          <strong>ملاحظات:</strong> {displayValue(invoice.notes)}
        </div>
      )}

      {Array.isArray(invoice.payments) && invoice.payments.length > 0 && (
        <>
          <h3>الدفعات المسجلة</h3>
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>المبلغ</th>
                  <th>طريقة الدفع</th>
                  <th>المرجع</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((payment, index) => (
                  <tr key={payment._id || index}>
                    <td>{formatDate(payment.paidAt || payment.date)}</td>
                    <td>{formatMoney(payment.amount)}</td>
                    <td>{displayValue(payment.method)}</td>
                    <td>{displayValue(payment.reference)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function InvoiceEditor({
  initialInvoice,
  mode,
  saving,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() =>
    initialInvoice
      ? getInvoiceFormData(initialInvoice)
      : emptyInvoice()
  );
  const [formError, setFormError] = useState("");

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateItem(index, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, emptyItem()],
    }));
  }

  function removeItem(index) {
    setForm((current) => ({
      ...current,
      items:
        current.items.length <= 1
          ? [emptyItem()]
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  const calculatedSubtotal = useMemo(
    () =>
      form.items.reduce((sum, item) => {
        const quantity = Number(item.quantity) || 0;
        const price = Number(item.unitPrice) || 0;
        const discount = Number(item.discount) || 0;
        return sum + Math.max(0, quantity * price - discount);
      }, 0),
    [form.items]
  );

  const calculatedTotal = useMemo(() => {
    const discount = Number(form.invoiceDiscount) || 0;
    const taxRate = Number(form.taxRate) || 0;
    const taxableAmount = Math.max(0, calculatedSubtotal - discount);
    return taxableAmount + taxableAmount * taxRate / 100;
  }, [calculatedSubtotal, form.invoiceDiscount, form.taxRate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    if (!form.items.length) {
      setFormError("أضف منتجًا واحدًا على الأقل.");
      return;
    }

    for (let index = 0; index < form.items.length; index += 1) {
      const item = form.items[index];

      if (!item.product.trim()) {
        setFormError(`أدخل معرّف المنتج في السطر ${index + 1}.`);
        return;
      }

      if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
        setFormError(`الكمية في السطر ${index + 1} يجب أن تكون أكبر من صفر.`);
        return;
      }

      if (!Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0) {
        setFormError(`السعر في السطر ${index + 1} غير صحيح.`);
        return;
      }
    }

    const payload = {
      customer: form.customer.trim() || undefined,
      items: form.items.map((item) => ({
        product: item.product.trim(),
        ...(item.variant.trim() ? { variant: item.variant.trim() } : {}),
        productName: item.productName.trim(),
        sku: item.sku.trim(),
        color: item.color.trim(),
        size: item.size.trim(),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        unitCost: Number(item.unitCost) || 0,
        discount: Number(item.discount) || 0,
      })),
      invoiceDiscount: Number(form.invoiceDiscount) || 0,
      taxRate: Number(form.taxRate) || 0,
      notes: form.notes.trim(),
    };

    try {
      await onSave(payload);
    } catch (error) {
      setFormError(getErrorMessage(error, "تعذر حفظ الفاتورة."));
    }
  }

  return (
    <Modal
      title={mode === "create" ? "إنشاء فاتورة جديدة" : "تعديل الفاتورة"}
      subtitle="أدخل بيانات الفاتورة والمنتجات."
      onClose={onClose}
      wide
    >
      <form className="sales-editor-form" onSubmit={handleSubmit}>
        <div className="sales-form-grid">
          <div className="sales-form-field">
            <label htmlFor="invoice-customer">معرّف العميل (اختياري)</label>
            <input
              id="invoice-customer"
              value={form.customer}
              onChange={(event) => updateField("customer", event.target.value)}
              placeholder="Customer ID"
            />
          </div>

          <div className="sales-form-field">
            <label htmlFor="invoice-discount">خصم الفاتورة</label>
            <input
              id="invoice-discount"
              type="number"
              min="0"
              step="0.01"
              value={form.invoiceDiscount}
              onChange={(event) =>
                updateField("invoiceDiscount", event.target.value)
              }
            />
          </div>

          <div className="sales-form-field">
            <label htmlFor="invoice-tax">نسبة الضريبة (%)</label>
            <input
              id="invoice-tax"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.taxRate}
              onChange={(event) => updateField("taxRate", event.target.value)}
            />
          </div>
        </div>

        <div className="sales-editor-items-heading">
          <h3>المنتجات</h3>
          <button
            type="button"
            className="sales-payment-button"
            onClick={addItem}
          >
            <PlusCircle size={16} /> إضافة منتج
          </button>
        </div>

        {form.items.map((item, index) => (
          <fieldset className="sales-editor-item" key={index}>
            <legend>المنتج {index + 1}</legend>

            <button
              type="button"
              className="sales-remove-item"
              onClick={() => removeItem(index)}
              title="حذف هذا المنتج"
              aria-label={`حذف المنتج ${index + 1}`}
            >
              <MinusCircle size={18} />
            </button>

            <div className="sales-form-grid">
              <div className="sales-form-field">
                <label>معرّف المنتج *</label>
                <input
                  required
                  value={item.product}
                  onChange={(event) =>
                    updateItem(index, "product", event.target.value)
                  }
                  placeholder="Product ID"
                />
              </div>

              <div className="sales-form-field">
                <label>معرّف المتغير (اختياري)</label>
                <input
                  value={item.variant}
                  onChange={(event) =>
                    updateItem(index, "variant", event.target.value)
                  }
                  placeholder="Variant ID"
                />
              </div>

              <div className="sales-form-field">
                <label>اسم المنتج</label>
                <input
                  value={item.productName}
                  onChange={(event) =>
                    updateItem(index, "productName", event.target.value)
                  }
                  placeholder="اسم المنتج"
                />
              </div>

              <div className="sales-form-field">
                <label>SKU</label>
                <input
                  value={item.sku}
                  onChange={(event) =>
                    updateItem(index, "sku", event.target.value)
                  }
                  placeholder="رمز المنتج"
                />
              </div>

              <div className="sales-form-field">
                <label>اللون</label>
                <input
                  value={item.color}
                  onChange={(event) =>
                    updateItem(index, "color", event.target.value)
                  }
                  placeholder="اللون أو اسم اللون"
                />
              </div>

              <div className="sales-form-field">
                <label>المقاس</label>
                <input
                  value={item.size}
                  onChange={(event) =>
                    updateItem(index, "size", event.target.value)
                  }
                  placeholder="المقاس"
                />
              </div>

              <div className="sales-form-field">
                <label>الكمية *</label>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(index, "quantity", event.target.value)
                  }
                />
              </div>

              <div className="sales-form-field">
                <label>سعر الوحدة *</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(event) =>
                    updateItem(index, "unitPrice", event.target.value)
                  }
                />
              </div>

              <div className="sales-form-field">
                <label>تكلفة الوحدة</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitCost}
                  onChange={(event) =>
                    updateItem(index, "unitCost", event.target.value)
                  }
                />
              </div>

              <div className="sales-form-field">
                <label>خصم المنتج</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.discount}
                  onChange={(event) =>
                    updateItem(index, "discount", event.target.value)
                  }
                />
              </div>
            </div>
          </fieldset>
        ))}

        <div className="sales-editor-totals">
          <div>
            <span>المجموع التقديري</span>
            <strong>{formatMoney(calculatedSubtotal)}</strong>
          </div>
          <div>
            <span>الإجمالي التقديري بعد الخصم والضريبة</span>
            <strong>{formatMoney(calculatedTotal)}</strong>
          </div>
        </div>

        <div className="sales-form-field">
          <label htmlFor="invoice-notes">ملاحظات</label>
          <textarea
            id="invoice-notes"
            rows={3}
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="ملاحظات إضافية على الفاتورة"
          />
        </div>

        {formError && (
          <div className="sales-error" role="alert">
            {formError}
          </div>
        )}

        <div className="sales-modal-actions">
          <button
            type="button"
            className="sales-reset-button"
            onClick={onClose}
            disabled={saving}
          >
            إلغاء
          </button>

          <button
            type="submit"
            className="sales-payment-button"
            disabled={saving}
          >
            {saving ? "جارٍ الحفظ..." : "حفظ الفاتورة"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Sales() {
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [success, setSuccess] = useState("");

  const [detailsInvoice, setDetailsInvoice] = useState(null);
  const [editor, setEditor] = useState(null);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState("");

  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });

      if (status) params.set("status", status);
      if (paymentStatus) params.set("paymentStatus", paymentStatus);

      const response = unwrap(
        await apiRequest(`/invoices?${params.toString()}`)
      );

      setInvoices(Array.isArray(response.invoices) ? response.invoices : []);
      setPagination(
        response.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          pages: 0,
        }
      );
    } catch (err) {
      setError(getErrorMessage(err, "تعذر تحميل الفواتير."));
    } finally {
      setLoading(false);
    }
  }, [page, status, paymentStatus, reloadKey]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return invoices;

    return invoices.filter((invoice) => {
      const invoiceNumber = displayValue(invoice.invoiceNumber, "").toLowerCase();
      const customerName = getCustomerName(invoice.customer).toLowerCase();
      const customerPhone = displayValue(invoice.customer?.phone, "");

      return (
        invoiceNumber.includes(query) ||
        customerName.includes(query) ||
        customerPhone.includes(query)
      );
    });
  }, [invoices, search]);

  function resetFilters() {
    setSearch("");
    setStatus("");
    setPaymentStatus("");
    setPage(1);
  }

  function showSuccess(message) {
    setSuccess(message);
    setError("");
  }

  async function openDetails(invoice) {
    try {
      setError("");
      const response = unwrap(
        await apiRequest(`/invoices/${getInvoiceId(invoice)}`)
      );
      setDetailsInvoice(response.invoice || response);
    } catch (err) {
      setError(getErrorMessage(err, "تعذر تحميل تفاصيل الفاتورة."));
    }
  }

  async function printInvoice(invoice) {
    const printWindow = window.open("", "_blank", "width=1000,height=750");

    if (!printWindow) {
      setError("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة للموقع ثم حاول مجددًا.");
      return;
    }

    const escapeHtml = (value) =>
      String(value ?? "—")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const money = (value) => escapeHtml(formatMoney(value));
    const text = (value, fallback = "—") =>
      escapeHtml(displayValue(value, fallback));
    const date = (value) => escapeHtml(formatDate(value));
    const paymentMethods = {
      cash: "نقدًا",
      card: "بطاقة بنكية",
      bank_transfer: "تحويل بنكي",
      transfer: "تحويل بنكي",
      wallet: "محفظة إلكترونية",
      cheque: "شيك",
      other: "أخرى",
    };

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>طباعة الفاتورة</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 24px; color: #1f2937; background: #f3f4f6; font-family: Tahoma, Arial, sans-serif; direction: rtl; }
            .invoice { max-width: 900px; margin: 0 auto; padding: 34px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; }
            .toolbar { display: flex; justify-content: flex-end; gap: 10px; margin: 0 auto 16px; max-width: 900px; }
            .print-button { border: 0; border-radius: 8px; padding: 11px 18px; background: #111827; color: white; font-size: 14px; cursor: pointer; }
            .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding-bottom: 22px; border-bottom: 2px solid #111827; }
            h1 { margin: 0 0 8px; font-size: 27px; color: #111827; }
            h2 { margin: 24px 0 12px; font-size: 17px; color: #111827; }
            p { margin: 5px 0; color: #6b7280; font-size: 13px; }
            .invoice-number { text-align: left; }
            .invoice-number strong { display: block; margin-top: 6px; font-size: 18px; }
            .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
            .meta-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; min-width: 0; }
            .meta-card span { display: block; margin-bottom: 6px; color: #6b7280; font-size: 12px; }
            .meta-card strong { font-size: 14px; overflow-wrap: anywhere; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 10px 8px; text-align: right; vertical-align: top; }
            th { background: #f3f4f6; color: #374151; font-weight: 700; }
            .totals { width: 100%; max-width: 390px; margin: 20px 0 0 auto; }
            .total-row { display: flex; justify-content: space-between; gap: 16px; padding: 9px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
            .total-row.grand { margin-top: 4px; border: 0; border-radius: 6px; background: #111827; color: #fff; font-weight: 700; font-size: 16px; }
            .notes { margin-top: 22px; padding: 13px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; }
            .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 11px; }
            @page { size: A4; margin: 12mm; }
            @media print { body { padding: 0; background: white; } .invoice { max-width: none; margin: 0; padding: 0; border: 0; border-radius: 0; } .toolbar { display: none; } .header, .meta-card, table, .totals, .notes { break-inside: avoid; } h2 { break-after: avoid; } }
            @media (max-width: 600px) { body { padding: 8px; } .invoice { padding: 16px; } .header { flex-direction: column; } .invoice-number { text-align: right; } .meta { grid-template-columns: 1fr; } th, td { padding: 6px 4px; font-size: 10px; } }
          </style>
        </head>
        <body>
          <div class="toolbar"><button class="print-button" onclick="window.print()">طباعة الفاتورة / حفظ PDF</button></div>
          <main class="invoice"><p>جارٍ تجهيز الفاتورة...</p></main>
        </body>
      </html>`);
    printWindow.document.close();

    try {
      const response = unwrap(
        await apiRequest(`/invoices/${getInvoiceId(invoice)}`)
      );
      const fullInvoice = response.invoice || response;
      const items = Array.isArray(fullInvoice.items) ? fullInvoice.items : [];
      const payments = Array.isArray(fullInvoice.payments) ? fullInvoice.payments : [];
      const customer = fullInvoice.customer;
      const customerName = getCustomerName(customer);
      const customerPhone = customer && typeof customer === "object" ? customer.phone : "";
      const customerAddress = customer && typeof customer === "object" ? customer.address : "";
      const statusText = invoiceStatusLabels[fullInvoice.status] || fullInvoice.status;
      const paymentStatusText = paymentStatusLabels[fullInvoice.paymentStatus] || fullInvoice.paymentStatus;

      const itemRows = items.map((item) => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        const discount = Number(item.discount) || 0;
        const lineTotal = item.lineTotal ?? quantity * unitPrice - discount;
        return `<tr>
          <td>${text(item.productName)}</td>
          <td>${text(item.sku)}</td>
          <td>${text(item.color)}</td>
          <td>${text(item.size)}</td>
          <td>${escapeHtml(quantity)}</td>
          <td>${money(unitPrice)}</td>
          <td>${money(discount)}</td>
          <td>${money(lineTotal)}</td>
        </tr>`;
      }).join("");

      const paymentRows = payments.map((payment) => `<tr>
        <td>${date(payment.paidAt || payment.date)}</td>
        <td>${money(payment.amount)}</td>
        <td>${text(paymentMethods[payment.method] || payment.method)}</td>
        <td>${text(payment.reference)}</td>
      </tr>`).join("");

      const html = `
        <div class="header">
          <div><h1>فاتورة مبيعات</h1><p>نظام إدارة الملابس</p><p>نسخة مطبوعة من الفاتورة</p></div>
          <div class="invoice-number"><span>رقم الفاتورة</span><strong>${text(fullInvoice.invoiceNumber)}</strong><p>التاريخ: ${date(fullInvoice.createdAt)}</p></div>
        </div>
        <h2>بيانات الفاتورة والعميل</h2>
        <div class="meta">
          <div class="meta-card"><span>اسم العميل</span><strong>${escapeHtml(customerName)}</strong></div>
          <div class="meta-card"><span>رقم الهاتف</span><strong>${text(customerPhone, "غير مسجل")}</strong></div>
          <div class="meta-card"><span>العنوان</span><strong>${text(customerAddress, "غير مسجل")}</strong></div>
          <div class="meta-card"><span>حالة الفاتورة / الدفع</span><strong>${text(statusText)} / ${text(paymentStatusText)}</strong></div>
        </div>
        <h2>تفاصيل المنتجات</h2>
        <table><thead><tr><th>المنتج</th><th>SKU</th><th>اللون</th><th>المقاس</th><th>الكمية</th><th>سعر الوحدة</th><th>الخصم</th><th>الإجمالي</th></tr></thead>
          <tbody>${itemRows || '<tr><td colspan="8">لا توجد منتجات مسجلة.</td></tr>'}</tbody>
        </table>
        <div class="totals">
          <div class="total-row"><span>الإجمالي قبل الخصومات</span><strong>${money(fullInvoice.subtotal)}</strong></div>
          <div class="total-row"><span>خصم الفاتورة</span><strong>${money(fullInvoice.invoiceDiscount)}</strong></div>
          <div class="total-row"><span>الضريبة</span><strong>${money(fullInvoice.taxAmount)}</strong></div>
          <div class="total-row grand"><span>إجمالي الفاتورة</span><strong>${money(fullInvoice.total)}</strong></div>
          <div class="total-row"><span>المدفوع</span><strong>${money(fullInvoice.paidAmount)}</strong></div>
          <div class="total-row"><span>المتبقي</span><strong>${money(fullInvoice.dueAmount)}</strong></div>
        </div>
        ${payments.length ? `<h2>الدفعات المسجلة</h2><table><thead><tr><th>التاريخ</th><th>المبلغ</th><th>طريقة الدفع</th><th>المرجع</th></tr></thead><tbody>${paymentRows}</tbody></table>` : ""}
        ${fullInvoice.notes ? `<div class="notes"><strong>ملاحظات:</strong><br>${text(fullInvoice.notes)}</div>` : ""}
        <div class="footer">شكرًا لتعاملكم معنا</div>`;

      printWindow.document.querySelector(".invoice").innerHTML = html;
      printWindow.document.title = `فاتورة-${displayValue(fullInvoice.invoiceNumber, getInvoiceId(fullInvoice))}`;
      printWindow.focus();
    } catch (err) {
      printWindow.close();
      setError(getErrorMessage(err, "تعذر تجهيز الفاتورة للطباعة."));
    }
  }

  function openCreateModal() {
    setEditor({ mode: "create", invoice: null });
  }

  async function openEditModal(invoice) {
    try {
      setError("");
      const response = unwrap(
        await apiRequest(`/invoices/${getInvoiceId(invoice)}`)
      );
      const fullInvoice = response.invoice || response;
      setEditor({ mode: "edit", invoice: fullInvoice });
    } catch (err) {
      setError(getErrorMessage(err, "تعذر تحميل الفاتورة للتعديل."));
    }
  }

  async function saveInvoice(payload) {
    setSavingInvoice(true);

    try {
      if (editor.mode === "create") {
        await apiRequest("/invoices", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showSuccess("تم إنشاء الفاتورة بنجاح.");
      } else {
        await apiRequest(`/invoices/${getInvoiceId(editor.invoice)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        showSuccess("تم تعديل الفاتورة بنجاح.");
      }

      setEditor(null);
      setReloadKey((value) => value + 1);
    } catch (err) {
      throw new Error(getErrorMessage(err, "تعذر حفظ الفاتورة."));
    } finally {
      setSavingInvoice(false);
    }
  }

  async function deleteInvoice(invoice) {
    const invoiceId = getInvoiceId(invoice);
    const number = displayValue(invoice.invoiceNumber, invoiceId);

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف الفاتورة ${number}؟\nقد يرفض النظام الحذف إذا كانت الفاتورة مرتبطة بدفعات أو عمليات أخرى.`
    );

    if (!confirmed) return;

    setDeletingInvoiceId(invoiceId);
    setError("");

    try {
      await apiRequest(`/invoices/${invoiceId}`, {
        method: "DELETE",
      });

      showSuccess("تم حذف الفاتورة بنجاح.");
      if (detailsInvoice && getInvoiceId(detailsInvoice) === invoiceId) {
        setDetailsInvoice(null);
      }
      setReloadKey((value) => value + 1);
    } catch (err) {
      setError(getErrorMessage(err, "تعذر حذف الفاتورة."));
    } finally {
      setDeletingInvoiceId("");
    }
  }

  function openPaymentModal(invoice) {
    setSelectedInvoice(invoice);
    setPaymentAmount(String(Number(invoice.dueAmount) || 0));
    setPaymentMethod("cash");
    setPaymentReference("");
    setPaymentError("");
  }

  function closePaymentModal() {
    if (savingPayment) return;
    setSelectedInvoice(null);
    setPaymentError("");
  }

  async function handleAddPayment(event) {
    event.preventDefault();
    if (!selectedInvoice) return;

    const amount = Number(paymentAmount);
    const dueAmount = Number(selectedInvoice.dueAmount) || 0;

    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("أدخل مبلغًا صحيحًا أكبر من صفر.");
      return;
    }

    if (amount > dueAmount + 0.001) {
      setPaymentError("مبلغ الدفعة أكبر من المبلغ المتبقي على الفاتورة.");
      return;
    }

    setSavingPayment(true);
    setPaymentError("");

    try {
      await apiRequest(`/invoices/${getInvoiceId(selectedInvoice)}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          method: paymentMethod,
          reference: paymentReference.trim(),
        }),
      });

      setSelectedInvoice(null);
      showSuccess("تم تسجيل الدفعة بنجاح.");
      setReloadKey((value) => value + 1);
    } catch (err) {
      setPaymentError(getErrorMessage(err, "تعذر تسجيل الدفعة."));
    } finally {
      setSavingPayment(false);
    }
  }

  const completedInvoices = invoices.filter(
    (invoice) => invoice.status === "completed"
  ).length;

  const cancelledInvoices = invoices.filter(
    (invoice) => invoice.status === "cancelled"
  ).length;

  if (loading && invoices.length === 0) {
    return (
      <section className="sales-page" dir="rtl">
        <div className="sales-header">
          <div>
            <h1>الفواتير</h1>
            <p>إنشاء الفواتير وإدارتها ومتابعة عمليات الدفع.</p>
          </div>
        </div>
        <div className="sales-state">جارٍ تحميل الفواتير...</div>
      </section>
    );
  }

  if (error && invoices.length === 0) {
    return (
      <section className="sales-page" dir="rtl">
        <div className="sales-header">
          <div>
            <h1>الفواتير</h1>
            <p>إنشاء الفواتير وإدارتها ومتابعة عمليات الدفع.</p>
          </div>
        </div>
        <div className="sales-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            إعادة المحاولة
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="sales-page" dir="rtl">
      <div className="sales-header">
        <div>
          <h1>الفواتير</h1>
          <p>إنشاء الفواتير وإدارتها ومتابعة عمليات الدفع.</p>
        </div>

        <div className="sales-header-actions">
          <button
            type="button"
            className="sales-payment-button"
            onClick={openCreateModal}
          >
            <Plus size={17} /> إنشاء فاتورة
          </button>

          <button
            type="button"
            className="sales-refresh-button"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw size={16} />
            {loading ? "جارٍ التحديث..." : "تحديث"}
          </button>
        </div>
      </div>

      {error && (
        <div className="sales-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {success && (
        <div className="sales-success" role="status">
          {success}
          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="إغلاق رسالة النجاح"
          >
            ×
          </button>
        </div>
      )}

      <div className="sales-summary">
        <article className="sales-summary-card">
          <span>إجمالي الفواتير</span>
          <strong>{pagination.total}</strong>
        </article>
        <article className="sales-summary-card">
          <span>الفواتير المكتملة في الصفحة</span>
          <strong>{completedInvoices}</strong>
        </article>
        <article className="sales-summary-card">
          <span>الفواتير الملغاة في الصفحة</span>
          <strong>{cancelledInvoices}</strong>
        </article>
      </div>

      <div className="sales-toolbar">
        <div className="sales-search">
          <label htmlFor="invoice-search">البحث</label>
          <div className="sales-search-input">
            <Search size={17} />
            <input
              id="invoice-search"
              type="search"
              placeholder="رقم الفاتورة أو اسم العميل أو هاتفه"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="sales-filter">
          <label htmlFor="invoice-status">حالة الفاتورة</label>
          <select
            id="invoice-status"
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
          >
            <option value="">جميع الحالات</option>
            <option value="completed">مكتملة</option>
            <option value="draft">مسودة</option>
            <option value="cancelled">ملغاة</option>
            <option value="partially_returned">مُعاد جزء منها</option>
            <option value="returned">مُعادة بالكامل</option>
          </select>
        </div>

        <div className="sales-filter">
          <label htmlFor="payment-status">حالة الدفع</label>
          <select
            id="payment-status"
            value={paymentStatus}
            onChange={(event) => {
              setPage(1);
              setPaymentStatus(event.target.value);
            }}
          >
            <option value="">جميع حالات الدفع</option>
            <option value="paid">مدفوعة</option>
            <option value="partial">مدفوعة جزئيًا</option>
            <option value="unpaid">غير مدفوعة</option>
            <option value="refunded">مستردة</option>
          </select>
        </div>

        <button
          type="button"
          className="sales-reset-button"
          onClick={resetFilters}
        >
          مسح الفلاتر
        </button>
      </div>

      <div className="sales-table-wrapper">
        <table className="sales-table">
          <thead>
            <tr>
              <th>رقم الفاتورة</th>
              <th>العميل</th>
              <th>التاريخ</th>
              <th>الإجمالي</th>
              <th>المدفوع</th>
              <th>المتبقي</th>
              <th>حالة الفاتورة</th>
              <th>حالة الدفع</th>
              <th>الإجراءات</th>
            </tr>
          </thead>

          <tbody>
            {filteredInvoices.map((invoice) => (
              <tr key={getInvoiceId(invoice)}>
                <td className="sales-invoice-number">
                  {displayValue(invoice.invoiceNumber)}
                </td>
                <td>
                  <div className="sales-customer">
                    <strong>{getCustomerName(invoice.customer)}</strong>
                    {invoice.customer?.phone && (
                      <span>{displayValue(invoice.customer.phone)}</span>
                    )}
                  </div>
                </td>
                <td>{formatDate(invoice.createdAt)}</td>
                <td>{formatMoney(invoice.total)}</td>
                <td>{formatMoney(invoice.paidAmount)}</td>
                <td>{formatMoney(invoice.dueAmount)}</td>
                <td>
                  <span
                    className={`sales-status sales-status-${getStatusClass(
                      invoice.status
                    )}`}
                  >
                    {displayValue(
                      invoiceStatusLabels[invoice.status] || invoice.status,
                      "غير محددة"
                    )}
                  </span>
                </td>
                <td>
                  <span
                    className={`sales-status sales-payment-${getPaymentClass(
                      invoice.paymentStatus
                    )}`}
                  >
                    {displayValue(
                      paymentStatusLabels[invoice.paymentStatus] ||
                        invoice.paymentStatus,
                      "غير محددة"
                    )}
                  </span>
                </td>
                <td>
                  <div className="sales-row-actions">
                    <button
                      type="button"
                      className="sales-icon-button"
                      title="عرض التفاصيل"
                      aria-label="عرض التفاصيل"
                      onClick={() => openDetails(invoice)}
                    >
                      <Eye size={17} />
                    </button>

                    <button
                      type="button"
                      className="sales-icon-button"
                      title="طباعة الفاتورة"
                      aria-label="طباعة الفاتورة"
                      onClick={() => printInvoice(invoice)}
                    >
                      <Printer size={17} />
                    </button>

                    <button
                      type="button"
                      className="sales-icon-button"
                      title="تعديل الفاتورة"
                      aria-label="تعديل الفاتورة"
                      onClick={() => openEditModal(invoice)}
                    >
                      <Pencil size={17} />
                    </button>

                    <button
                      type="button"
                      className="sales-icon-button sales-delete-button"
                      title="حذف الفاتورة"
                      aria-label="حذف الفاتورة"
                      disabled={deletingInvoiceId === getInvoiceId(invoice)}
                      onClick={() => deleteInvoice(invoice)}
                    >
                      <Trash2 size={17} />
                    </button>

                    {invoice.status === "completed" &&
                      Number(invoice.dueAmount) > 0 &&
                      invoice.paymentStatus !== "refunded" && (
                        <button
                          type="button"
                          className="sales-payment-button"
                          onClick={() => openPaymentModal(invoice)}
                        >
                          <CreditCard size={15} /> تسجيل دفعة
                        </button>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && filteredInvoices.length === 0 && (
          <div className="sales-empty">
            <h2>
              {invoices.length === 0
                ? "لا توجد فواتير"
                : "لا توجد نتائج مطابقة"}
            </h2>
            <p>
              {invoices.length === 0
                ? "يمكنك إنشاء أول فاتورة باستخدام زر إنشاء فاتورة."
                : "جرّب تغيير عبارة البحث أو الفلاتر."}
            </p>
          </div>
        )}

        {loading && invoices.length > 0 && (
          <p className="sales-loading">جارٍ تحديث البيانات...</p>
        )}
      </div>

      <div className="sales-pagination">
        <span>إجمالي الفواتير: {pagination.total}</span>
        <div className="sales-pagination-actions">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            السابق
          </button>
          <span>
            صفحة {page} من {Math.max(pagination.pages, 1)}
          </span>
          <button
            type="button"
            disabled={page >= Math.max(pagination.pages, 1) || loading}
            onClick={() =>
              setPage((current) =>
                Math.min(Math.max(pagination.pages, 1), current + 1)
              )
            }
          >
            التالي
          </button>
        </div>
      </div>

      {editor && (
        <InvoiceEditor
          key={`${editor.mode}-${getInvoiceId(editor.invoice) || "new"}`}
          mode={editor.mode}
          initialInvoice={editor.invoice}
          saving={savingInvoice}
          onClose={() => {
            if (!savingInvoice) setEditor(null);
          }}
          onSave={saveInvoice}
        />
      )}

      {detailsInvoice && (
        <Modal
          title="تفاصيل الفاتورة"
          subtitle={`رقم الفاتورة: ${displayValue(detailsInvoice.invoiceNumber)}`}
          onClose={() => setDetailsInvoice(null)}
          wide
        >
          <InvoiceDetails invoice={detailsInvoice} />
          <div className="sales-modal-actions">
            <button
              type="button"
              className="sales-payment-button"
              onClick={() => printInvoice(detailsInvoice)}
            >
              <Printer size={16} /> طباعة الفاتورة
            </button>
            <button
              type="button"
              className="sales-reset-button"
              onClick={() => setDetailsInvoice(null)}
            >
              إغلاق
            </button>
            <button
              type="button"
              className="sales-payment-button"
              onClick={() => {
                const invoice = detailsInvoice;
                setDetailsInvoice(null);
                openEditModal(invoice);
              }}
            >
              <Pencil size={16} /> تعديل الفاتورة
            </button>
          </div>
        </Modal>
      )}

      {selectedInvoice && (
        <Modal
          title="تسجيل دفعة جديدة"
          subtitle={`فاتورة ${displayValue(selectedInvoice.invoiceNumber)}`}
          onClose={closePaymentModal}
        >
          <div className="sales-payment-details">
            <div>
              <span>العميل</span>
              <strong>{getCustomerName(selectedInvoice.customer)}</strong>
            </div>
            <div>
              <span>إجمالي الفاتورة</span>
              <strong>{formatMoney(selectedInvoice.total)}</strong>
            </div>
            <div>
              <span>المدفوع سابقًا</span>
              <strong>{formatMoney(selectedInvoice.paidAmount)}</strong>
            </div>
            <div>
              <span>المتبقي</span>
              <strong>{formatMoney(selectedInvoice.dueAmount)}</strong>
            </div>
          </div>

          <form className="sales-payment-form" onSubmit={handleAddPayment}>
            <label htmlFor="payment-amount">مبلغ الدفعة</label>
            <input
              id="payment-amount"
              type="number"
              min="0.01"
              max={Number(selectedInvoice.dueAmount) || 0}
              step="0.01"
              required
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
              placeholder="أدخل المبلغ"
            />

            <label htmlFor="payment-method">طريقة الدفع</label>
            <select
              id="payment-method"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              <option value="cash">نقدًا</option>
              <option value="card">بطاقة بنكية</option>
              <option value="bank_transfer">تحويل بنكي</option>
              <option value="wallet">محفظة إلكترونية</option>
            </select>

            <label htmlFor="payment-reference">مرجع الدفعة (اختياري)</label>
            <input
              id="payment-reference"
              type="text"
              maxLength={100}
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              placeholder="رقم التحويل أو ملاحظات"
            />

            {paymentError && (
              <div className="sales-error" role="alert">
                {paymentError}
              </div>
            )}

            <div className="sales-modal-actions">
              <button
                type="button"
                className="sales-reset-button"
                onClick={closePaymentModal}
                disabled={savingPayment}
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="sales-payment-button"
                disabled={savingPayment}
              >
                {savingPayment ? "جارٍ الحفظ..." : "حفظ الدفعة"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
