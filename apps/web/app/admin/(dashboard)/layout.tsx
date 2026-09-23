"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Menu } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";

/**
 * Khung bảo vệ cho mọi trang quản trị THẬT (không phải /admin/login) — chuyển sang trang đăng nhập
 * nếu chưa có phiên hợp lệ. Đặt việc chuyển hướng trong sự kiện của effect (không setState đồng bộ
 * ở thân effect ngoài đúng một lần điều hướng router — router.replace không phải setState nên
 * không dính react-hooks/set-state-in-effect).
 */
export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAdminAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === "anonymous") router.replace("/admin/login");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        <LoaderCircle className="mr-2 size-4.5 animate-spin" />
        Đang tải...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="fixed h-screen w-64">
          <AdminSidebar />
        </div>
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 w-64">
            <AdminSidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Mở menu"
            className="grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <Menu className="size-5" />
          </button>
          <span className="font-display text-base font-bold text-slate-900">PCZone Admin</span>
        </div>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
