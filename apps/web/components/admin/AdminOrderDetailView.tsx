"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  Banknote,
  CloudOff,
  LoaderCircle,
  MapPin,
  MessageSquareText,
  Package,
  PackageX,
  Printer,
  RotateCcw,
  ShieldAlert,
  Truck,
} from "lucide-react";
import ProductThumb from "@/components/product/ProductThumb";
import AdminBadge from "@/components/admin/AdminBadge";
import OrderTimeline from "@/components/orders/OrderTimeline";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ApiError, adminApiFetch, errorMessage } from "@/lib/admin-api-client";
import { formatPrice } from "@/lib/format";
import {
  ORDER_ADVANCE_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
} from "@/lib/data/orders";
import type { AdminOrder, OrderStatus } from "@/types";

type State = { status: "loading" } | { status: "not_found" } | { status: "error" } | { status: "ready"; order: AdminOrder };

/** "22/09/2026 14:05" */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function AdvanceStatusButton({ orderCode, targetStatus, onUpdated }: { orderCode: string; targetStatus: OrderStatus; onUpdated: (order: AdminOrder) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    try {
      const order = await adminApiFetch<AdminOrder>(`/api/admin/orders/${orderCode}/status`, { method: "PATCH", body: { status: targetStatus } });
      onUpdated(order);
      toast.success(`Đã chuyển đơn sang "${ORDER_STATUS_LABEL[targetStatus]}"`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Truck className="size-4" />}
      {ORDER_ADVANCE_LABEL[targetStatus] ?? "Chuyển trạng thái"}
    </button>
  );
}

function ConfirmPaymentButton({ orderCode, onUpdated }: { orderCode: string; onUpdated: (order: AdminOrder) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    try {
      const order = await adminApiFetch<AdminOrder>(`/api/admin/orders/${orderCode}/confirm-payment`, { method: "POST", body: {} });
      onUpdated(order);
      toast.success("Đã xác nhận thanh toán");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Banknote className="size-4" />}
      Xác nhận đã nhận tiền
    </button>
  );
}

interface ReasonActionButtonProps {
  label: string;
  confirmButtonLabel: string;
  placeholder: string;
  icon: typeof Ban;
  danger?: boolean;
  orderCode: string;
  endpoint: "cancel" | "return" | "mark-refunded";
  /** Tên trường body gửi lên — cancel/return dùng "reason", mark-refunded dùng "note" */
  fieldName: "reason" | "note";
  successMessage: string;
  onUpdated: (order: AdminOrder) => void;
  extraNote?: string;
}

/** Nút thao tác quan trọng (huỷ/hoàn/đánh dấu hoàn tiền) — luôn hỏi lại kèm ô lý do trước khi gọi API */
function ReasonActionButton({
  label,
  confirmButtonLabel,
  placeholder,
  icon: Icon,
  danger,
  orderCode,
  endpoint,
  fieldName,
  successMessage,
  onUpdated,
  extraNote,
}: ReasonActionButtonProps) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const order = await adminApiFetch<AdminOrder>(`/api/admin/orders/${orderCode}/${endpoint}`, {
        method: "POST",
        body: { [fieldName]: text.trim() || undefined },
      });
      onUpdated(order);
      toast.success(successMessage);
      setConfirming(false);
      setText("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div className="w-full space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        {extraNote ? <p className="text-xs font-medium text-slate-500">{extraNote}</p> : null}
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              danger ? "bg-sale-600 hover:bg-sale-700" : "bg-brand-500 hover:bg-brand-600"
            }`}
          >
            {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
            {busy ? "Đang xử lý..." : confirmButtonLabel}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-500 hover:underline"
          >
            Không
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={`flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-bold transition ${
        danger
          ? "border-sale-200 text-sale-600 hover:border-sale-300 hover:bg-sale-500/5"
          : "border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-500/5"
      }`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function TrackingNumberField({ order, onUpdated, readOnly }: { order: AdminOrder; onUpdated: (order: AdminOrder) => void; readOnly: boolean }) {
  const toast = useToast();
  const [value, setValue] = useState(order.trackingNumber ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = value.trim() !== (order.trackingNumber ?? "");

  async function save() {
    setBusy(true);
    try {
      const updated = await adminApiFetch<AdminOrder>(`/api/admin/orders/${order.orderCode}/tracking-number`, {
        method: "PATCH",
        body: { trackingNumber: value.trim() },
      });
      onUpdated(updated);
      toast.success("Đã lưu mã vận đơn");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (readOnly) {
    return <p className="text-sm font-semibold text-slate-700">{order.trackingNumber || "Chưa có mã vận đơn"}</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Chưa có mã vận đơn"
        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
      />
      {dirty ? (
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="shrink-0 rounded-lg bg-brand-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {busy ? "Đang lưu..." : "Lưu"}
        </button>
      ) : null}
    </div>
  );
}

function InternalNoteField({ order, onUpdated, readOnly }: { order: AdminOrder; onUpdated: (order: AdminOrder) => void; readOnly: boolean }) {
  const toast = useToast();
  const [value, setValue] = useState(order.internalNote ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = value.trim() !== (order.internalNote ?? "");

  async function save() {
    setBusy(true);
    try {
      const updated = await adminApiFetch<AdminOrder>(`/api/admin/orders/${order.orderCode}/internal-note`, {
        method: "PATCH",
        body: { internalNote: value.trim() },
      });
      onUpdated(updated);
      toast.success("Đã lưu ghi chú nội bộ");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (readOnly) {
    return <p className="text-sm text-slate-600">{order.internalNote || "Chưa có ghi chú"}</p>;
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Chỉ nhân viên/quản trị viên nhìn thấy — khách hàng không thấy ghi chú này"
        rows={3}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
      />
      {dirty ? (
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {busy ? "Đang lưu..." : "Lưu ghi chú"}
        </button>
      ) : null}
    </div>
  );
}

/** Chi tiết một đơn hàng cho trang quản trị — `/admin/orders/[code]` */
export default function AdminOrderDetailView({ orderCode }: { orderCode: string }) {
  const { user } = useAdminAuth();
  const [state, setState] = useState<State>({ status: "loading" });

  const allowedRead = user ? user.permissions.includes("orders:read") : null;
  const canWrite = user ? user.permissions.includes("orders:write") : false;

  const applyOrder = useCallback((order: AdminOrder) => setState({ status: "ready", order }), []);

  useEffect(() => {
    if (!allowedRead) return;
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
  }, [allowedRead, orderCode]);

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
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">Trang này chỉ dành cho nhân viên/quản trị viên.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/admin/orders" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-brand-600">
        <ArrowLeft className="size-3.5" />
        Danh sách đơn hàng
      </Link>

      {state.status === "loading" ? (
        <div className="admin-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
          <LoaderCircle className="size-4.5 animate-spin" />
          Đang tải đơn hàng...
        </div>
      ) : null}

      {state.status === "not_found" ? (
        <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
          <PackageX className="size-10 text-slate-400" />
          <h2 className="mt-4 text-lg font-bold text-slate-800">Không tìm thấy đơn hàng</h2>
          <p className="mt-1.5 text-sm text-slate-500">Kiểm tra lại mã đơn trên đường dẫn.</p>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
          <CloudOff className="size-8 text-slate-400" />
          <p className="mt-3 text-sm text-slate-500">Không tải được đơn hàng. Vui lòng tải lại trang.</p>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <section className="admin-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">Mã đơn hàng</p>
                  <p className="font-display text-lg font-bold text-slate-900">{state.order.orderCode}</p>
                  <p className="mt-0.5 text-xs text-slate-400">Đặt lúc {formatDateTime(state.order.createdAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <AdminBadge tone={ORDER_STATUS_TONE[state.order.status]}>{ORDER_STATUS_LABEL[state.order.status]}</AdminBadge>
                  <AdminBadge tone={PAYMENT_STATUS_TONE[state.order.paymentStatus]}>{PAYMENT_STATUS_LABEL[state.order.paymentStatus]}</AdminBadge>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-1.5 text-xs font-semibold text-slate-500">Mã vận đơn</p>
                <TrackingNumberField order={state.order} onUpdated={applyOrder} readOnly={!canWrite} />
              </div>

              {canWrite ? (
                <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-slate-100 pt-4">
                  {state.order.paymentStatus === "PENDING" &&
                  (state.order.paymentMethod === "BANK_TRANSFER" || state.order.paymentMethod === "MOMO") ? (
                    <ConfirmPaymentButton orderCode={state.order.orderCode} onUpdated={applyOrder} />
                  ) : null}
                  {state.order.nextStatuses.map((next) => (
                    <AdvanceStatusButton key={next} orderCode={state.order.orderCode} targetStatus={next} onUpdated={applyOrder} />
                  ))}
                  <a
                    href={`/admin/orders/${state.order.orderCode}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-brand-300 hover:bg-brand-500/5"
                  >
                    <Printer className="size-4" />
                    In đơn
                  </a>
                  {state.order.canAdminCancel ? (
                    <ReasonActionButton
                      label="Huỷ đơn"
                      confirmButtonLabel="Xác nhận huỷ"
                      placeholder="Lý do huỷ đơn (không bắt buộc)"
                      icon={Ban}
                      danger
                      orderCode={state.order.orderCode}
                      endpoint="cancel"
                      fieldName="reason"
                      successMessage="Đã huỷ đơn hàng"
                      onUpdated={applyOrder}
                    />
                  ) : null}
                  {state.order.canReturn ? (
                    <ReasonActionButton
                      label="Xử lý hoàn hàng"
                      confirmButtonLabel="Xác nhận hoàn hàng"
                      placeholder="Lý do hoàn hàng (không bắt buộc)"
                      icon={RotateCcw}
                      orderCode={state.order.orderCode}
                      endpoint="return"
                      fieldName="reason"
                      successMessage="Đã ghi nhận hoàn hàng"
                      onUpdated={applyOrder}
                    />
                  ) : null}
                  {state.order.canMarkRefunded ? (
                    <ReasonActionButton
                      label="Đánh dấu đã hoàn tiền"
                      confirmButtonLabel="Xác nhận đã hoàn tiền"
                      placeholder="Ghi chú (vd. đã chuyển khoản lại ngày...)"
                      icon={Banknote}
                      orderCode={state.order.orderCode}
                      endpoint="mark-refunded"
                      fieldName="note"
                      successMessage="Đã ghi nhận hoàn tiền"
                      onUpdated={applyOrder}
                      extraNote="Đây chỉ là GHI NHẬN THỦ CÔNG — hệ thống không tự động chuyển tiền qua bất kỳ cổng nào. Chỉ bấm sau khi đã thực sự chuyển khoản lại cho khách."
                    />
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="admin-card p-4 sm:p-5">
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
                <Package className="size-4.5 text-slate-400" />
                Sản phẩm ({state.order.items.length})
              </h2>
              <ul className="space-y-3">
                {state.order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3">
                    <div className="w-16 shrink-0">
                      <ProductThumb name={item.name} image={item.image} sizes="64px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-slate-800">{item.name}</p>
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
                  <dd className="font-semibold text-slate-800">{formatPrice(state.order.subtotal)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Phí vận chuyển</dt>
                  <dd className="font-semibold text-slate-800">
                    {state.order.shippingFee === 0 ? <span className="text-emerald-600">Miễn phí</span> : formatPrice(state.order.shippingFee)}
                  </dd>
                </div>
                {state.order.discountAmount > 0 ? (
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Giảm giá{state.order.voucherCode ? ` (${state.order.voucherCode})` : ""}</dt>
                    <dd className="font-semibold text-emerald-600">-{formatPrice(state.order.discountAmount)}</dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  <dt className="font-semibold text-slate-700">Tổng cộng</dt>
                  <dd className="font-display text-xl font-bold text-sale-600">{formatPrice(state.order.totalAmount)}</dd>
                </div>
              </dl>
            </section>

            <section className="admin-card p-4 sm:p-5">
              <h2 className="mb-2 text-base font-bold text-slate-900">Ghi chú nội bộ</h2>
              <InternalNoteField order={state.order} onUpdated={applyOrder} readOnly={!canWrite} />
            </section>

            {state.order.customerNote ? (
              <section className="admin-card p-4 sm:p-5">
                <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-slate-900">
                  <MessageSquareText className="size-4.5 text-slate-400" />
                  Ghi chú của khách
                </h2>
                <p className="text-sm text-slate-600">{state.order.customerNote}</p>
              </section>
            ) : null}
          </div>

          <div className="space-y-4 lg:col-span-4">
            <section className="admin-card p-4 sm:p-5">
              <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-slate-900">
                <MapPin className="size-4.5 text-slate-400" />
                Giao hàng tới
              </h2>
              <p className="text-sm font-semibold text-slate-800">{state.order.shippingAddress.recipientName}</p>
              <p className="text-sm text-slate-600">{state.order.shippingAddress.phone}</p>
              <p className="mt-1 text-sm text-slate-500">
                {state.order.shippingAddress.streetAddress}, {state.order.shippingAddress.ward}, {state.order.shippingAddress.district},{" "}
                {state.order.shippingAddress.province}
              </p>
              <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-500">
                Thanh toán: <span className="font-semibold text-slate-700">{PAYMENT_METHOD_LABEL[state.order.paymentMethod]}</span>
              </p>
            </section>

            {state.order.payments.length > 0 ? (
              <section className="admin-card p-4 sm:p-5">
                <h2 className="mb-3 text-base font-bold text-slate-900">Lịch sử thanh toán</h2>
                <ul className="space-y-2.5 text-sm">
                  {state.order.payments.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between gap-2 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium text-slate-700">{formatPrice(payment.amount)}</p>
                        <p className="text-xs text-slate-400">{formatDateTime(payment.createdAt)}</p>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">{PAYMENT_STATUS_LABEL[payment.status]}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="admin-card p-4 sm:p-5">
              <h2 className="mb-3 text-base font-bold text-slate-900">Trạng thái đơn hàng</h2>
              <OrderTimeline events={state.order.statusHistory} />
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
