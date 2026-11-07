import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../services/api";
import ProductForm from "./ProductForm";
import ProductEditForm from "./ProductEditForm";
import "./Products.css";

const currency = new Intl.NumberFormat("ar-EG", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 0,
});

function getStockState(product) {
  const availableStock = product.variants.reduce(
    (sum, variant) =>
      sum +
      Math.max(
        0,
        (variant.stock?.quantity || 0) -
          (variant.stock?.reservedQuantity || 0)
      ),
    0
  );

  if (availableStock === 0) {
    return { key: "out", label: "نافد", availableStock };
  }

  const hasLowVariant = product.variants.some((variant) => {
    const available =
      (variant.stock?.quantity || 0) -
      (variant.stock?.reservedQuantity || 0);

    return available <= (variant.stock?.reorderPoint || 0);
  });

  if (hasLowVariant) {
    return { key: "low", label: "مخزون منخفض", availableStock };
  }

  return { key: "available", label: "متوفر", availableStock };
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [stockFilter, setStockFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function loadProducts() {
      try {
        const data = await apiRequest("/products?limit=100");
        setProducts(data.products || []);
      } catch (err) {
        setError(err.message || "تعذر تحميل المنتجات");
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        product.name?.toLowerCase().includes(normalizedSearch) ||
        product.category?.toLowerCase().includes(normalizedSearch) ||
        product.variants.some((variant) =>
          variant.color?.name?.toLowerCase().includes(normalizedSearch)
        );

      const matchesStock =
        stockFilter === "all" ||
        getStockState(product).key === stockFilter;

      return matchesSearch && matchesStock;
    });
  }, [products, stockFilter, search]);

  function toggleSelection(productId) {
    setSelectedIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  }

  function toggleAllProducts() {
    const visibleIds = filteredProducts.map((product) => product._id);

    const everyVisibleSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedIds.includes(id));

    setSelectedIds((current) => {
      if (everyVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return [...new Set([...current, ...visibleIds])];
    });
  }

  function requestDelete(productIds) {
    if (productIds.length === 0) return;

    setDeleteConfirmation({
      productIds,
    });
  }

  async function confirmDelete() {
    if (!deleteConfirmation?.productIds?.length) return;

    const productIds = deleteConfirmation.productIds;

    setDeleting(true);
    setActionMessage("");

    try {
      const data = await apiRequest("/products", {
        method: "DELETE",
        body: JSON.stringify({ productIds }),
      });

      const deletedIds = (data.deletedIds || []).map(String);

      setProducts((current) =>
        current.filter((product) => !deletedIds.includes(product._id))
      );

      setSelectedIds((current) =>
        current.filter((id) => !deletedIds.includes(id))
      );

      setDeleteConfirmation(null);
      setActionMessage(`تم حذف ${deletedIds.length} منتج بنجاح.`);
    } catch (err) {
      setActionMessage(err.message || "تعذر حذف المنتجات المحددة");
      setDeleteConfirmation(null);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <p dir="rtl">جارٍ تحميل المنتجات...</p>;
  if (error) return <p dir="rtl">{error}</p>;

  const visibleIds = filteredProducts.map((product) => product._id);

  const everyVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedIds.includes(id));

  const productsToDelete = deleteConfirmation
    ? products.filter((product) =>
        deleteConfirmation.productIds.includes(product._id)
      )
    : [];

  return (
    <section dir="rtl" className="products-page">
      <header className="page-header">
        <div>
          <h1>المنتجات</h1>
          <p>إدارة منتجات المتجر والمقاسات والألوان والكميات.</p>
        </div>

        <button type="button" onClick={() => setShowForm(true)}>
          إضافة منتج
        </button>
      </header>

      <div className="products-toolbar">
        <input
          className="products-search"
          type="search"
          placeholder="ابحث بالاسم أو التصنيف أو اللون..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <span>
          عرض {filteredProducts.length} من {products.length} منتج
        </span>

        <div className="stock-filters">
          <button
            type="button"
            className={stockFilter === "all" ? "active" : ""}
            onClick={() => setStockFilter("all")}
          >
            الكل
          </button>

          <button
            type="button"
            className={stockFilter === "available" ? "active" : ""}
            onClick={() => setStockFilter("available")}
          >
            متوفر
          </button>

          <button
            type="button"
            className={stockFilter === "low" ? "active" : ""}
            onClick={() => setStockFilter("low")}
          >
            مخزون منخفض
          </button>

          <button
            type="button"
            className={stockFilter === "out" ? "active" : ""}
            onClick={() => setStockFilter("out")}
          >
            نافد
          </button>
        </div>
      </div>

      <div className="bulk-actions">
        <label>
          <input
            type="checkbox"
            checked={everyVisibleSelected}
            disabled={visibleIds.length === 0}
            onChange={toggleAllProducts}
          />
          تحديد جميع المنتجات الظاهرة
        </label>

        {selectedIds.length > 0 && (
          <button
            type="button"
            className="delete-selected-button"
            disabled={deleting}
            onClick={() => requestDelete(selectedIds)}
          >
            حذف المحدد ({selectedIds.length})
          </button>
        )}
      </div>

      {actionMessage && (
        <p className="products-action-message">{actionMessage}</p>
      )}

      {filteredProducts.length === 0 ? (
        <div className="empty-state">
          <h2>
            {products.length === 0
              ? "لا توجد منتجات بعد"
              : "لا توجد منتجات مطابقة للبحث أو الفلترة"}
          </h2>

          <p>
            {products.length === 0
              ? "أضف أول منتج للبدء في إدارة المخزون والمبيعات."
              : "جرّب كلمة بحث أو فلترة مختلفة."}
          </p>
        </div>
      ) : (
        <div className="products-grid">
          {filteredProducts.map((product) => {
            const stockState = getStockState(product);

            const lowestPrice = Math.min(
              ...product.variants.map((variant) => variant.salePrice)
            );

            const primaryImage =
              product.images?.find((image) => image.isPrimary) ||
              product.images?.[0];

            return (
              <article className="product-card" key={product._id}>
                <label className="product-select">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(product._id)}
                    onChange={() => toggleSelection(product._id)}
                  />
                  تحديد
                </label>

                <div className="product-image">
                  {primaryImage?.url ? (
                    <img src={primaryImage.url} alt={product.name} />
                  ) : (
                    <span>لا توجد صورة</span>
                  )}

                  <span className={`stock-badge stock-${stockState.key}`}>
                    {stockState.label}
                  </span>
                </div>

                <div className="product-card-content">
                  <div className="product-title-row">
                    <div>
                      <h2>{product.name}</h2>
                      <p>{product.productCode || "بدون كود"}</p>
                    </div>
                  </div>

                  <p>{product.category || "غير مصنف"}</p>

                  <div className="product-summary">
                    <span>{product.variants.length} مقاس/لون</span>
                    <span>{stockState.availableStock} قطعة متاحة</span>
                    <strong> السعر يبدء من : {currency.format(lowestPrice)}</strong>
                  </div>

                  <div className="product-card-actions">
                    <button
                      type="button"
                      className="edit-product-button"
                      onClick={() => setSelectedProduct(product)}
                    >
                      تعديل
                    </button>

                    <button
                      type="button"
                      className="delete-product-button"
                      disabled={deleting}
                      onClick={() => requestDelete([product._id])}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showForm && (
        <ProductForm
          onClose={() => setShowForm(false)}
          onCreated={(product) => {
            setProducts((current) => [product, ...current]);
          }}
        />
      )}

      {selectedProduct && (
        <ProductEditForm
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onUpdated={(updatedProduct) => {
            setProducts((current) =>
              current.map((product) =>
                product._id === updatedProduct._id
                  ? updatedProduct
                  : product
              )
            );
          }}
        />
      )}

      {deleteConfirmation && (
        <div className="delete-modal-backdrop">
          <section
            className="delete-confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <div className="delete-warning-icon">!</div>

            <h2 id="delete-modal-title">تأكيد حذف المنتجات</h2>

            <p>
              هل أنت متأكد من حذف{" "}
              <strong>{deleteConfirmation.productIds.length}</strong>{" "}
              منتج/منتجات نهائيًا؟
            </p>

            {productsToDelete.length > 0 && (
              <p className="delete-products-names">
                {productsToDelete
                  .slice(0, 3)
                  .map((product) => product.name)
                  .join("، ")}
                {productsToDelete.length > 3
                  ? `، و${productsToDelete.length - 3} منتجات أخرى`
                  : ""}
              </p>
            )}

            <p className="delete-warning-text">
              لا يمكن التراجع عن هذا الإجراء.
            </p>

            <div className="delete-modal-actions">
              <button
                type="button"
                className="cancel-delete-button"
                disabled={deleting}
                onClick={() => setDeleteConfirmation(null)}
              >
                إلغاء
              </button>

              <button
                type="button"
                className="confirm-delete-button"
                disabled={deleting}
                onClick={confirmDelete}
              >
                {deleting ? "جارٍ الحذف..." : "نعم، احذف نهائيًا"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}