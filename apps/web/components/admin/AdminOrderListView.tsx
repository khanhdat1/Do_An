"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CloudOff, LoaderCircle, PackageSearch, ShieldAlert } from "lucide-react";
import AdminBadge from "@/components/admin/AdminBadge";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { adminApiFetch, errorMessage } from "@/lib/admin-api-client";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE } from "@/lib/data/orders";
import type { AdminOrderSummary, OrderStatus, Paginated } from "@/types";

const PAGE_SIZE = 20;
const STATUS_FILTER_OPTIONS: (OrderStatus | "ALL")[] = ["ALL", "PENDING", "CONFIRMED", "PACKING", "SHIPPING", "DELIVERED", "CANCELLED", "RETURNED"];

type Tab = "PENDING" | "ALL";
type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: Paginated<AdminOrderSummary> };

/** "22/09/2026 14:05" */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ConfirmButton({ orderCode, onConfirmed }: { orderCode: string; onConfirmed: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await adminApiFetch(`/api/admin/orders/${orderCode}/confirm-payment`, { method: "POST", body: {} });
      toast.success(`Đã xác nhận thanh toán đơn ${orderCode}`);
      onConfirmed();
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleConfirm}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
      {busy ? "Đang xác nhận..." : "Xác nhận đã nhận tiền"}
    </button>
  );
}

/** Danh sách đơn hàng cho nhân viên/quản trị xác nhận thanh toán thủ công (MoMo, chuyển khoản) — trang `/admin/orders` */
export default function AdminOrderListView() {
  const { user } = useAdminAuth();
  const [tab, setTab] = useState<Tab>("PENDING");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<State>({ status: "loading" });
  // Đổi tab/bộ lọc/trang tự đổi query nên effect bên dưới tự chạy lại; nhưng "Xác nhận đã nhận tiền" không
  // đổi query nào cả (vẫn tab/trang đó) — cần một giá trị đổi riêng để buộc effect gọi lại API.
  const [refreshTick, setRefreshTick] = useState(0);

  function changeTab(next: Tab) {
    setTab(next);
    setPage(1);
    setState({ status: "loading" });
  }

  function changeStatusFilter(next: OrderStatus | "ALL") {
    setStatusFilter(next);
    setPage(1);
    setState({ status: "loading" });
  }

  function goToPage(next: number) {
    setPage(next);
    setState({ status: "loading" });
  }

  function refresh() {
    setState({ status: "loading" });
    setRefreshTick((tick) => tick + 1);
  }

  const allowed = user ? user.permissions.includes("orders:read") : null;

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;

    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (tab === "PENDING") query.set("paymentStatus", "PENDING");
    if (statusFilter !== "ALL") query.set("status", statusFilter);

    adminApiFetch<Paginated<AdminOrderSummary>>(`/api/admin/orders?${query}`)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [allowed, tab, statusFilter, page, refreshTick]);

  if (!user || allowed === null) {
    return (
      <div className="admin-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải...
      </div>
    );
  }

  if (!allowed) {
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
      <div className="admin-card flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex gap-2">
          {(["PENDING", "ALL"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => changeTab(value)}
              className={`rounded-lg px-3.5 py-2 text-sm font-bold transition ${
                tab === value ? "bg-brand-500 text-white shadow-sm shadow-brand-500/30" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {value === "PENDING" ? "Chờ xác nhận thanh toán" : "Tất cả (theo thanh toán)"}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          Trạng thái đơn:
          <select
            value={statusFilter}
            onChange={(event) => changeStatusFilter(event.target.value as OrderStatus | "ALL")}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
          >
            {STATUS_FILTER_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === "ALL" ? "Tất cả" : ORDER_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.status === "loading" ? (
        <div className="admin-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
          <LoaderCircle className="size-4.5 animate-spin" />
          Đang tải...
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
          <CloudOff className="size-8 text-slate-400" />
          <p className="mt-3 text-sm text-slate-500">Không tải được danh sách đơn hàng. Vui lòng tải lại trang.</p>
        </div>
      ) : null}

      {state.status === "ready" && state.data.items.length === 0 ? (
        <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-slate-100 text-slate-400">
            <PackageSearch className="size-8" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-800">
            {tab === "PENDING" ? "Không có đơn nào đang chờ xác nhận" : "Chưa có đơn hàng nào"}
          </h2>
        </div>
      ) : null}

      {state.status === "ready" && state.data.items.length > 0 ? (
        <div className="admin-card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-semibold">Mã đơn</th>
                <th className="px-4 py-3 font-semibold">Người nhận</th>
                <th className="px-4 py-3 font-semibold">Phương thức</th>
                <th className="px-4 py-3 font-semibold">Số tiền</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold">Thời gian</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.data.items.map((order) => (
                <tr key={order.orderCode} className="transition hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-800">
                    <Link href={`/admin/orders/${order.orderCode}`} className="hover:text-brand-600 hover:underline">
                      {order.orderCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700">{order.recipientName}</p>
                    <p className="text-xs text-slate-500">{order.recipientPhone}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-800">{formatPrice(order.totalAmount)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <AdminBadge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</AdminBadge>
                      <AdminBadge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</AdminBadge>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDateTime(order.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {order.paymentStatus === "PENDING" ? (
                      <ConfirmButton orderCode={order.orderCode} onConfirmed={refresh} />
                    ) : (
                      <Link href={`/admin/orders/${order.orderCode}`} className="text-xs font-bold text-brand-600 hover:underline">
                        Xem chi tiết
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {state.status === "ready" && state.data.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="size-4" />
            Trước
          </button>
          <span className="text-sm text-slate-500">
            Trang {state.data.page} / {state.data.totalPages}
          </span>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= state.data.totalPages}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sau
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
