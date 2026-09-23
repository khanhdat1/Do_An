"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CloudOff, LoaderCircle, Plus, ShieldAlert, ShieldCheck, UserCog } from "lucide-react";
import AdminBadge from "@/components/admin/AdminBadge";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { adminApiFetch } from "@/lib/admin-api-client";
import { ROLE_LABEL } from "@/lib/data/admin-roles";
import type { AdminAccount } from "@/types";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; items: AdminAccount[] };

/** "22/09/2026" */
function formatDate(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "Chưa từng";
}

/** Danh sách tài khoản quản trị (không gồm khách hàng) — chỉ OWNER, quyền `admins:manage` — trang `/admin/accounts` */
export default function AdminAccountListView() {
  const { user } = useAdminAuth();
  const [state, setState] = useState<State>({ status: "loading" });

  const allowedRead = user ? user.permissions.includes("admins:manage") : null;

  useEffect(() => {
    if (!allowedRead) return;
    let cancelled = false;

    adminApiFetch<{ items: AdminAccount[] }>("/api/admin/accounts")
      .then((data) => {
        if (!cancelled) setState({ status: "ready", items: data.items });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [allowedRead]);

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
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">Trang này chỉ dành cho chủ website.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href="/admin/accounts/new"
          className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600"
        >
          <Plus className="size-4" />
          Thêm tài khoản
        </Link>
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
          <p className="mt-3 text-sm text-slate-500">Không tải được danh sách tài khoản. Vui lòng tải lại trang.</p>
        </div>
      ) : null}

      {state.status === "ready" && state.items.length > 0 ? (
        <div className="admin-card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-semibold">Tài khoản</th>
                <th className="px-4 py-3 font-semibold">Vai trò</th>
                <th className="px-4 py-3 font-semibold">2FA</th>
                <th className="px-4 py-3 font-semibold">Đăng nhập gần nhất</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.items.map((account) => (
                <tr key={account.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/accounts/${account.id}`} className="block">
                      <p className="font-bold text-slate-800 hover:text-brand-600">
                        {account.fullName}
                        {account.id === user.id ? <span className="ml-1.5 text-xs font-normal text-slate-400">(bạn)</span> : null}
                      </p>
                      <p className="text-xs text-slate-500">{account.email}</p>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{ROLE_LABEL[account.role]}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {account.totpEnabled ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <ShieldCheck className="size-3.5" />
                        Đã bật
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Chưa bật</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{formatDate(account.lastLoginAt)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {account.isActive ? <AdminBadge tone="green">Đang hoạt động</AdminBadge> : <AdminBadge tone="red">Đã khoá</AdminBadge>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <Link href={`/admin/accounts/${account.id}`} className="text-xs font-bold text-brand-600 hover:underline">
                      Sửa
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {state.status === "ready" && state.items.length === 0 ? (
        <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-slate-100 text-slate-400">
            <UserCog className="size-8" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-800">Chưa có tài khoản quản trị nào khác</h2>
        </div>
      ) : null}
    </div>
  );
}
