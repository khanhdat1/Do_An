"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CloudOff, Download, LoaderCircle, Lock, ShieldAlert, Users } from "lucide-react";
import AdminBadge from "@/components/admin/AdminBadge";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { adminApiFetch, downloadAdminFile, errorMessage } from "@/lib/admin-api-client";
import { formatPrice } from "@/lib/format";
import type { AdminCustomerSummary, Paginated } from "@/types";

const PAGE_SIZE = 20;
type LockFilter = "ALL" | "ACTIVE" | "LOCKED";
type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: Paginated<AdminCustomerSummary> };

/** "22/09/2026" */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Danh sách khách hàng: tìm kiếm, lọc theo trạng thái khoá, xem nhanh số đơn/tổng chi tiêu — trang `/admin/customers` */
export default function AdminCustomerListView() {
  const { user } = useAdminAuth();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [lockFilter, setLockFilter] = useState<LockFilter>("ALL");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<State>({ status: "loading" });
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  const allowed = user ? user.permissions.includes("customers:read") : null;

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
    setState({ status: "loading" });
  }

  function changeLockFilter(next: LockFilter) {
    setLockFilter(next);
    setPage(1);
    setState({ status: "loading" });
  }

  function goToPage(next: number) {
    setPage(next);
    setState({ status: "loading" });
  }

  async function exportCustomers() {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (lockFilter !== "ALL") query.set("locked", lockFilter === "LOCKED" ? "true" : "false");

    setExporting(true);
    try {
      await downloadAdminFile(`/api/admin/customers/export?${query}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;

    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search) query.set("search", search);
    if (lockFilter !== "ALL") query.set("locked", lockFilter === "LOCKED" ? "true" : "false");

    adminApiFetch<Paginated<AdminCustomerSummary>>(`/api/admin/customers?${query}`)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [allowed, search, lockFilter, page]);

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
            placeholder="Tìm theo tên, email hoặc số điện thoại..."
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:bg-white"
          />
          <button type="submit" className="rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-slate-900">
            Tìm
          </button>
        </form>

        <select
          value={lockFilter}
          onChange={(event) => changeLockFilter(event.target.value as LockFilter)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
        >
          <option value="ALL">Mọi trạng thái</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="LOCKED">Đã khoá</option>
        </select>

        <button
          type="button"
          onClick={exportCustomers}
          disabled={exporting}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-bold text-slate-600 transition hover:border-brand-300 hover:bg-brand-500/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
          {exporting ? "Đang xuất..." : "Xuất Excel"}
        </button>
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
          <p className="mt-3 text-sm text-slate-500">Không tải được danh sách khách hàng. Vui lòng tải lại trang.</p>
        </div>
      ) : null}

      {state.status === "ready" && state.data.items.length === 0 ? (
        <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-slate-100 text-slate-400">
            <Users className="size-8" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-800">Không tìm thấy khách hàng nào</h2>
        </div>
      ) : null}

      {state.status === "ready" && state.data.items.length > 0 ? (
        <div className="admin-card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-semibold">Khách hàng</th>
                <th className="px-4 py-3 font-semibold">Số điện thoại</th>
                <th className="px-4 py-3 font-semibold">Ngày đăng ký</th>
                <th className="px-4 py-3 font-semibold">Số đơn</th>
                <th className="px-4 py-3 font-semibold">Tổng chi tiêu</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.data.items.map((customer) => (
                <tr key={customer.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/customers/${customer.id}`} className="block">
                      <p className="font-bold text-slate-800 hover:text-brand-600">{customer.fullName}</p>
                      <p className="text-xs text-slate-500">{customer.email}</p>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{customer.phone || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{formatDate(customer.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{customer.orderCount}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-bold text-slate-800">{formatPrice(customer.totalSpent)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {customer.isActive ? (
                      <AdminBadge tone="green">Đang hoạt động</AdminBadge>
                    ) : (
                      <AdminBadge tone="red">
                        <Lock className="mr-1 inline size-3" />
                        Đã khoá
                      </AdminBadge>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <Link href={`/admin/customers/${customer.id}`} className="text-xs font-bold text-brand-600 hover:underline">
                      Xem
                    </Link>
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
            Trang {state.data.page} / {state.data.totalPages} · {state.data.total} khách hàng
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
