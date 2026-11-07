import { useState } from "react";
import { apiRequest } from "../../services/api";

const emptyVariant = {
  sku: "",
  color: { name: "", hex: "#000000" },
  size: { code: "", label: "" },
  costPrice: "",
  salePrice: "",
  stock: { quantity: 0, reorderPoint: 0 },
  isActive: true,
};

function createInitialForm(product) {
  return {
    name: product?.name || "",
    productCode: product?.productCode || "",
    category: product?.category || "",
    description: product?.description || "",
    status: product?.status || "active",
    // Keep existing image records; newly selected files are added separately.
    images: (product?.images || []).map((image) => ({ ...image })),
    // Spread each existing variant so hidden fields (barcode, reserved stock,
    // compareAtPrice, isActive, size.label, image and _id) are not lost.
    variants: (product?.variants || []).map((variant) => ({
      ...variant,
      color: {
        ...(variant.color || {}),
        name: variant.color?.name || "",
        hex: variant.color?.hex || "#000000",
      },
      size: {
        ...(variant.size || {}),
        code: variant.size?.code || "",
        label: variant.size?.label || "",
      },
      stock: {
        ...(variant.stock || {}),
        quantity: variant.stock?.quantity ?? 0,
        reorderPoint: variant.stock?.reorderPoint ?? 0,
      },
      costPrice: variant.costPrice ?? "",
      salePrice: variant.salePrice ?? "",
    })),
  };
}

export default function ProductEditForm({ product, onClose, onUpdated }) {
  const [form, setForm] = useState(() => createInitialForm(product));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateVariant(index, path, value) {
    setForm((current) => {
      const variants = current.variants.map((variant, variantIndex) => {
        if (variantIndex !== index) return variant;

        if (!path.includes(".")) {
          return { ...variant, [path]: value };
        }

        const [parent, child] = path.split(".");
        return {
          ...variant,
          [parent]: {
            ...variant[parent],
            [child]: value,
          },
        };
      });

      return { ...current, variants };
    });
  }

  function addVariant() {
    setForm((current) => ({
      ...current,
      variants: [...current.variants, structuredClone(emptyVariant)],
    }));
  }

  function removeVariant(index) {
    setForm((current) => ({
      ...current,
      variants: current.variants.filter((_, i) => i !== index),
    }));
  }

  function handleImagesChange(event) {
    const files = Array.from(event.target.files || []);
    setForm((current) => ({
      ...current,
      images: [
        ...current.images,
        ...files.map((file) => ({ file, preview: URL.createObjectURL(file) })),
      ],
    }));
    event.target.value = "";
  }

  function removeImage(index) {
    setForm((current) => {
      const image = current.images[index];
      if (image?.preview) URL.revokeObjectURL(image.preview);
      return {
        ...current,
        images: current.images.filter((_, i) => i !== index),
      };
    });
  }

  async function uploadNewImage(image) {
    const uploadData = await apiRequest("/uploads/presign", {
      method: "POST",
      body: JSON.stringify({
        fileName: image.file.name,
        contentType: image.file.type || "application/octet-stream",
        folder: "products/gallery",
      }),
    });

    const uploadResponse = await fetch(uploadData.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": image.file.type || "application/octet-stream",
      },
      body: image.file,
    });

    if (!uploadResponse.ok) {
      throw new Error(`تعذر رفع الصورة: ${image.file.name}`);
    }

    return {
      key: uploadData.key,
      url: uploadData.publicUrl,
      alt: form.name,
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!form.variants.length) {
      setError("يجب أن يحتوي المنتج على لون ومقاس واحد على الأقل.");
      return;
    }

    setSubmitting(true);

    try {
      // Existing images are kept as-is. Only files selected during this edit
      // are uploaded to R2.
      const savedImages = await Promise.all(
        form.images.map(async (image) =>
          image.file ? uploadNewImage(image) : image
        )
      );

      const payload = {
        name: form.name.trim(),
        productCode: form.productCode.trim() || undefined,
        category: form.category.trim() || null,
        description: form.description,
        status: form.status,
        images: savedImages.map((image, index) => ({
          key: image.key || null,
          url: image.url || null,
          alt: image.alt || form.name,
          isPrimary: index === 0,
          sortOrder: index,
        })),
        variants: form.variants.map((variant) => ({
          // Preserve existing variant fields that are not shown in this form.
          ...variant,
          sku: variant.sku,
          color: {
            ...variant.color,
            name: variant.color.name,
            hex: (variant.color.hex || "#000000").toUpperCase(),
          },
          size: {
            ...variant.size,
            code: variant.size.code,
          },
          costPrice: Number(variant.costPrice),
          salePrice: Number(variant.salePrice),
          stock: {
            ...variant.stock,
            quantity: Number(variant.stock?.quantity || 0),
            reorderPoint: Number(variant.stock?.reorderPoint || 0),
          },
        })),
      };

      const data = await apiRequest(`/products/${product._id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      onUpdated(data.product);
      onClose();
    } catch (err) {
      setError(err.message || "تعذر تحديث المنتج");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="product-form-modal" dir="rtl">
        <header>
          <h2>تعديل المنتج</h2>
          <button type="button" onClick={onClose} disabled={submitting}>
            إغلاق
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              اسم المنتج
              <input
                required
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
              />
            </label>

            <label>
              كود المنتج
              <input
                value={form.productCode}
                onChange={(event) =>
                  updateField("productCode", event.target.value)
                }
              />
            </label>

            <label>
              التصنيف
              <input
                value={form.category}
                onChange={(event) =>
                  updateField("category", event.target.value)
                }
              />
            </label>

            <label>
              الحالة
              <select
                value={form.status}
                onChange={(event) => updateField("status", event.target.value)}
              >
                <option value="active">نشط</option>
                <option value="draft">مسودة</option>
              </select>
            </label>
          </div>

          <label className="full-width-field">
            الوصف
            <textarea
              rows="4"
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
            />
          </label>

          <section className="images-section">
            <h3>صور المنتج</h3>
            <label className="image-upload-button">
              إضافة صور
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImagesChange}
              />
            </label>

            {form.images.length > 0 && (
              <div className="image-previews">
                {form.images.map((image, index) => (
                  <div
                    className="image-preview"
                    key={image.key || image.url || image.preview || `image-${index}`}
                  >
                    {(image.preview || image.url) && (
                      <img
                        src={image.preview || image.url}
                        alt={image.alt || `صورة المنتج ${index + 1}`}
                      />
                    )}
                    {index === 0 && <span>الصورة الرئيسية</span>}
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      aria-label="حذف الصورة"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="variants-section">
         

            {form.variants.map((variant, index) => (
              <fieldset className="variant-form" key={variant._id || index}>
                <legend>الحقل {index + 1}</legend>
                <div className="form-grid">
                  <label>
                    SKU
                    <input
                      required
                      value={variant.sku}
                      onChange={(event) =>
                        updateVariant(index, "sku", event.target.value)
                      }
                    />
                  </label>

                  <label>
                    اسم اللون
                    <input
                      required
                      value={variant.color.name}
                      onChange={(event) =>
                        updateVariant(index, "color.name", event.target.value)
                      }
                    />
                  </label>

                  <label>
                    كود اللون
                    <span className="color-control">
                      <input
                        className="color-picker"
                        type="color"
                        value={/^#[0-9A-Fa-f]{6}$/.test(variant.color.hex)
                          ? variant.color.hex
                          : "#000000"}
                        onChange={(event) =>
                          updateVariant(
                            index,
                            "color.hex",
                            event.target.value.toUpperCase()
                          )
                        }
                      />
                      <input
                        className="color-code-input"
                        type="text"
                        dir="ltr"
                        pattern="^#[0-9A-Fa-f]{6}$"
                        maxLength={7}
                        required
                        value={variant.color.hex}
                        onChange={(event) =>
                          updateVariant(
                            index,
                            "color.hex",
                            event.target.value.toUpperCase()
                          )
                        }
                      />
                    </span>
                  </label>

                  <label>
                    المقاس
                    <input
                      required
                      placeholder="مثل M أو 42"
                      value={variant.size.code}
                      onChange={(event) =>
                        updateVariant(index, "size.code", event.target.value)
                      }
                    />
                  </label>

                  <label>
                    سعر التكلفة
                    <input
                      required
                      min="0"
                      type="number"
                      step="0.01"
                      value={variant.costPrice}
                      onChange={(event) =>
                        updateVariant(index, "costPrice", event.target.value)
                      }
                    />
                  </label>

                  <label>
                    سعر البيع
                    <input
                      required
                      min="0"
                      type="number"
                      step="0.01"
                      value={variant.salePrice}
                      onChange={(event) =>
                        updateVariant(index, "salePrice", event.target.value)
                      }
                    />
                  </label>

                  <label>
                    كمية المخزون
                    <input
                      required
                      min="0"
                      type="number"
                      step="1"
                      value={variant.stock.quantity}
                      onChange={(event) =>
                        updateVariant(
                          index,
                          "stock.quantity",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
تنبيه عند وصول المخزون إلى                    <input
                      min="0"
                      type="number"
                      step="1"
                      value={variant.stock.reorderPoint}
                      onChange={(event) =>
                        updateVariant(
                          index,
                          "stock.reorderPoint",
                          event.target.value
                        )
                      }
                    />
                  </label>
                </div>

                {form.variants.length > 1 && (
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => removeVariant(index)}
                  >
                    حذف الحقل
                  </button>
                )}
              </fieldset>
            ))}
               <div className="variants-section-header">
              <h3>الألوان والمقاسات</h3>
              <button type="button" onClick={addVariant}>
                إضافة لون أو مقاس
              </button>
            </div>
          </section>

          {error && <p role="alert">{error}</p>}

          <footer>
            <button type="button" onClick={onClose} disabled={submitting}>
              إلغاء
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? "جارٍ حفظ التعديلات..." : "حفظ التعديلات"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
