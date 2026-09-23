"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { errorMessage } from "@/lib/admin-api-client";
import { ROLE_LABEL } from "@/lib/data/admin-roles";

/** Chữ cái đầu tên dùng làm avatar — không có ảnh đại diện riêng cho tài khoản quản trị */
function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return (parts[parts.length - 1]?.[0] ?? "?").toUpperCase();
}

/** Thanh trên cùng của khu quản trị — cố định trên mọi kích thước màn hình (khác thanh cũ chỉ hiện ở mobile) */
export default function AdminTopbar() {
  const { user, logout } = useAdminAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <div className="flex h-14 flex-1 items-center justify-end">
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="admin-user-menu"
          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-slate-100"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-500 text-xs font-bold text-white">
            {initialsOf(user.fullName)}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-semibold text-slate-800">{user.fullName}</span>
            <span className="block text-xs text-slate-500">{ROLE_LABEL[user.role]}</span>
          </span>
          <ChevronDown className={`size-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
        </button>

        {open ? (
          <div
            id="admin-user-menu"
            className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl bg-white text-slate-700 shadow-xl shadow-black/10 ring-1 ring-black/5"
          >
            <div className="border-b border-slate-100 px-4 py-3 sm:hidden">
              <p className="truncate text-sm font-bold text-slate-900">{user.fullName}</p>
              <p className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
            </div>
            <div className="p-1.5 text-sm">
              <button
                type="button"
                onClick={handleLogout}
                disabled={busy}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-sale-600 transition hover:bg-sale-500/10 disabled:opacity-60"
              >
                <LogOut className="size-4" />
                {busy ? "Đang đăng xuất..." : "Đăng xuất"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
