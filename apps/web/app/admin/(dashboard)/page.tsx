"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import AdminDashboardView from "@/components/admin/AdminDashboardView";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";

/**
 * /admin: chủ website/quản lý (quyền `reports:read`) thấy trang tổng quan doanh thu ngay tại đây (Đợt 4).
 * Vai trò khác không có quyền xem doanh thu — chuyển sang mục đầu tiên họ có quyền, để không ai vào
 * /admin lại thấy trang trắng hoặc phải tự tìm đường trong sidebar.
 */
export default function AdminIndexPage() {
  const router = useRouter();
  const { user } = useAdminAuth();

  const showDashboard = user?.permissions.includes("reports:read") ?? false;

  useEffect(() => {
    if (!user || showDashboard) return;
    if (user.permissions.includes("orders:read")) router.replace("/admin/orders");
    else if (user.permissions.includes("customers:read")) router.replace("/admin/customers");
    else if (user.permissions.includes("products:read")) router.replace("/admin/products");
    else router.replace("/admin/2fa");
  }, [user, showDashboard, router]);

  if (showDashboard) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div>
          <h1 className="section-title text-2xl">Tổng quan</h1>
          <p className="mt-1 text-sm text-slate-500">Doanh thu, đơn hàng, sản phẩm bán chạy và tình hình kho hàng.</p>
        </div>
        <AdminDashboardView />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
      <LoaderCircle className="size-4.5 animate-spin" />
      {user ? "Đang chuyển hướng..." : "Đang tải..."}
    </div>
  );
}
