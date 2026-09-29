import type { Metadata } from "next";
import AdminSettingsView from "@/components/admin/AdminSettingsView";

export const metadata: Metadata = {
  title: "Cài đặt hệ thống | Quản trị PCZone",
};

export default function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="section-title text-2xl">Cài đặt hệ thống</h1>
        <p className="mt-1 text-sm text-slate-500">
          Thông tin liên hệ, phí vận chuyển, bật/tắt phương thức thanh toán và tính năng AI — đổi ngay tại đây, không cần sửa
          code hay khởi động lại máy chủ.
        </p>
      </div>

      <AdminSettingsView />
    </div>
  );
}
