"use client";

import { useState } from "react";
import { LoaderCircle, Ban } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { Order } from "@/types";

interface CancelOrderButtonProps {
  orderCode: string;
  onCancelled: (order: Order) => void;
}

/** Nút "Huỷ đơn": hỏi lại một lần ngay tại chỗ (không dùng window.confirm) trước khi gọi API */
export default function CancelOrderButton({ orderCode, onCancelled }: CancelOrderButtonProps) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleCancel() {
    setBusy(true);
    try {
      const order = await apiFetch<Order>(`/api/orders/${orderCode}/cancel`, { method: "POST", body: {} });
      onCancelled(order);
      toast.success("Đã huỷ đơn hàng");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-600">Huỷ đơn hàng này?</span>
        <button
          type="button"
          onClick={handleCancel}
          disabled={busy}
          className="flex items-center gap-1.5 font-bold text-sale-600 hover:underline disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
          {busy ? "Đang huỷ..." : "Xác nhận huỷ"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="font-semibold text-slate-500 hover:underline">
          Không
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-bold text-sale-600 transition hover:border-sale-300 hover:bg-sale-500/5"
    >
      <Ban className="size-3.5" />
      Huỷ đơn
    </button>
  );
}
