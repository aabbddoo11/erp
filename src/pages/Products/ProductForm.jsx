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

export default function ProductForm({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    productCode: "",
    category: "",
    description: "",
    status: "active",
    variants: [{ ...emptyVariant }],
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateVariant(index, path, value) {
    setForm((current) => {
      const variants = structuredClone(current.variants);
      const variant = variants[index];

      if (path.includes(".")) {
        const [parent, child] = path.split(".");
        variant[parent][child] = value;
      } else {
        variant[path] = value;
      }

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
      variants: current.variants.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function handleImagesChange(event) {
    const files = Array.from(event.target.files || []);

    setImageFiles((current) => [
      ...current,
      ...files.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);

    event.target.value = "";
  }

  function removeImage(index) {
    setImageFiles((current) => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function uploadImages() {
    return Promise.all(
      imageFiles.map(async ({ file }, index) => {
        const uploadData = await apiRequest("/uploads/presign", {
          method: "POST",
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            folder: "products/gallery",
          }),
        });

        const uploadResponse = await fetch(uploadData.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`تعذر رفع الصورة: ${file.name}`);
        }

        return {
          key: uploadData.key,
          url: uploadData.publicUrl,
          alt: form.name,
          isPrimary: index === 0,
          sortOrder: index,
        };
      })
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const images = await uploadImages();

      const payload = {
        ...form,  productCode: form.productCode.trim() || undefined,
        images,
        variants: form.variants.map((variant) => ({
          ...variant,
          costPrice: Number(variant.costPrice),
          salePrice: Number(variant.salePrice),
          stock: {
            quantity: Number(variant.stock.quantity),
            reorderPoint: Number(variant.stock.reorderPoint),
          },
        })),
      };

      const data = await apiRequest("/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      onCreated(data.product);
      onClose();
    } catch (err) {
      setError(err.message || "تعذر إنشاء المنتج");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="product-form-modal" dir="rtl">
        <header>
          <h2>إضافة منتج جديد</h2>
          <button type="button" onClick={onClose}>
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
                onChange={(e) => updateField("name", e.target.value)}
              />
            </label>

            <label>
              كود المنتج
              <input
                value={form.productCode}
                onChange={(e) => updateField("productCode", e.target.value)}
              />
            </label>

            <label>
              التصنيف
              <input
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
              />
            </label>

            <label>
              الوصف
              <input
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
              />
            </label>
          </div>

          <section className="images-section">
            <h3>صور المنتج</h3>

            <label className="image-upload-button">
              اختر صورًا
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImagesChange}
              />
            </label>

            {imageFiles.length > 0 && (
              <div className="image-previews">
                {imageFiles.map((image, index) => (
                  <div className="image-preview" key={image.preview}>
                    <img src={image.preview} alt={`صورة ${index + 1}`} />
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

          <h3>الألوان والمقاسات</h3>

          {form.variants.map((variant, index) => (
            <fieldset className="variant-form" key={index}>
              <legend>الحقل {index + 1}</legend>

              <div className="form-grid">
                <label>
                  SKU
                  <input
                    required
                    value={variant.sku}
                    onChange={(e) =>
                      updateVariant(index, "sku", e.target.value)
                    }
                  />
                </label>

                <label>
                  اسم اللون
                  <input
                    required
                    placeholder="مثل: أسود"
                    value={variant.color.name}
                    onChange={(e) =>
                      updateVariant(index, "color.name", e.target.value)
                    }
                  />
                </label>

             <label>
  كود اللون
  <span className="color-control">
    <input
      className="color-picker"
      type="color"
      value={variant.color.hex}
      onChange={(e) =>
        updateVariant(index, "color.hex", e.target.value.toUpperCase())
      }
    />

    <input
      className="color-code-input"
      type="text"
      dir="ltr"
      placeholder="#000000"
      pattern="^#[0-9A-Fa-f]{6}$"
      maxLength="7"
      value={variant.color.hex}
      onChange={(e) =>
        updateVariant(index, "color.hex", e.target.value.toUpperCase())
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
                    onChange={(e) =>
                      updateVariant(index, "size.code", e.target.value)
                    }
                  />
                </label>

                <label>
                  سعر التكلفة
                  <input
                    required
                    min="0"
                    type="number"
                    value={variant.costPrice}
                    onChange={(e) =>
                      updateVariant(index, "costPrice", e.target.value)
                    }
                  />
                </label>

                <label>
                  سعر البيع
                  <input
                    required
                    min="0"
                    type="number"
                    value={variant.salePrice}
                    onChange={(e) =>
                      updateVariant(index, "salePrice", e.target.value)
                    }
                  />
                </label>

                <label>
                 كمية المخزون
                  <input
                    required
                    min="0"
                    type="number"
                    value={variant.stock.quantity}
                    onChange={(e) =>
                      updateVariant(index, "stock.quantity", e.target.value)
                    }
                  />
                </label>

                <label>
                 تنبيه عند وصول المخزون إلى
                  <input
                    min="0"
                    type="number"
                    value={variant.stock.reorderPoint}
                    onChange={(e) =>
                      updateVariant(index, "stock.reorderPoint", e.target.value)
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

          <button type="button" onClick={addVariant}>
            إضافة لون أو مقاس
          </button>

          {error && <p role="alert">{error}</p>}

          <footer>
            <button type="button" onClick={onClose}>
              إلغاء
            </button>

            <button type="submit" disabled={submitting}>
              {submitting ? "جارٍ الحفظ والرفع..." : "حفظ المنتج"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}