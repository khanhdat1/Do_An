"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, LogOut, Package, ShieldCheck, Star, X } from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { errorMessage } from "@/lib/admin-api-client";
import { cn } from "@/lib/utils";
import type { AdminUser, Permission } from "@/types";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Package;
  /** Không có nghĩa là ai đã đăng nhập cũng thấy (vd trang bảo mật của chính mình) */
  permission?: Permission;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin/orders", label: "Đơn hàng", icon: Package, permission: "orders:read" },
  { href: "/admin/reviews", label: "Đánh giá", icon: Star, permission: "products:read" },
  { href: "/admin/2fa", label: "Bảo mật tài khoản", icon: ShieldCheck },
];

const ROLE_LABEL: Record<AdminUser["role"], string> = {
  CUSTOMER: "Khách hàng",
  ADMIN: "Quản trị viên",
  STAFF: "Nhân viên",
  OWNER: "Chủ website",
  MANAGER: "Quản lý",
  ORDER_STAFF: "Nhân viên đơn hàng",
  PRODUCT_STAFF: "Nhân viên sản phẩm",
};

export default function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAdminAuth();
  const toast = useToast();

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const items = NAV_ITEMS.filter((item) => !item.permission || user?.permissions.includes(item.permission));

  return (
    <div className="flex h-full flex-col bg-ink-900 text-white">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/admin" className="flex items-center gap-2 font-display text-lg font-bold">
          <LayoutGrid className="size-5 text-brand-400" />
          PCZone Admin
        </Link>
        <button type="button" onClick={onNavigate} className="grid size-8 place-items-center rounded-lg hover:bg-white/10 lg:hidden">
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-brand-500 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="size-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        {user ? (
          <div className="mb-2 px-1 text-xs text-slate-400">
            <p className="truncate font-semibold text-slate-200">{user.fullName}</p>
            <p>{ROLE_LABEL[user.role]}</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4.5" />
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
