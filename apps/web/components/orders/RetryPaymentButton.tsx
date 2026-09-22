"use client";

import { useState } from "react";
import { CreditCard, LoaderCircle } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { CreateOrderResult } from "@/types";

/** Nút "Thanh toán lại": mở một lượt thử VNPay mới cho đơn chưa trả tiền thành công, rồi chuyển sang cổng thanh toán */
export default function RetryPaymentButton({ orderCode }: { orderCode: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handleRetry() {
    setBusy(true);
    try {
      const result = await apiFetch<CreateOrderResult>(`/api/orders/${orderCode}/pay`, { method: "POST" });
      if (!result.payUrl) throw new Error("Thiếu địa chỉ thanh toán");
      window.location.assign(result.payUrl);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleRetry}
      disabled={busy}
      className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {busy ? <LoaderCircle className="size-4.5 animate-spin" /> : <CreditCard className="size-4.5" />}
      {busy ? "Đang chuyển sang VNPay..." : "Thanh toán lại qua VNPay"}
    </button>
  );
}
