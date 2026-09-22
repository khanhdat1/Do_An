"use client";

import { useState } from "react";
import { LoaderCircle, Tag, X } from "lucide-react";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { formatPrice } from "@/lib/format";
import type { VoucherPreviewResult } from "@/types";

export interface AppliedVoucher {
  code: string;
  name: string;
  discountAmount: number;
}

interface VoucherInputProps {
  /** Tạm tính hiện tại của giỏ — gửi lên API để tính đúng số tiền được giảm và kiểm tra đơn tối thiểu */
  subtotal: number;
  applied: AppliedVoucher | null;
  onApply: (voucher: AppliedVoucher) => void;
  onRemove: () => void;
}

/** Ô nhập mã giảm giá ở bước đặt hàng: xem trước số tiền được giảm trước khi đặt hàng thật */
export default function VoucherInput({ subtotal, applied, onApply, onRemove }: VoucherInputProps) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const params = new URLSearchParams({ code: trimmed, subtotal: String(subtotal) });
      const result = await apiFetch<VoucherPreviewResult>(`/api/vouchers/preview?${params.toString()}`);
      onApply({ code: result.voucher.code, name: result.voucher.name, discountAmount: result.discountAmount });
      setCode("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (applied) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-600/20">
        <Tag className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          Đã áp dụng <span className="font-mono font-bold">{applied.code}</span> — giảm{" "}
          {formatPrice(applied.discountAmount)}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Bỏ mã giảm giá"
          className="-m-1 shrink-0 rounded-md p-1 text-emerald-700 transition hover:bg-emerald-100"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleApply} className="flex items-start gap-2">
      <div className="flex-1">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Nhập mã giảm giá"
          className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
        />
        {error ? <p className="mt-1.5 text-xs font-medium text-sale-600">{error}</p> : null}
      </div>
      <button
        type="submit"
        disabled={submitting || !code.trim()}
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-slate-800 px-4 text-sm font-bold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
        Áp dụng
      </button>
    </form>
  );
}
