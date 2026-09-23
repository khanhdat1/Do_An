"use client";

import { useEffect, useState } from "react";
import { CloudOff, LoaderCircle, PackageX, Printer, ShieldAlert } from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { ApiError, adminApiFetch } from "@/lib/admin-api-client";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/data/orders";
import type { AdminOrder } from "@/types";

type State = { status: "loading" } | { status: "not_found" } | { status: "error" } | { status: "ready"; order: AdminOrder };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Phiếu giao hàng in được — `/admin/orders/[code]/print`, mở ở tab riêng từ trang chi tiết.
 * CHỦ Ý không đưa ghi chú nội bộ / lý do huỷ-hoàn vào đây: phiếu này có thể lọt tới tay khách hoặc
 * đơn vị vận chuyển, không phải chỗ để lộ thông tin nội bộ.
 */
export default function AdminOrderPrintView({ orderCode }: { orderCode: string }) {
  const { user } = useAdminAuth();
  const [state, setState] = useState<State>({ status: "loading" });
  const allowed = user ? user.permissions.includes("orders:read") : null;

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;

    adminApiFetch<AdminOrder>(`/api/admin/orders/${orderCode}`)
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
  }, [allowed, orderCode]);

  if (!user || allowed === null) {
    return (
      <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải...
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <ShieldAlert className="size-8 text-sale-600" />
        <p className="mt-3 text-sm text-slate-600">Trang này chỉ dành cho nhân viên/quản trị viên.</p>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải đơn hàng...
      </div>
    );
  }

  if (state.status === "not_found") {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <PackageX className="size-8 text-slate-400" />
        <p className="mt-3 text-sm text-slate-500">Không tìm thấy đơn hàng.</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <CloudOff className="size-8 text-slate-400" />
        <p className="mt-3 text-sm text-slate-500">Không tải được đơn hàng.</p>
      </div>
    );
  }

  const { order } = state;

  return (
    <div className="mx-auto max-w-2xl bg-white px-6 py-8 text-slate-900 print:px-0 print:py-0">
      <div className="no-print mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600"
        >
          <Printer className="size-4" />
          In phiếu này
        </button>
      </div>

      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
        <div>
          <p className="font-display text-2xl font-extrabold">PCZone</p>
          <p className="text-xs text-slate-500">Build Your Power — Own Your Zone</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">PHIẾU GIAO HÀNG</p>
          <p className="text-sm text-slate-600">Mã đơn: {order.orderCode}</p>
          <p className="text-sm text-slate-600">Ngày đặt: {formatDate(order.createdAt)}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-semibold text-slate-500">Giao tới</p>
          <p className="mt-1 font-bold">{order.shippingAddress.recipientName}</p>
          <p>{order.shippingAddress.phone}</p>
          <p className="text-slate-600">
            {order.shippingAddress.streetAddress}, {order.shippingAddress.ward}, {order.shippingAddress.district},{" "}
            {order.shippingAddress.province}
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-500">Thanh toán</p>
          <p className="mt-1">
            Phương thức: <span className="font-semibold">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</span>
          </p>
          <p>
            Trạng thái: <span className="font-semibold">{PAYMENT_STATUS_LABEL[order.paymentStatus]}</span>
          </p>
          <p>
            Trạng thái đơn: <span className="font-semibold">{ORDER_STATUS_LABEL[order.status]}</span>
          </p>
          {order.trackingNumber ? (
            <p>
              Mã vận đơn: <span className="font-semibold">{order.trackingNumber}</span>
            </p>
          ) : null}
        </div>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-slate-300 text-left">
            <th className="py-2 pr-2 font-semibold">Sản phẩm</th>
            <th className="py-2 pr-2 text-right font-semibold">SL</th>
            <th className="py-2 pr-2 text-right font-semibold">Đơn giá</th>
            <th className="py-2 text-right font-semibold">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-slate-100">
              <td className="py-2 pr-2">{item.name}</td>
              <td className="py-2 pr-2 text-right">{item.quantity}</td>
              <td className="py-2 pr-2 text-right">{formatPrice(item.unitPrice)}</td>
              <td className="py-2 text-right font-medium">{formatPrice(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-3 w-64 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Tạm tính</span>
          <span>{formatPrice(order.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Phí vận chuyển</span>
          <span>{order.shippingFee === 0 ? "Miễn phí" : formatPrice(order.shippingFee)}</span>
        </div>
        {order.discountAmount > 0 ? (
          <div className="flex justify-between">
            <span className="text-slate-500">Giảm giá{order.voucherCode ? ` (${order.voucherCode})` : ""}</span>
            <span>-{formatPrice(order.discountAmount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-slate-300 pt-1.5 text-base font-bold">
          <span>Tổng cộng</span>
          <span>{formatPrice(order.totalAmount)}</span>
        </div>
      </div>

      {order.customerNote ? (
        <div className="mt-6 border-t border-slate-200 pt-3 text-sm">
          <p className="font-semibold text-slate-500">Ghi chú của khách</p>
          <p className="mt-1 text-slate-700">{order.customerNote}</p>
        </div>
      ) : null}

      <p className="mt-10 text-center text-xs text-slate-400">
        Cảm ơn quý khách đã mua hàng tại PCZone. Hotline hỗ trợ: 1800 8888.
      </p>

      <style>{`@media print { .no-print { display: none !important; } @page { margin: 14mm; } }`}</style>
    </div>
  );
}
