"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CloudOff, ImageOff, LoaderCircle, Plus, ShieldAlert, Trash2 } from "lucide-react";
import AdminBadge from "@/components/admin/AdminBadge";
import AdminProductInventoryPanel from "@/components/admin/AdminProductInventoryPanel";
import ProductThumb from "@/components/product/ProductThumb";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ApiError, adminApiFetch, errorMessage } from "@/lib/admin-api-client";
import { PRODUCT_STATUS_LABEL, PRODUCT_STATUS_TONE } from "@/lib/data/product-status";
import type { AdminProductDetail, AdminProductInput, ProductFormOptions, ProductStatus, SpecRow } from "@/types";

type LoadState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "error" }
  | { status: "ready"; product: AdminProductDetail | null; options: ProductFormOptions };

const STATUS_TARGETS: { from: ProductStatus[]; to: ProductStatus; label: string }[] = [
  { from: ["DRAFT"], to: "ACTIVE", label: "Duyệt & bắt đầu bán" },
  { from: ["ACTIVE"], to: "HIDDEN", label: "Ẩn khỏi trang bán" },
  { from: ["HIDDEN"], to: "ACTIVE", label: "Mở bán lại" },
  { from: ["ACTIVE", "HIDDEN"], to: "DISCONTINUED", label: "Ngừng kinh doanh (lưu trữ)" },
  { from: ["DISCONTINUED", "HIDDEN"], to: "DRAFT", label: "Đưa về nháp" },
];

function StatusControl({ product, onUpdated }: { product: AdminProductDetail; onUpdated: (product: AdminProductDetail) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const actions = STATUS_TARGETS.filter((t) => t.from.includes(product.status));

  async function apply(to: ProductStatus) {
    setBusy(true);
    try {
      const updated = await adminApiFetch<AdminProductDetail>(`/api/admin/products/${product.id}/status`, { method: "PATCH", body: { status: to } });
      onUpdated(updated);
      toast.success(`Đã chuyển sang "${PRODUCT_STATUS_LABEL[to]}"`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <AdminBadge tone={PRODUCT_STATUS_TONE[product.status]}>{PRODUCT_STATUS_LABEL[product.status]}</AdminBadge>
      {actions.map((action) => (
        <button
          key={action.to}
          type="button"
          disabled={busy}
          onClick={() => apply(action.to)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-brand-300 hover:bg-brand-500/5 disabled:opacity-50"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

function emptyForm(): AdminProductInput {
  return {
    name: "",
    sku: "",
    categoryId: "",
    brandId: undefined,
    sellingPrice: 0,
    costPrice: undefined,
    originalPrice: undefined,
    shortDescription: "",
    description: "",
    warrantyMonths: undefined,
    lowStockThreshold: 5,
    specifications: [],
  };
}

function formFromProduct(product: AdminProductDetail): AdminProductInput {
  return {
    name: product.name,
    sku: product.sku,
    categoryId: product.categoryId,
    brandId: product.brandId,
    sellingPrice: product.sellingPrice,
    costPrice: product.costPrice,
    originalPrice: product.originalPrice,
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    warrantyMonths: product.warrantyMonths,
    lowStockThreshold: product.lowStockThreshold,
    specifications: product.specifications,
  };
}

/** Form thêm mới (productId rỗng) / sửa sản phẩm — `/admin/products/new` và `/admin/products/[id]` */
export default function AdminProductFormView({ productId }: { productId?: string }) {
  const { user } = useAdminAuth();
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [form, setForm] = useState<AdminProductInput>(emptyForm());
  const [saving, setSaving] = useState(false);

  const allowedRead = user ? user.permissions.includes("products:read") : null;
  const canWrite = user ? user.permissions.includes("products:write") : false;

  useEffect(() => {
    if (!allowedRead) return;
    let cancelled = false;

    Promise.all([
      adminApiFetch<ProductFormOptions>("/api/admin/products/meta/options"),
      productId ? adminApiFetch<AdminProductDetail>(`/api/admin/products/${productId}`) : Promise.resolve(null),
    ])
      .then(([options, product]) => {
        if (cancelled) return;
        setState({ status: "ready", product, options });
        setForm(product ? formFromProduct(product) : emptyForm());
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ status: error instanceof ApiError && error.status === 404 ? "not_found" : "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [allowedRead, productId]);

  function updateField<K extends keyof AdminProductInput>(key: K, value: AdminProductInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateSpec(index: number, field: keyof SpecRow, value: string) {
    setForm((current) => {
      const specifications = [...(current.specifications ?? [])];
      specifications[index] = { ...specifications[index], [field]: value };
      return { ...current, specifications };
    });
  }

  function addSpec() {
    setForm((current) => ({ ...current, specifications: [...(current.specifications ?? []), { label: "", value: "" }] }));
  }

  function removeSpec(index: number) {
    setForm((current) => ({ ...current, specifications: (current.specifications ?? []).filter((_, i) => i !== index) }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const body: AdminProductInput = {
        ...form,
        specifications: (form.specifications ?? []).filter((row) => row.label.trim() && row.value.trim()),
      };

      if (productId) {
        const updated = await adminApiFetch<AdminProductDetail>(`/api/admin/products/${productId}`, { method: "PATCH", body });
        setState((current) => (current.status === "ready" ? { ...current, product: updated } : current));
        toast.success("Đã lưu thay đổi");
      } else {
        const created = await adminApiFetch<AdminProductDetail>("/api/admin/products", { method: "POST", body });
        toast.success("Đã tạo sản phẩm — đang ở trạng thái nháp, duyệt để bắt đầu bán");
        router.replace(`/admin/products/${created.id}`);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!user || allowedRead === null) {
    return (
      <div className="admin-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải...
      </div>
    );
  }

  if (!allowedRead) {
    return (
      <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
        <ShieldAlert className="size-8 text-sale-600" />
        <h2 className="mt-4 text-lg font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">Trang này chỉ dành cho nhân viên/quản trị viên.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/admin/products" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-brand-600">
        <ArrowLeft className="size-3.5" />
        Danh sách sản phẩm
      </Link>

      {state.status === "loading" ? (
        <div className="admin-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
          <LoaderCircle className="size-4.5 animate-spin" />
          Đang tải...
        </div>
      ) : null}

      {state.status === "not_found" ? (
        <div className="admin-card flex flex-col items-center px-6 py-14 text-center text-sm text-slate-500">Không tìm thấy sản phẩm.</div>
      ) : null}

      {state.status === "error" ? (
        <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
          <CloudOff className="size-8 text-slate-400" />
          <p className="mt-3 text-sm text-slate-500">Không tải được dữ liệu. Vui lòng tải lại trang.</p>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            {state.product ? (
              <section className="admin-card p-4 sm:p-5">
                <StatusControl
                  product={state.product}
                  onUpdated={(updated) => setState((current) => (current.status === "ready" ? { ...current, product: updated } : current))}
                />
              </section>
            ) : null}

            <form onSubmit={submit} className="admin-card space-y-4 p-4 sm:p-5">
              <h2 className="text-base font-bold text-slate-900">Thông tin sản phẩm</h2>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Tên sản phẩm *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Mã SKU *</label>
                  <input
                    required
                    value={form.sku}
                    onChange={(event) => updateField("sku", event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Danh mục *</label>
                  <select
                    required
                    value={form.categoryId}
                    onChange={(event) => updateField("categoryId", event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  >
                    <option value="" disabled>
                      — Chọn danh mục —
                    </option>
                    {state.options.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.path}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Hãng</label>
                  <select
                    value={form.brandId ?? ""}
                    onChange={(event) => updateField("brandId", event.target.value || undefined)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  >
                    <option value="">— Không chọn —</option>
                    {state.options.brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Bảo hành (tháng)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.warrantyMonths ?? ""}
                    onChange={(event) => updateField("warrantyMonths", event.target.value ? Number(event.target.value) : undefined)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Giá bán (đ) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.sellingPrice}
                    onChange={(event) => updateField("sellingPrice", Number(event.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Giá niêm yết (đ) — để gạch ngang</label>
                  <input
                    type="number"
                    min={0}
                    value={form.originalPrice ?? ""}
                    onChange={(event) => updateField("originalPrice", event.target.value ? Number(event.target.value) : undefined)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Giá vốn (đ) — chỉ quản trị viên thấy</label>
                  <input
                    type="number"
                    min={0}
                    value={form.costPrice ?? ""}
                    onChange={(event) => updateField("costPrice", event.target.value ? Number(event.target.value) : undefined)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Ngưỡng cảnh báo sắp hết hàng</label>
                  <input
                    type="number"
                    min={0}
                    value={form.lowStockThreshold ?? ""}
                    onChange={(event) => updateField("lowStockThreshold", event.target.value ? Number(event.target.value) : undefined)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Mô tả ngắn</label>
                  <input
                    value={form.shortDescription ?? ""}
                    onChange={(event) => updateField("shortDescription", event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Mô tả chi tiết</label>
                  <textarea
                    rows={6}
                    value={form.description ?? ""}
                    onChange={(event) => updateField("description", event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600">Bảng thông số kỹ thuật</label>
                  <button type="button" onClick={addSpec} className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline">
                    <Plus className="size-3.5" />
                    Thêm dòng
                  </button>
                </div>
                <div className="space-y-2">
                  {(form.specifications ?? []).map((row, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        value={row.label}
                        onChange={(event) => updateSpec(index, "label", event.target.value)}
                        placeholder="Tên thông số (vd. Chipset)"
                        className="w-1/3 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
                      />
                      <input
                        value={row.value}
                        onChange={(event) => updateSpec(index, "value", event.target.value)}
                        placeholder="Giá trị"
                        className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
                      />
                      <button type="button" onClick={() => removeSpec(index)} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-sale-500/10 hover:text-sale-600">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                  {(form.specifications ?? []).length === 0 ? <p className="text-xs text-slate-400">Chưa có dòng thông số nào.</p> : null}
                </div>
              </div>

              {canWrite ? (
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
                  {saving ? "Đang lưu..." : productId ? "Lưu thay đổi" : "Tạo sản phẩm"}
                </button>
              ) : (
                <p className="text-xs text-slate-400">Bạn chỉ có quyền xem, không có quyền sửa sản phẩm.</p>
              )}
            </form>

            <section className="admin-card p-4 sm:p-5">
              <h2 className="mb-3 text-base font-bold text-slate-900">Ảnh sản phẩm</h2>
              {state.product && state.product.images.length > 0 ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {state.product.images.map((image, index) => (
                    <div key={index} className="w-full">
                      <ProductThumb name={image.alt} image={image.url} sizes="120px" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-center text-slate-400">
                  <ImageOff className="size-8" />
                  <p className="mt-2 text-sm">Chưa có ảnh nào</p>
                </div>
              )}
              <p className="mt-3 text-xs text-slate-400">
                Ảnh sản phẩm được quản lý qua công cụ tải ảnh riêng của dự án (thư mục ảnh + pipeline kiểm tra chất lượng),
                chưa hỗ trợ tải ảnh trực tiếp từ trang này.
              </p>
            </section>
          </div>

          <div className="lg:col-span-4">
            {state.product ? (
              <AdminProductInventoryPanel
                product={state.product}
                canWrite={canWrite}
                onUpdated={(updated) => setState((current) => (current.status === "ready" ? { ...current, product: updated } : current))}
              />
            ) : (
              <div className="admin-card p-4 text-sm text-slate-400 sm:p-5">Tạo sản phẩm xong mới quản lý được tồn kho.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
