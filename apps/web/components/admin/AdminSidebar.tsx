"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Image, LayoutDashboard, LayoutGrid, Package, ShieldCheck, Star, Tag, Users, X } from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { cn } from "@/lib/utils";
import type { Permission } from "@/types";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Package;
  /** Không có nghĩa là ai đã đăng nhập cũng thấy (vd trang bảo mật của chính mình) */
  permission?: Permission;
  /** true = chỉ khớp active khi ĐÚNG đường dẫn này (dùng cho "/admin" — mọi trang quản trị khác cũng bắt đầu bằng "/admin/") */
  exactMatch?: boolean;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Tổng quan",
    items: [{ href: "/admin", label: "Tổng quan", icon: LayoutDashboard, permission: "reports:read", exactMatch: true }],
  },
  {
    label: "Vận hành",
    items: [
      { href: "/admin/orders", label: "Đơn hàng", icon: Package, permission: "orders:read" },
      { href: "/admin/customers", label: "Khách hàng", icon: Users, permission: "customers:read" },
      { href: "/admin/products", label: "Sản phẩm", icon: Boxes, permission: "products:read" },
      { href: "/admin/vouchers", label: "Mã giảm giá", icon: Tag, permission: "vouchers:read" },
      { href: "/admin/reviews", label: "Đánh giá", icon: Star, permission: "products:read" },
    ],
  },
  {
    label: "Nội dung",
    items: [{ href: "/admin/banners", label: "Banner trang chủ", icon: Image, permission: "content:read" }],
  },
  {
    label: "Tài khoản",
    items: [{ href: "/admin/2fa", label: "Bảo mật tài khoản", icon: ShieldCheck }],
  },
];

export default function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAdminAuth();

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || user?.permissions.includes(item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex h-full flex-col bg-ink-900 text-white">
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/admin" className="flex items-center gap-2.5 font-display text-lg font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-500/15 text-brand-400">
            <LayoutGrid className="size-4.5" />
          </span>
          PCZone Admin
        </Link>
        <button type="button" onClick={onNavigate} className="grid size-8 place-items-center rounded-lg hover:bg-white/10 lg:hidden">
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = item.exactMatch ? pathname === item.href : pathname === item.href || pathname?.startsWith(`${item.href}/`);
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
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
