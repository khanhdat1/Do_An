"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CloudOff, Lock, LoaderCircle, Mail, Phone, ShieldAlert, Unlock, UserRound } from "lucide-react";
import AdminBadge from "@/components/admin/AdminBadge";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ApiError, adminApiFetch, errorMessage } from "@/lib/admin-api-client";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE } from "@/lib/data/orders";
import type { AdminCustomerDetail, AdminOrderSummary, Paginated } from "@/types";

const ORDERS_PAGE_SIZE = 10;

type LoadState = { status: "loading" } | { status: "not_found" } | { status: "error" } | { status: "ready"; customer: AdminCustomerDetail };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function LockControl({ customer, canWrite, onUpdated }: { customer: AdminCustomerDetail; canWrite: boolean; onUpdated: (customer: AdminCustomerDetail) => void }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const updated = await adminApiFetch<AdminCustomerDetail>(`/api/admin/customers/${customer.id}/lock`, {
        method: "PATCH",
        body: { isActive: !customer.isActive, reason: reason.trim() || undefined },
      });
      onUpdated(updated);
      toast.success(updated.isActive ? "Đã mở khoá tài khoản" : "Đã khoá tài khoản");
      setConfirming(false);
      setReason("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (!canWrite) return null;

  if (confirming) {
    return (
      <div className="w-full space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:w-80">
        <p className="text-xs font-medium text-slate-500">
          {customer.isActive
            ? "Khách sẽ không đăng nhập được ở lần tiếp theo (hoặc khi phiên hiện tại hết hạn, tối đa 15 phút)."
            : "Khách sẽ đăng nhập lại được ngay."}
        </p>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Lý do (không bắt buộc, chỉ lưu nội bộ)..."
          rows={2}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              customer.isActive ? "bg-sale-600 hover:bg-sale-700" : "bg-brand-500 hover:bg-brand-600"
            }`}
          >
            {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
            {busy ? "Đang xử lý..." : customer.isActive ? "Khoá tài khoản" : "Mở khoá"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-500 hover:underline">
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
        customer.isActive
          ? "border-sale-200 text-sale-600 hover:border-sale-300 hover:bg-sale-500/5"
          : "border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-500/5"
      }`}
    >
      {customer.isActive ? <Lock className="size-4" /> : <Unlock className="size-4" />}
      {customer.isActive ? "Khoá tài khoản" : "Mở khoá tài khoản"}
    </button>
  );
}

function OrderHistoryPanel({ customerId }: { customerId: string }) {
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<Paginated<AdminOrderSummary> | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApiFetch<Paginated<AdminOrderSummary>>(`/api/admin/customers/${customerId}/orders?page=${page}&pageSize=${ORDERS_PAGE_SIZE}`)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [customerId, page]);

  return (
    <section className="admin-card p-4 sm:p-5">
      <h2 className="text-base font-bold text-slate-900">Lịch sử mua hàng</h2>

      {!history ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
          <LoaderCircle className="size-4 animate-spin" />
          Đang tải...
        </div>
      ) : history.items.length === 0 ? (
        <p className="py-4 text-sm text-slate-400">Khách hàng chưa đặt đơn nào.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {history.items.map((order) => (
            <Link
              key={order.orderCode}
              href={`/admin/orders/${order.orderCode}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-2.5 text-sm transition hover:border-brand-200 hover:bg-brand-500/5"
            >
              <div>
                <p className="font-bold text-slate-800">{order.orderCode}</p>
                <p className="text-xs text-slate-400">{formatDateTime(order.createdAt)}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <AdminBadge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</AdminBadge>
                <AdminBadge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</AdminBadge>
              </div>
              <p className="font-bold text-slate-800">{formatPrice(order.totalAmount)}</p>
            </Link>
          ))}
        </div>
      )}

      {history && history.totalPages > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => p - 1)}
            disabled={page <= 1}
            className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-xs text-slate-500">
            {history.page}/{history.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= history.totalPages}
            className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

/** Hồ sơ khách hàng: thông tin, số đơn/tổng chi tiêu, khoá/mở khoá, lịch sử mua hàng — trang `/admin/customers/[id]` */
export default function AdminCustomerDetailView({ customerId }: { customerId: string }) {
  const { user } = useAdminAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const allowedRead = user ? user.permissions.includes("customers:read") : null;
  const canWrite = user ? user.permissions.includes("customers:write") : false;

  useEffect(() => {
    if (!allowedRead) return;
    let cancelled = false;

    adminApiFetch<AdminCustomerDetail>(`/api/admin/customers/${customerId}`)
      .then((customer) => {
        if (!cancelled) setState({ status: "ready", customer });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: error instanceof ApiError && error.status === 404 ? "not_found" : "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [allowedRead, customerId]);

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
        <h2 className="text-lg font-bold text-slate-800">Không tìm thấy khách hàng này</h2>
        <Link href="/admin/customers" className="mt-3 text-sm font-bold text-brand-600 hover:underline">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
        <CloudOff className="size-8 text-slate-400" />
        <p className="mt-3 text-sm text-slate-500">Không tải được thông tin khách hàng. Vui lòng tải lại trang.</p>
      </div>
    );
  }

  const { customer } = state;

  return (
    <div className="space-y-4">
      <Link href="/admin/customers" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-600">
        <ChevronLeft className="size-4" />
        Quay lại danh sách khách hàng
      </Link>

      <section className="admin-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-500/10 text-brand-600">
              <UserRound className="size-6" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{customer.fullName}</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Mail className="size-3.5" />
                  {customer.email}
                  {!customer.emailVerifiedAt ? <span className="text-xs text-slate-400">(chưa xác minh)</span> : null}
                </span>
                {customer.phone ? (
                  <span className="flex items-center gap-1">
                    <Phone className="size-3.5" />
                    {customer.phone}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          {customer.isActive ? <AdminBadge tone="green">Đang hoạt động</AdminBadge> : <AdminBadge tone="red">Đã khoá</AdminBadge>}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-xl font-bold text-slate-800">{customer.orderCount}</p>
            <p className="text-xs text-slate-500">Tổng số đơn</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-xl font-bold text-slate-800">{formatPrice(customer.totalSpent)}</p>
            <p className="text-xs text-slate-500">Tổng chi tiêu (đơn đã thanh toán)</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-sm font-bold text-slate-800">{formatDateTime(customer.createdAt)}</p>
            <p className="text-xs text-slate-500">Ngày đăng ký</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-sm font-bold text-slate-800">{customer.lastLoginAt ? formatDateTime(customer.lastLoginAt) : "Chưa từng"}</p>
            <p className="text-xs text-slate-500">Lần đăng nhập gần nhất</p>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <LockControl customer={customer} canWrite={canWrite} onUpdated={(updated) => setState({ status: "ready", customer: updated })} />
        </div>
      </section>

      <OrderHistoryPanel customerId={customer.id} />
    </div>
  );
}
