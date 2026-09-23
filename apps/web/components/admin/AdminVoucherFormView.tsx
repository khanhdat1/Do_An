"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, CloudOff, LoaderCircle, ShieldAlert, Trash2 } from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ApiError, adminApiFetch, errorMessage } from "@/lib/admin-api-client";
import { toDateInput } from "@/lib/format";
import type { AdminVoucher, AdminVoucherInput, DiscountType } from "@/types";

type LoadState = { status: "loading" } | { status: "not_found" } | { status: "error" } | { status: "ready"; voucher: AdminVoucher | null };

/** Form dùng chung dạng "YYYY-MM-DD" cho <input type="date"> */
interface FormState {
  code: string;
  name: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  minOrderAmount: string;
  maxDiscount: string;
  usageLimit: string;
  perUserLimit: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

function emptyForm(): FormState {
  const today = toDateInput(new Date().toISOString());
  return {
    code: "",
    name: "",
    description: "",
    discountType: "PERCENT",
    discountValue: "",
    minOrderAmount: "",
    maxDiscount: "",
    usageLimit: "",
    perUserLimit: "1",
    startsAt: today,
    endsAt: today,
    isActive: true,
  };
}

function formFromVoucher(voucher: AdminVoucher): FormState {
  return {
    code: voucher.code,
    name: voucher.name,
    description: voucher.description ?? "",
    discountType: voucher.discountType,
    discountValue: String(voucher.discountValue),
    minOrderAmount: voucher.minOrderAmount !== undefined ? String(voucher.minOrderAmount) : "",
    maxDiscount: voucher.maxDiscount !== undefined ? String(voucher.maxDiscount) : "",
    usageLimit: voucher.usageLimit !== undefined ? String(voucher.usageLimit) : "",
    perUserLimit: String(voucher.perUserLimit),
    startsAt: toDateInput(voucher.startsAt),
    endsAt: toDateInput(voucher.endsAt),
    isActive: voucher.isActive,
  };
}

function DeleteControl({ voucher, onDeleted }: { voucher: AdminVoucher; onDeleted: () => void }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (voucher.usageCount > 0) {
    return <p className="text-xs text-slate-400">Mã đã được dùng {voucher.usageCount} lần — chỉ có thể tắt, không thể xoá (giữ lịch sử đối soát).</p>;
  }

  async function submit() {
    setBusy(true);
    try {
      await adminApiFetch(`/api/admin/vouchers/${voucher.id}`, { method: "DELETE" });
      toast.success("Đã xoá mã giảm giá");
      onDeleted();
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Xoá hẳn mã này?</span>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-sale-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-sale-700 disabled:opacity-60"
        >
          {busy ? "Đang xoá..." : "Xoá"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="text-xs font-semibold text-slate-500 hover:underline">
          Không
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 rounded-lg border border-sale-200 px-3.5 py-2 text-xs font-bold text-sale-600 transition hover:border-sale-300 hover:bg-sale-500/5"
    >
      <Trash2 className="size-3.5" />
      Xoá mã
    </button>
  );
}

/** Form thêm mới (voucherId rỗng) / sửa mã giảm giá — `/admin/vouchers/new` và `/admin/vouchers/[id]` */
export default function AdminVoucherFormView({ voucherId }: { voucherId?: string }) {
  const { user } = useAdminAuth();
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<LoadState>(() => (voucherId ? { status: "loading" } : { status: "ready", voucher: null }));
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const allowedRead = user ? user.permissions.includes("vouchers:read") : null;
  const canWrite = user ? user.permissions.includes("vouchers:write") : false;

  useEffect(() => {
    if (!allowedRead || !voucherId) return;
    let cancelled = false;

    adminApiFetch<AdminVoucher>(`/api/admin/vouchers/${voucherId}`)
      .then((voucher) => {
        if (cancelled) return;
        setState({ status: "ready", voucher });
        setForm(formFromVoucher(voucher));
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ status: error instanceof ApiError && error.status === 404 ? "not_found" : "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [allowedRead, voucherId]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const body: AdminVoucherInput = {
        code: form.code,
        name: form.name,
        description: form.description.trim() || undefined,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : undefined,
        maxDiscount: form.discountType === "PERCENT" && form.maxDiscount ? Number(form.maxDiscount) : undefined,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        perUserLimit: Number(form.perUserLimit) || 1,
        startsAt: `${form.startsAt}T00:00:00`,
        endsAt: `${form.endsAt}T23:59:59`,
        isActive: form.isActive,
      };

      if (voucherId) {
        const updated = await adminApiFetch<AdminVoucher>(`/api/admin/vouchers/${voucherId}`, { method: "PATCH", body });
        setState({ status: "ready", voucher: updated });
        setForm(formFromVoucher(updated));
        toast.success("Đã lưu thay đổi");
      } else {
        const created = await adminApiFetch<AdminVoucher>("/api/admin/vouchers", { method: "POST", body });
        toast.success("Đã tạo mã giảm giá");
        router.replace(`/admin/vouchers/${created.id}`);
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
        <span className="grid size-16 place-items-center rounded-full bg-sale-500/10 text-sale-600">
          <ShieldAlert className="size-8" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">Trang này chỉ dành cho chủ website/quản lý.</p>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="admin-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải...
      </div>
    );
  }

  if (state.status === "not_found") {
    return (
      <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
        <h2 className="text-lg font-bold text-slate-800">Không tìm thấy mã giảm giá này</h2>
        <Link href="/admin/vouchers" className="mt-3 text-sm font-bold text-brand-600 hover:underline">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
        <CloudOff className="size-8 text-slate-400" />
        <p className="mt-3 text-sm text-slate-500">Không tải được mã giảm giá. Vui lòng tải lại trang.</p>
      </div>
    );
  }

  const readOnly = !canWrite;
  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-500";

  return (
    <div className="space-y-4">
      <Link href="/admin/vouchers" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-600">
        <ChevronLeft className="size-4" />
        Quay lại danh sách mã giảm giá
      </Link>

      <form onSubmit={submit} className="admin-card space-y-4 p-4 sm:p-5">
        <h1 className="text-lg font-bold text-slate-900">{voucherId ? "Sửa mã giảm giá" : "Thêm mã giảm giá"}</h1>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Mã (tự viết hoa)</label>
            <input
              value={form.code}
              onChange={(event) => updateField("code", event.target.value)}
              disabled={readOnly}
              required
              maxLength={50}
              placeholder="VD: SALE50K"
              className={`${inputClass} font-mono uppercase`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Tên hiển thị</label>
            <input value={form.name} onChange={(event) => updateField("name", event.target.value)} disabled={readOnly} required maxLength={200} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Mô tả (không bắt buộc, hiện ở trang khuyến mãi công khai)</label>
          <textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} disabled={readOnly} rows={2} maxLength={500} className={inputClass} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Kiểu giảm</label>
            <select value={form.discountType} onChange={(event) => updateField("discountType", event.target.value as DiscountType)} disabled={readOnly} className={inputClass}>
              <option value="PERCENT">Theo phần trăm (%)</option>
              <option value="FIXED">Số tiền cố định (đ)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Mức giảm ({form.discountType === "PERCENT" ? "%, 1-100" : "đ"})</label>
            <input
              type="number"
              min={0}
              max={form.discountType === "PERCENT" ? 100 : undefined}
              value={form.discountValue}
              onChange={(event) => updateField("discountValue", event.target.value)}
              disabled={readOnly}
              required
              className={inputClass}
            />
          </div>
          {form.discountType === "PERCENT" ? (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Giảm tối đa (đ, để trống = không giới hạn)</label>
              <input type="number" min={0} value={form.maxDiscount} onChange={(event) => updateField("maxDiscount", event.target.value)} disabled={readOnly} className={inputClass} />
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Đơn tối thiểu (đ, để trống = không yêu cầu)</label>
            <input type="number" min={0} value={form.minOrderAmount} onChange={(event) => updateField("minOrderAmount", event.target.value)} disabled={readOnly} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Tổng lượt dùng (để trống = không giới hạn)</label>
            <input type="number" min={1} value={form.usageLimit} onChange={(event) => updateField("usageLimit", event.target.value)} disabled={readOnly} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Lượt dùng / một khách</label>
            <input type="number" min={1} value={form.perUserLimit} onChange={(event) => updateField("perUserLimit", event.target.value)} disabled={readOnly} required className={inputClass} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Bắt đầu</label>
            <input type="date" value={form.startsAt} onChange={(event) => updateField("startsAt", event.target.value)} disabled={readOnly} required className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Kết thúc (áp dụng tới hết ngày này)</label>
            <input type="date" value={form.endsAt} onChange={(event) => updateField("endsAt", event.target.value)} disabled={readOnly} required className={inputClass} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => updateField("isActive", event.target.checked)}
            disabled={readOnly}
            className="size-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500/30"
          />
          Đang bật (cho phép áp dụng)
        </label>

        {canWrite ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
            {state.voucher ? <DeleteControl voucher={state.voucher} onDeleted={() => router.replace("/admin/vouchers")} /> : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}
