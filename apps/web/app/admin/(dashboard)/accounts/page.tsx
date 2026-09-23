import type { Metadata } from "next";
import AdminAccountListView from "@/components/admin/AdminAccountListView";

export const metadata: Metadata = {
  title: "Tài khoản quản trị | Quản trị PCZone",
};

export default function AdminAccountsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="section-title text-2xl">Tài khoản quản trị</h1>
        <p className="mt-1 text-sm text-slate-500">
          Thêm, sửa, khoá/mở khoá tài khoản của chủ website/nhân viên khác. Không hiển thị tài khoản khách hàng ở đây.
        </p>
      </div>

      <AdminAccountListView />
    </div>
  );
}
