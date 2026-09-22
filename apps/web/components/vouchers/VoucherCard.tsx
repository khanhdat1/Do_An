"use client";

import { useState } from "react";
import { Check, Copy, Ticket } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { formatPrice, formatVoucherDiscount } from "@/lib/format";
import type { Voucher } from "@/types";

/** "HSD: 22/09/2026" */
function formatEndsAt(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Một mã giảm giá công khai — chip mã kèm nút sao chép, dùng ở trang `/khuyen-mai` */
export default function VoucherCard({ voucher }: { voucher: Voucher }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(voucher.code);
      setCopied(true);
      toast.success(`Đã sao chép mã "${voucher.code}"`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Không sao chép được. Vui lòng tự chọn và sao chép mã.");
    }
  }

  return (
    <div className="surface-card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-400/15 text-gold-600">
          <Ticket className="size-5" />
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-gold-400/60 bg-gold-400/10 px-3 py-1.5 font-mono text-sm font-bold uppercase tracking-wide text-gold-700 transition hover:bg-gold-400/20"
        >
          {voucher.code}
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>

      <div>
        <p className="font-semibold text-slate-800">{voucher.name}</p>
        {voucher.description ? <p className="mt-0.5 text-sm text-slate-500">{voucher.description}</p> : null}
      </div>

      <p className="font-display text-lg font-bold text-sale-600">{formatVoucherDiscount(voucher)}</p>

      <div className="mt-auto space-y-0.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
        {voucher.minOrderAmount ? <p>Áp dụng cho đơn từ {formatPrice(voucher.minOrderAmount)}</p> : null}
        <p>HSD: {formatEndsAt(voucher.endsAt)}</p>
      </div>
    </div>
  );
}
