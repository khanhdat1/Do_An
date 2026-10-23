"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CloudOff, Download, KeyRound, LoaderCircle, Lock, LockOpen, Pencil, Search, ShieldAlert, Trash2, Users, X } from "lucide-react";
import { DeleteCustomerDialog, EditCustomerDialog, LockCustomerDialog, ResetPasswordDialog, darkInputClass } from "@/components/admin/AdminCustomerDialogs";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { adminApiFetch, downloadAdminFile, errorMessage } from "@/lib/admin-api-client";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminCustomerList, AdminCustomerSummary } from "@/types";

const PAGE_SIZE = 20;
type LockFilter = "ALL" | "ACTIVE" | "LOCKED";
type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: AdminCustomerList };
type Action = { kind: "edit" | "lock" | "password" | "delete"; customer: AdminCustomerSummary };

const FILTERS: { value: LockFilter; label: string; count: (counts: AdminCustomerList["counts"]) => number }[] = [
  { value: "ALL", label: "Tất cả", count: (counts) => counts.all },
  { value: "ACTIVE", label: "Đang hoạt động", count: (counts) => counts.active },
  { value: "LOCKED", label: "Đã khoá", count: (counts) => counts.locked },
];

/** "22/09/2026" */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ActionButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-slate-300 ring-1 ring-inset ring-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500",
        danger ? "hover:bg-red-500/15 hover:text-red-300 hover:ring-red-400/40" : "hover:bg-ember-500/15 hover:text-brand-300 hover:ring-ember-500/60",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Quản lý khách hàng — trang `/admin/customers`, giao diện tối cùng tông thanh menu quản trị (nền ink, cam nhấn).
 * Tìm theo tên/email/SĐT, lọc theo trạng thái tài khoản; mỗi dòng có 4 thao tác: sửa thông tin, khoá/mở khoá (kèm lý do,
 * khách bị đăng xuất ngay), cấp lại mật khẩu, xoá tài khoản (hộp thoại ở AdminCustomerDialogs.tsx).
 */
export default function AdminCustomerListView() {
  const { user } = useAdminAuth();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [lockFilter, setLockFilter] = useState<LockFilter>("ALL");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<State>({ status: "loading" });
  const [exporting, setExporting] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const toast = useToast();

  const allowed = user ? user.permissions.includes("customers:read") : null;
  const canWrite = Boolean(user?.permissions.includes("customers:write"));

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
    setState({ status: "loading" });
  }

  function clearSearch() {
    setSearchInput("");
    setSearch("");
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

  /** Sau mỗi thao tác: đóng hộp thoại và tải lại đúng trang đang xem (giữ ô tìm kiếm, bộ lọc) */
  function finishAction() {
    setAction(null);
    setReloadKey((key) => key + 1);
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

    adminApiFetch<AdminCustomerList>(`/api/admin/customers?${query}`)
      .then((data) => {
        if (cancelled) return;
        // Xoá dòng cuối của trang cuối: lùi về trang trước thay vì hiện trang trống
        if (data.items.length === 0 && page > 1 && data.total > 0) {
          setPage(data.totalPages);
          return;
        }
        setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [allowed, search, lockFilter, page, reloadKey]);

  const panel = "rounded-2xl bg-ink-900 text-slate-100 ring-1 ring-white/10";

  if (!user || allowed === null) {
    return (
      <div className={cn(panel, "flex items-center justify-center gap-2 p-10 text-sm text-slate-300")}>
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải...
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className={cn(panel, "flex flex-col items-center px-6 py-14 text-center")}>
        <span className="grid size-16 place-items-center rounded-full bg-red-500/15 text-red-300">
          <ShieldAlert className="size-8" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-white">Không có quyền truy cập</h2>
        <p className="mt-1.5 max-w-sm text-sm text-slate-300">Trang này chỉ dành cho chủ website/quản lý.</p>
      </div>
    );
  }

  const counts = state.status === "ready" ? state.data.counts : null;

  return (
    <div className={cn(panel, "overflow-hidden")}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="border-l-4 border-ember-500 pl-3">
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white">Khách hàng</h1>
          <p className="mt-0.5 text-sm text-slate-300">Quản lý tài khoản khách hàng: sửa thông tin, khoá/mở khoá, cấp lại mật khẩu, xoá tài khoản.</p>
        </div>
        <button
          type="button"
          onClick={exportCustomers}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold text-slate-100 ring-1 ring-inset ring-white/15 transition hover:bg-white/10 hover:ring-ember-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
          {exporting ? "Đang xuất..." : "Xuất Excel"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-5 py-3">
        <div className="flex flex-wrap gap-1 rounded-xl bg-ink-950 p-1 ring-1 ring-inset ring-white/10" role="group" aria-label="Lọc theo trạng thái tài khoản">
          {FILTERS.map((filter) => {
            const active = lockFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => changeLockFilter(filter.value)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500",
                  active ? "bg-brand-500 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white",
                )}
              >
                {filter.label}
                {counts ? (
                  <span className={cn("rounded-md px-1.5 text-xs font-bold", active ? "bg-black/25 text-white" : "bg-white/10 text-slate-200")}>{filter.count(counts)}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <form onSubmit={submitSearch} role="search" className="flex min-w-0 flex-1 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Tìm khách hàng theo tên, email hoặc số điện thoại"
              placeholder="Tìm theo tên, email hoặc số điện thoại..."
              className={cn(darkInputClass, "pl-9")}
            />
          </div>
          {search ? (
            <button type="button" onClick={clearSearch} aria-label="Xoá ô tìm kiếm" className="grid size-9 place-items-center rounded-lg text-slate-300 ring-1 ring-inset ring-white/15 hover:bg-white/10 hover:text-white">
              <X className="size-4" />
            </button>
          ) : null}
          <button type="submit" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900">
            Tìm
          </button>
        </form>
      </div>

      {state.status === "loading" ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-300">
          <LoaderCircle className="size-4.5 animate-spin" />
          Đang tải...
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <CloudOff className="size-8 text-slate-400" />
          <p className="mt-3 text-sm text-slate-300">Không tải được danh sách khách hàng. Vui lòng tải lại trang.</p>
        </div>
      ) : null}

      {state.status === "ready" && state.data.items.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-white/5 text-slate-300">
            <Users className="size-8" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-white">Không tìm thấy khách hàng nào</h2>
        </div>
      ) : null}

      {state.status === "ready" && state.data.items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-ink-850 text-left text-xs uppercase tracking-wider text-slate-300">
                <th className="px-4 py-3 font-semibold">Mã KH</th>
                <th className="px-4 py-3 font-semibold">Họ tên</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Số điện thoại</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold">Ngày tạo</th>
                {canWrite ? <th className="px-4 py-3 text-right font-semibold">Thao tác</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {state.data.items.map((customer) => (
                <tr key={customer.id} className="transition hover:bg-white/[0.03]">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-300">{customer.code}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${customer.id}`} className="font-bold text-white hover:text-brand-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500">
                      {customer.fullName}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {customer.orderCount} đơn · {formatPrice(customer.totalSpent)}
                    </p>
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-slate-200" title={customer.email}>
                    {customer.email}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-200">{customer.phone || "—"}</td>
                  <td className="px-4 py-3">
                    {customer.isActive ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-bold text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        Hoạt động
                      </span>
                    ) : (
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-1 text-xs font-bold text-red-300 ring-1 ring-inset ring-red-400/30">
                          <Lock className="size-3" />
                          Đang khoá
                        </span>
                        {customer.lockReason ? (
                          <p className="mt-1 max-w-[180px] truncate text-xs text-slate-400" title={customer.lockReason}>
                            {customer.lockReason}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-200">{formatDate(customer.createdAt)}</td>
                  {canWrite ? (
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <ActionButton label={`Sửa thông tin ${customer.fullName}`} onClick={() => setAction({ kind: "edit", customer })}>
                          <Pencil className="size-4" />
                        </ActionButton>
                        <ActionButton
                          label={customer.isActive ? `Khoá tài khoản ${customer.fullName}` : `Mở khoá tài khoản ${customer.fullName}`}
                          onClick={() => setAction({ kind: "lock", customer })}
                        >
                          {customer.isActive ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
                        </ActionButton>
                        <ActionButton label={`Cấp lại mật khẩu cho ${customer.fullName}`} onClick={() => setAction({ kind: "password", customer })}>
                          <KeyRound className="size-4" />
                        </ActionButton>
                        <ActionButton label={`Xoá tài khoản ${customer.fullName}`} danger onClick={() => setAction({ kind: "delete", customer })}>
                          <Trash2 className="size-4" />
                        </ActionButton>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {state.status === "ready" && state.data.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
          <span className="text-sm text-slate-300">
            Trang {state.data.page} / {state.data.totalPages} · {state.data.total} khách hàng
          </span>
          {state.data.totalPages > 1 ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-white/15 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
                Trước
              </button>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= state.data.totalPages}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-white/15 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sau
                <ChevronRight className="size-4" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {action?.kind === "edit" ? <EditCustomerDialog customer={action.customer} onClose={() => setAction(null)} onSaved={finishAction} /> : null}
      {action?.kind === "lock" ? <LockCustomerDialog customer={action.customer} onClose={() => setAction(null)} onDone={finishAction} /> : null}
      {action?.kind === "password" ? <ResetPasswordDialog customer={action.customer} onClose={() => setAction(null)} /> : null}
      {action?.kind === "delete" ? <DeleteCustomerDialog customer={action.customer} onClose={() => setAction(null)} onDeleted={finishAction} /> : null}
    </div>
  );
}
