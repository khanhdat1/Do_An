import Link from "next/link";
import { MapPin, MessageSquareText, Package } from "lucide-react";
import ProductThumb from "@/components/product/ProductThumb";
import CancelOrderButton from "@/components/orders/CancelOrderButton";
import ManualPaymentPanel from "@/components/orders/ManualPaymentPanel";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import OrderTimeline from "@/components/orders/OrderTimeline";
import RetryPaymentButton from "@/components/orders/RetryPaymentButton";
import { formatPrice } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/data/orders";
import type { Order } from "@/types";

interface OrderDetailViewProps {
  order: Order;
  /** true ở trang chi tiết của chính chủ tài khoản: hiện nút Huỷ đơn / Thanh toán lại. Tra cứu công khai thì false. */
  interactive?: boolean;
  onOrderChange?: (order: Order) => void;
}

/** "22 thg 9, 2026" */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "numeric", month: "short", year: "numeric" });
}

export default function OrderDetailView({ order, interactive = false, onOrderChange }: OrderDetailViewProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <div className="space-y-5 lg:col-span-8">
        <section className="surface-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">Mã đơn hàng</p>
              <p className="font-display text-lg font-bold text-slate-900">{order.orderCode}</p>
              <p className="mt-0.5 text-xs text-slate-400">Đặt lúc {formatDate(order.createdAt)}</p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          {interactive && (order.canCancel || order.canRetryPayment) ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              {order.canRetryPayment ? <RetryPaymentButton orderCode={order.orderCode} /> : null}
              {order.canCancel ? (
                <CancelOrderButton orderCode={order.orderCode} onCancelled={(next) => onOrderChange?.(next)} />
              ) : null}
            </div>
          ) : null}
        </section>

        <ManualPaymentPanel order={order} />

        <section className="surface-card p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
            <Package className="size-4.5 text-slate-400" />
            Sản phẩm ({order.items.length})
          </h2>
          <ul className="space-y-3">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                {item.productSlug ? (
                  <Link href={`/san-pham/${item.productSlug}`} className="w-16 shrink-0">
                    <ProductThumb name={item.name} image={item.image} sizes="64px" />
                  </Link>
                ) : (
                  <div className="w-16 shrink-0">
                    <ProductThumb name={item.name} image={item.image} sizes="64px" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {item.productSlug ? (
                    <Link href={`/san-pham/${item.productSlug}`} className="line-clamp-2 text-sm font-medium text-slate-800 hover:text-brand-600">
                      {item.name}
                    </Link>
                  ) : (
                    <p className="line-clamp-2 text-sm font-medium text-slate-500">{item.name}</p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.quantity} × {formatPrice(item.unitPrice)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-slate-800">{formatPrice(item.lineTotal)}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Tạm tính</dt>
              <dd className="font-semibold text-slate-800">{formatPrice(order.subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Phí vận chuyển</dt>
              <dd className="font-semibold text-slate-800">
                {order.shippingFee === 0 ? <span className="text-emerald-600">Miễn phí</span> : formatPrice(order.shippingFee)}
              </dd>
            </div>
            {order.discountAmount > 0 ? (
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Giảm giá{order.voucherCode ? ` (${order.voucherCode})` : ""}</dt>
                <dd className="font-semibold text-emerald-600">-{formatPrice(order.discountAmount)}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
              <dt className="font-semibold text-slate-700">Tổng cộng</dt>
              <dd className="font-display text-xl font-bold text-sale-600">{formatPrice(order.totalAmount)}</dd>
            </div>
          </dl>
        </section>

        {order.customerNote ? (
          <section className="surface-card p-4 sm:p-5">
            <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-slate-900">
              <MessageSquareText className="size-4.5 text-slate-400" />
              Ghi chú của bạn
            </h2>
            <p className="text-sm text-slate-600">{order.customerNote}</p>
          </section>
        ) : null}
      </div>

      <div className="space-y-5 lg:col-span-4">
        <section className="surface-card p-4 sm:p-5">
          <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-slate-900">
            <MapPin className="size-4.5 text-slate-400" />
            Giao hàng tới
          </h2>
          <p className="text-sm font-semibold text-slate-800">{order.shippingAddress.recipientName}</p>
          <p className="text-sm text-slate-600">{order.shippingAddress.phone}</p>
          <p className="mt-1 text-sm text-slate-500">
            {order.shippingAddress.streetAddress}, {order.shippingAddress.ward}, {order.shippingAddress.district},{" "}
            {order.shippingAddress.province}
          </p>

          <div className="mt-3 space-y-0.5 border-t border-slate-100 pt-3 text-sm">
            <p className="text-slate-500">
              Thanh toán: <span className="font-semibold text-slate-700">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</span>
            </p>
            <p className="text-slate-500">
              Trạng thái: <span className="font-semibold text-slate-700">{PAYMENT_STATUS_LABEL[order.paymentStatus]}</span>
            </p>
          </div>
        </section>

        <section className="surface-card p-4 sm:p-5">
          <h2 className="mb-3 text-base font-bold text-slate-900">Trạng thái đơn hàng</h2>
          <OrderTimeline events={order.statusHistory} />
        </section>
      </div>
    </div>
  );
}
