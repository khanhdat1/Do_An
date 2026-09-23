"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CloudOff, LoaderCircle, Plus, ShieldAlert, Tag } from "lucide-react";
import AdminBadge from "@/components/admin/AdminBadge";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { adminApiFetch } from "@/lib/admin-api-client";
import { formatPrice, formatVoucherDiscount } from "@/lib/format";
import type { AdminVoucher, Paginated, Tone } from "@/types";

const PAGE_SIZE = 20;
type ActiveFilter = "ALL" | "ACTIVE" | "INACTIVE";
type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: Paginated<AdminVoucher> };

/** "22/09/2026" */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Trạng thái HIỂN THỊ, suy ra từ isActive + khoảng ngày + lượt dùng — khác cột `isActive` đang lọc ở
 * trên (đó là công tắc bật/tắt tay của admin; đây là "mã này có thật sự áp dụng được ngay bây giờ
 * không", cùng logic `listActiveVouchers` phía server dùng cho trang công khai `/khuyen-mai`).
 */
function voucherStatusOf(voucher: AdminVoucher): { label: string; tone: Tone } {
  if (!voucher.isActive) return { label: "Đã tắt", tone: "slate" };
  const now = Date.now();
  if (now < new Date(voucher.startsAt).getTime()) return { label: "Sắp diễn ra", tone: "blue" };
  if (now > new Date(voucher.endsAt).getTime()) return { label: "Đã hết hạn", tone: "slate" };
  if (voucher.usageLimit !== undefined && voucher.usageCount >= voucher.usageLimit) return { label: "Hết lượt", tone: "amber" };
  return { label: "Đang áp dụng", tone: "green" };
}

/** Danh sách mã giảm giá — tìm kiếm, lọc theo bật/tắt, thêm mới — trang `/admin/vouchers` */
export default function AdminVoucherListView() {
  const { user } = useAdminAuth();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("ALL");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<State>({ status: "loading" });

  const allowedRead = user ? user.permissions.includes("vouchers:read") : null;
  const canWrite = user ? user.permissions.includes("vouchers:write") : false;

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
    setState({ status: "loading" });
  }

  function changeActiveFilter(next: ActiveFilter) {
    setActiveFilter(next);
    setPage(1);
    setState({ status: "loading" });
  }

  function goToPage(next: number) {
    setPage(next);
    setState({ status: "loading" });
  }

  useEffect(() => {
    if (!allowedRead) return;
    let cancelled = false;

    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search) query.set("search", search);
    if (activeFilter !== "ALL") query.set("active", activeFilter === "ACTIVE" ? "true" : "false");

    adminApiFetch<Paginated<AdminVoucher>>(`/api/admin/vouchers?${query}`)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [allowedRead, search, activeFilter, page]);

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

  return (
    <div className="space-y-4">
      <div className="admin-card flex flex-wrap items-center gap-3 p-3">
        <form onSubmit={submitSearch} className="flex min-w-0 flex-1 items-center gap-2">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Tìm theo mã hoặc tên..."
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:bg-white"
          />
          <button type="submit" className="rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-slate-900">
            Tìm
          </button>
        </form>

        <select
          value={activeFilter}
          onChange={(event) => changeActiveFilter(event.target.value as ActiveFilter)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
        >
          <option value="ALL">Mọi trạng thái</option>
          <option value="ACTIVE">Đang bật</option>
          <option value="INACTIVE">Đã tắt</option>
        </select>

        {canWrite ? (
          <Link
            href="/admin/vouchers/new"
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600"
          >
            <Plus className="size-4" />
            Thêm mã giảm giá
          </Link>
        ) : null}
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
          <p className="mt-3 text-sm text-slate-500">Không tải được danh sách mã giảm giá. Vui lòng tải lại trang.</p>
        </div>
      ) : null}

      {state.status === "ready" && state.data.items.length === 0 ? (
        <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-slate-100 text-slate-400">
            <Tag className="size-8" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-800">Chưa có mã giảm giá nào</h2>
        </div>
      ) : null}

      {state.status === "ready" && state.data.items.length > 0 ? (
        <div className="admin-card overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-semibold">Mã</th>
                <th className="px-4 py-3 font-semibold">Mức giảm</th>
                <th className="px-4 py-3 font-semibold">Điều kiện</th>
                <th className="px-4 py-3 font-semibold">Thời hạn</th>
                <th className="px-4 py-3 font-semibold">Đã dùng</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.data.items.map((voucher) => {
                const status = voucherStatusOf(voucher);
                return (
                  <tr key={voucher.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/vouchers/${voucher.id}`} className="block">
                        <p className="font-bold text-slate-800 hover:text-brand-600">{voucher.code}</p>
                        <p className="line-clamp-1 text-xs text-slate-500">{voucher.name}</p>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-bold text-slate-800">{formatVoucherDiscount(voucher)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                      {voucher.minOrderAmount ? `Đơn từ ${formatPrice(voucher.minOrderAmount)}` : "Không yêu cầu"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                      {formatDate(voucher.startsAt)} – {formatDate(voucher.endsAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">
                      {voucher.usageCount}
                      {voucher.usageLimit !== undefined ? ` / ${voucher.usageLimit}` : ""}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <AdminBadge tone={status.tone}>{status.label}</AdminBadge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <Link href={`/admin/vouchers/${voucher.id}`} className="text-xs font-bold text-brand-600 hover:underline">
                        {canWrite ? "Sửa" : "Xem"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
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
            Trang {state.data.page} / {state.data.totalPages} · {state.data.total} mã
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
