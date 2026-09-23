import type { Metadata } from "next";
import AdminCustomerListView from "@/components/admin/AdminCustomerListView";

export const metadata: Metadata = {
  title: "Khách hàng | Quản trị PCZone",
};

export default function AdminCustomersPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="section-title text-2xl">Khách hàng</h1>
        <p className="mt-1 text-sm text-slate-500">Danh sách tài khoản khách hàng, lịch sử mua hàng, tổng chi tiêu và khoá/mở khoá tài khoản.</p>
      </div>

      <AdminCustomerListView />
    </div>
  );
}
