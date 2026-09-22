"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleAlert, CircleCheck, CloudOff, LoaderCircle, PackageX } from "lucide-react";
import OrderDetailView from "@/components/orders/OrderDetailView";
import { useRequireAuth } from "@/components/auth/useRequireAuth";
import { useCart } from "@/components/providers/CartProvider";
import { apiFetch, ApiError } from "@/lib/api-client";
import { VNPAY_REASON_LABEL } from "@/lib/data/orders";
import type { Order } from "@/types";

type State = { status: "loading" } | { status: "not_found" } | { status: "error" } | { status: "ready"; order: Order };

interface OrderPageViewProps {
  orderCode: string;
  /** Đọc từ `?pay=` trên URL — trang này cũng là nơi VNPay đưa khách quay về sau khi thanh toán */
  paymentResult?: "success" | "failed";
  /** `?reason=` — mã lỗi VNPay khi `paymentResult === "failed"` */
  paymentReason?: string;
}

/** Trang chi tiết một đơn hàng của chính tài khoản đang đăng nhập — `/don-hang/[code]` */
export default function OrderPageView({ orderCode, paymentResult, paymentReason }: OrderPageViewProps) {
  const user = useRequireAuth(`/don-hang/${orderCode}`);
  const { reload: reloadCart } = useCart();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    apiFetch<Order>(`/api/orders/${orderCode}`)
      .then((order) => {
        if (!cancelled) setState({ status: "ready", order });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ status: error instanceof ApiError && error.status === 404 ? "not_found" : "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [user, orderCode]);

  // Vừa quay về từ VNPay: giỏ hàng đã được API dọn từ lúc tạo đơn — đồng bộ lại badge số lượng trên header
  useEffect(() => {
    if (paymentResult === "success") void reloadCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy đúng một lần lúc trang mở kèm ?pay=success, không lặp lại theo reloadCart
  }, [paymentResult]);

  if (!user || state.status === "loading") {
    return (
      <div className="surface-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải đơn hàng...
      </div>
    );
  }

  if (state.status === "not_found") {
    return (
      <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
        <PackageX className="size-10 text-slate-400" />
        <h1 className="mt-4 text-lg font-bold text-slate-800">Không tìm thấy đơn hàng</h1>
        <p className="mt-1.5 text-sm text-slate-500">Đơn hàng không tồn tại hoặc không thuộc tài khoản này.</p>
        <Link
          href="/tai-khoan/don-hang"
          className="mt-6 rounded-xl bg-brand-500 px-6 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
        >
          Xem đơn hàng của tôi
        </Link>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
        <CloudOff className="size-10 text-slate-400" />
        <p className="mt-3 text-sm text-slate-500">Không tải được đơn hàng. Vui lòng tải lại trang.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link href="/tai-khoan/don-hang" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-brand-600">
        <ArrowLeft className="size-3.5" />
        Đơn hàng của tôi
      </Link>

      {paymentResult === "success" ? (
        <div role="status" className="flex items-start gap-2.5 rounded-xl bg-emerald-50 px-4 py-3.5 text-sm text-emerald-800 ring-1 ring-emerald-600/20">
          <CircleCheck className="mt-0.5 size-5 shrink-0" />
          Thanh toán VNPay thành công. Cảm ơn bạn đã mua hàng tại PCZone!
        </div>
      ) : null}
      {paymentResult === "failed" ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-sale-500/10 px-4 py-3.5 text-sm text-sale-700 ring-1 ring-sale-500/25">
          <CircleAlert className="mt-0.5 size-5 shrink-0" />
          {(paymentReason && VNPAY_REASON_LABEL[paymentReason]) ?? "Thanh toán VNPay chưa thành công."} Đơn hàng của bạn vẫn được giữ, bạn
          có thể thử thanh toán lại bên dưới.
        </div>
      ) : null}

      <OrderDetailView order={state.order} interactive onOrderChange={(order) => setState({ status: "ready", order })} />
    </div>
  );
}
