"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { formatPrice } from "@/lib/format";
import type { Order } from "@/types";

function CopyRow({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`Đã sao chép ${label.toLowerCase()}`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Không sao chép được. Vui lòng tự chọn và sao chép.");
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate text-sm font-bold text-slate-800">{value}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:text-brand-600"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Đã chép" : "Chép"}
      </button>
    </div>
  );
}

/**
 * Hướng dẫn chuyển khoản cho đơn BANK_TRANSFER/MOMO — KHÔNG phải cổng thanh toán tự động: khách tự
 * chuyển, nhân viên xác nhận tay nên có thể mất thời gian, không lên đơn ngay như VNPay. Chỉ hiện khi
 * đơn còn `paymentStatus: PENDING` — API đã tự bỏ trường `bankTransfer`/`momo` khi đơn đã thanh toán.
 */
export default function ManualPaymentPanel({ order }: { order: Order }) {
  if (order.paymentStatus !== "PENDING") return null;

  if (order.paymentMethod === "BANK_TRANSFER" && order.bankTransfer) {
    const { qrUrl, bankName, accountNumber, accountName } = order.bankTransfer;
    return (
      <section className="surface-card p-4 sm:p-5">
        <h2 className="mb-3 text-base font-bold text-slate-900">Quét mã để chuyển khoản</h2>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh QR dựng động từ vietqr.io, không phải ảnh tĩnh trong repo */}
          <img src={qrUrl} alt={`Mã QR chuyển khoản ${bankName}`} width={220} height={220} className="shrink-0 rounded-xl border border-slate-200" />
          <div className="w-full min-w-0 divide-y divide-slate-100">
            <CopyRow label="Ngân hàng" value={bankName} />
            <CopyRow label="Số tài khoản" value={accountNumber} />
            <CopyRow label="Chủ tài khoản" value={accountName} />
            <CopyRow label="Số tiền" value={formatPrice(order.totalAmount)} />
            <CopyRow label="Nội dung chuyển khoản" value={order.orderCode} />
          </div>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          Mã QR đã điền sẵn số tiền và nội dung — quét bằng app ngân hàng bất kỳ là tự điền hết. Đơn sẽ được xác nhận sau khi
          cửa hàng nhận được tiền, có thể mất một thời gian do xác nhận thủ công.
        </p>
      </section>
    );
  }

  if (order.paymentMethod === "MOMO" && order.momo) {
    return (
      <section className="surface-card p-4 sm:p-5">
        <h2 className="mb-3 text-base font-bold text-slate-900">Quét mã để chuyển khoản qua MoMo</h2>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <Image
            src="/images/payments/momo-qr.png"
            alt="Mã QR nhận tiền MoMo"
            width={220}
            height={236}
            className="shrink-0 rounded-xl border border-slate-200"
          />
          <div className="w-full min-w-0 divide-y divide-slate-100">
            <CopyRow label="Số điện thoại MoMo" value={order.momo.phone} />
            <CopyRow label="Tên người nhận" value={order.momo.displayName} />
            <CopyRow label="Số tiền" value={formatPrice(order.totalAmount)} />
            <CopyRow label="Lời nhắn" value={order.orderCode} />
          </div>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          Mã QR này không tự điền số tiền như VietQR — quét xong nhớ nhập đúng số tiền và ghi mã đơn{" "}
          <strong>{order.orderCode}</strong> vào lời nhắn để cửa hàng đối chiếu. Đơn sẽ được xác nhận sau khi nhận được tiền,
          có thể mất một thời gian do xác nhận thủ công.
        </p>
      </section>
    );
  }

  return null;
}
