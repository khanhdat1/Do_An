"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";

/**
 * /admin chưa có trang tổng quan riêng (Đợt 4) — chuyển ngay sang mục đầu tiên người này có quyền
 * xem, để không ai vào /admin lại thấy trang trắng hoặc phải tự tìm đường trong sidebar.
 */
export default function AdminIndexPage() {
  const router = useRouter();
  const { user } = useAdminAuth();

  useEffect(() => {
    if (!user) return;
    if (user.permissions.includes("orders:read")) router.replace("/admin/orders");
    else if (user.permissions.includes("products:read")) router.replace("/admin/products");
    else router.replace("/admin/2fa");
  }, [user, router]);

  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
      <LoaderCircle className="size-4.5 animate-spin" />
      Đang chuyển hướng...
    </div>
  );
}
