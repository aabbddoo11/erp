
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import "./POS.css";

const currency = new Intl.NumberFormat("ar-EG", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 0,
});

const paymentMethods = [
  { value: "cash", label: "نقدًا" },
  { value: "card", label: "بطاقة بنكية" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "wallet", label: "محفظة إلكترونية" },
];

function money(value) {
  return currency.format(Number(value) || 0);
}

function getVariantLabel(variant) {
  return `${variant.color?.name || "لون"} - ${
    variant.size?.label || variant.size?.code || "مقاس"
  }`;
}

export default function POS() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedVariants, setSelectedVariants] = useState({});
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [invoiceDiscount, setInvoiceDiscount] = useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/products?status=active&limit=100");
      const activeProducts = (data.products || []).filter(
        (product) => product.status === "active"
      );

      setProducts(activeProducts);

      setSelectedVariants((current) => {
        const next = { ...current };

        activeProducts.forEach((product) => {
          const availableVariants = (product.variants || []).filter(
            (variant) =>
              variant.isActive && Number(variant.stock?.quantity) > 0
          );

          if (
            !availableVariants.some(
              (variant) => variant._id === next[product._id]
            )
          ) {
            next[product._id] = availableVariants[0]?._id || "";
          }
        });

        return next;
      });
    } catch (err) {
      setError(err.message || "تعذر تحميل المنتجات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return products;

    return products.filter((product) => {
      const searchableText = [
        product.name,
        product.productCode,
        product.category,
        ...(product.variants || []).flatMap((variant) => [
          variant.sku,
          variant.barcode,
          variant.color?.name,
          variant.size?.code,
          variant.size?.label,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [products, search]);

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      ),
    [cart]
  );

  const discountTotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + (Number(item.discount) || 0),
        0
      ),
    [cart]
  );

  const safeInvoiceDiscount = Math.max(
    0,
    Number(invoiceDiscount) || 0
  );

  const safeTaxRate = Math.min(
    100,
    Math.max(0, Number(taxRate) || 0)
  );

  const taxableAmount = Math.max(
    0,
    subtotal - discountTotal - safeInvoiceDiscount
  );

  const taxAmount = Math.round(
    taxableAmount * (safeTaxRate / 100) * 100
  ) / 100;

  const total = Math.round((taxableAmount + taxAmount) * 100) / 100;
  const safePaidAmount = Math.max(0, Number(paidAmount) || 0);
  const dueAmount = Math.max(0, total - safePaidAmount);
  const changeAmount = Math.max(0, safePaidAmount - total);

  function addToCart(product) {
    setError("");
    setSuccess("");

    const variantId = selectedVariants[product._id];
    const variant = (product.variants || []).find(
      (item) => item._id === variantId
    );

    if (!variant || !variant.isActive) {
      setError("اختر لونًا ومقاسًا متاحين للبيع أولًا.");
      return;
    }

    const stock = Number(variant.stock?.quantity) || 0;

    if (stock < 1) {
      setError("هذا اللون والمقاس غير متوفر في المخزون.");
      return;
    }

    const existingItem = cart.find(
      (item) =>
        item.productId === product._id &&
        item.variantId === variant._id
    );

    if (existingItem && existingItem.quantity >= stock) {
      setError(`المتاح من هذا الاختيار هو ${stock} قطعة فقط.`);
      return;
    }

    setCart((current) => {
      const existing = current.find(
        (item) =>
          item.productId === product._id &&
          item.variantId === variant._id
      );

      if (existing) {
        if (existing.quantity >= stock) return current;

        return current.map((item) =>
          item.productId === product._id &&
          item.variantId === variant._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          productId: product._id,
          variantId: variant._id,
          productName: product.name,
          sku: variant.sku,
          colorName: variant.color?.name || "",
          sizeLabel: variant.size?.label || variant.size?.code || "",
          unitPrice: Number(variant.salePrice) || 0,
          stock,
          quantity: 1,
          discount: 0,
        },
      ];
    });
  }

  function updateQuantity(productId, variantId, value) {
    const quantity = Number(value);

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("يجب أن تكون الكمية رقمًا صحيحًا أكبر من صفر.");
      return;
    }

    const item = cart.find(
      (cartItem) =>
        cartItem.productId === productId &&
        cartItem.variantId === variantId
    );

    if (item && quantity > item.stock) {
      setError(`الكمية المطلوبة أكبر من المتاح (${item.stock}).`);
      return;
    }

    setError("");
    setCart((current) =>
      current.map((cartItem) =>
        cartItem.productId === productId &&
        cartItem.variantId === variantId
          ? { ...cartItem, quantity }
          : cartItem
      )
    );
  }

  function updateItemDiscount(productId, variantId, value) {
    const discount = Math.max(0, Number(value) || 0);

    setCart((current) =>
      current.map((item) => {
        if (
          item.productId !== productId ||
          item.variantId !== variantId
        ) {
          return item;
        }

        const maximumDiscount = item.quantity * item.unitPrice;

        return {
          ...item,
          discount: Math.min(discount, maximumDiscount),
        };
      })
    );
  }

  function removeFromCart(productId, variantId) {
    setCart((current) =>
      current.filter(
        (item) =>
          item.productId !== productId ||
          item.variantId !== variantId
      )
    );
    setError("");
  }

  function resetInvoice() {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setInvoiceDiscount("0");
    setTaxRate("0");
    setPaidAmount("");
    setPaymentMethod("cash");
    setNotes("");
    setError("");
    setSuccess("");
  }

  async function createInvoice(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (cart.length === 0) {
      setError("أضف منتجًا واحدًا على الأقل قبل إنشاء الفاتورة.");
      return;
    }

    if (safeInvoiceDiscount > subtotal - discountTotal) {
      setError("خصم الفاتورة أكبر من المبلغ المتاح للخصم.");
      return;
    }

    if (safePaidAmount < 0) {
      setError("المبلغ المدفوع لا يمكن أن يكون سالبًا.");
      return;
    }

    const items = cart.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      discount: Number(item.discount) || 0,
    }));

    const payments =
      safePaidAmount > 0
        ? [
            {
              method: paymentMethod,
              amount: safePaidAmount,
            },
          ]
        : [];

    const payload = {
      items,
      customer: {
        name: customerName.trim() || "عميل نقدي",
        phone: customerPhone.trim(),
        email: customerEmail.trim(),
      },
      invoiceDiscount: safeInvoiceDiscount,
      taxRate: safeTaxRate,
      payments,
      notes: notes.trim(),
    };

    setSubmitting(true);

    try {
      const data = await apiRequest("/invoices", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const invoice = data.invoice;

      setSuccess(
        `تم إنشاء الفاتورة بنجاح${
          invoice?.invoiceNumber ? ` - ${invoice.invoiceNumber}` : ""
        }`
      );

      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setInvoiceDiscount("0");
      setTaxRate("0");
      setPaidAmount("");
      setPaymentMethod("cash");
      setNotes("");

      loadProducts();
    } catch (err) {
      setError(err.message || "تعذر إنشاء الفاتورة");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="pos-page" dir="rtl">
      <header className="pos-header">
        <div>
          <h1>نقطة البيع</h1>
          <p>أنشئ فاتورة بيع جديدة وأدرِج المنتجات المطلوبة.</p>
        </div>

        <button
          type="button"
          className="pos-secondary-button"
          onClick={() => navigate("/sales")}
        >
          عرض الفواتير
        </button>
      </header>

      {error && (
        <div className="pos-alert pos-alert-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            إغلاق
          </button>
        </div>
      )}

      {success && (
        <div className="pos-alert pos-alert-success" role="status">
          <span>{success}</span>
          <button type="button" onClick={() => navigate("/sales")}>
            الذهاب إلى الفواتير
          </button>
        </div>
      )}

      <div className="pos-layout">
        <section className="pos-products-panel">
          <div className="pos-panel-heading">
            <h2>المنتجات</h2>
            <span>{filteredProducts.length} منتج</span>
          </div>

          <input
            className="pos-search"
            type="search"
            placeholder="ابحث بالاسم أو الكود أو اللون أو المقاس..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {loading ? (
            <div className="pos-empty-state">جارٍ تحميل المنتجات...</div>
          ) : products.length === 0 ? (
            <div className="pos-empty-state">
              لا توجد منتجات نشطة. أضف المنتجات وفعّلها أولًا.
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="pos-empty-state">
              لا توجد منتجات مطابقة للبحث.
            </div>
          ) : (
            <div className="pos-product-list">
              {filteredProducts.map((product) => {
                const variants = (product.variants || []).filter(
                  (variant) =>
                    variant.isActive &&
                    Number(variant.stock?.quantity) > 0
                );

                const selectedVariant = variants.find(
                  (variant) =>
                    variant._id === selectedVariants[product._id]
                );

                const image =
                  product.images?.find((item) => item.isPrimary) ||
                  product.images?.[0];

                return (
                  <article className="pos-product-card" key={product._id}>
                    {image?.url ? (
                      <img
                        className="pos-product-image"
                        src={image.url}
                        alt={product.name}
                      />
                    ) : (
                      <div className="pos-product-image pos-no-image">
                        لا توجد صورة
                      </div>
                    )}

                    <div className="pos-product-info">
                      <h3>{product.name}</h3>
                      <p>{product.productCode || "بدون كود"}</p>

                      {variants.length > 0 ? (
                        <>
                          <label>
                            اللون والمقاس
                            <select
                              value={selectedVariants[product._id] || ""}
                              onChange={(event) =>
                                setSelectedVariants((current) => ({
                                  ...current,
                                  [product._id]: event.target.value,
                                }))
                              }
                            >
                              {variants.map((variant) => (
                                <option
                                  key={variant._id}
                                  value={variant._id}
                                >
                                  {getVariantLabel(variant)} — متاح:{" "}
                                  {variant.stock.quantity}
                                </option>
                              ))}
                            </select>
                          </label>

                          <div className="pos-product-footer">
                            <strong>
                              {money(selectedVariant?.salePrice)}
                            </strong>
                            <button
                              type="button"
                              onClick={() => addToCart(product)}
                              disabled={!selectedVariant}
                            >
                              إضافة للفاتورة
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="pos-out-of-stock">
                          غير متوفر للبيع حاليًا
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <form className="pos-invoice-panel" onSubmit={createInvoice}>
          <div className="pos-panel-heading">
            <h2>الفاتورة الجديدة</h2>
            <span>{cart.length} صنف</span>
          </div>

          <div className="pos-cart">
            {cart.length === 0 ? (
              <div className="pos-empty-state">
                أضف المنتجات من القائمة لبدء الفاتورة.
              </div>
            ) : (
              cart.map((item) => (
                <article
                  className="pos-cart-item"
                  key={`${item.productId}-${item.variantId}`}
                >
                  <div className="pos-cart-item-heading">
                    <div>
                      <h3>{item.productName}</h3>
                      <p>
                        {item.colorName} - {item.sizeLabel}
                      </p>
                      <span>{money(item.unitPrice)} للقطعة</span>
                    </div>

                    <button
                      type="button"
                      className="pos-remove-button"
                      onClick={() =>
                        removeFromCart(item.productId, item.variantId)
                      }
                      aria-label={`حذف ${item.productName} من الفاتورة`}
                    >
                      حذف
                    </button>
                  </div>

                  <div className="pos-cart-item-fields">
                    <label>
                      الكمية
                      <input
                        type="number"
                        min="1"
                        max={item.stock}
                        step="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateQuantity(
                            item.productId,
                            item.variantId,
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      خصم الصنف
                      <input
                        type="number"
                        min="0"
                        max={item.quantity * item.unitPrice}
                        step="0.01"
                        value={item.discount}
                        onChange={(event) =>
                          updateItemDiscount(
                            item.productId,
                            item.variantId,
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="pos-cart-line-total">
                    الإجمالي:{" "}
                    <strong>
                      {money(
                        item.quantity * item.unitPrice - item.discount
                      )}
                    </strong>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="pos-customer-fields">
            <h3>بيانات العميل</h3>

            <label>
              اسم العميل
              <input
                type="text"
                maxLength="150"
                placeholder="عميل نقدي"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </label>

            <label>
              رقم الهاتف
              <input
                type="tel"
                maxLength="30"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="اختياري"
              />
            </label>

            <label>
              البريد الإلكتروني
              <input
                type="email"
                maxLength="254"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
                placeholder="اختياري"
              />
            </label>
          </div>

          <div className="pos-financial-fields">
            <label>
              خصم الفاتورة
              <input
                type="number"
                min="0"
                max={Math.max(0, subtotal - discountTotal)}
                step="0.01"
                value={invoiceDiscount}
                onChange={(event) => setInvoiceDiscount(event.target.value)}
              />
            </label>

            <label>
              الضريبة (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRate}
                onChange={(event) => setTaxRate(event.target.value)}
              />
            </label>

            <label>
              المبلغ المدفوع
              <input
                type="number"
                min="0"
                step="0.01"
                value={paidAmount}
                onChange={(event) => setPaidAmount(event.target.value)}
                placeholder="0.00"
              />
            </label>

            {safePaidAmount > 0 && (
              <label>
                طريقة الدفع
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="pos-notes-field">
              ملاحظات
              <textarea
                rows="2"
                maxLength="1000"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="ملاحظات اختيارية على الفاتورة"
              />
            </label>
          </div>

          <div className="pos-totals">
            <div>
              <span>إجمالي المنتجات</span>
              <span>{money(subtotal)}</span>
            </div>

            <div>
              <span>خصم الأصناف</span>
              <span>{money(discountTotal)}</span>
            </div>

            <div>
              <span>خصم الفاتورة</span>
              <span>{money(safeInvoiceDiscount)}</span>
            </div>

            <div>
              <span>الضريبة</span>
              <span>{money(taxAmount)}</span>
            </div>

            <div className="pos-grand-total">
              <strong>الإجمالي النهائي</strong>
              <strong>{money(total)}</strong>
            </div>

            <div>
              <span>المتبقي</span>
              <span>{money(dueAmount)}</span>
            </div>

            {changeAmount > 0 && (
              <div>
                <span>الباقي للعميل</span>
                <span>{money(changeAmount)}</span>
              </div>
            )}
          </div>

          <div className="pos-form-actions">
            <button
              type="button"
              className="pos-secondary-button"
              onClick={resetInvoice}
              disabled={submitting}
            >
              إفراغ الفاتورة
            </button>

            <button
              type="submit"
              className="pos-submit-button"
              disabled={submitting || loading || cart.length === 0}
            >
              {submitting ? "جارٍ إنشاء الفاتورة..." : "إنشاء الفاتورة"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
