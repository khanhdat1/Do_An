import type { Metadata } from "next";
import AdminCustomerListView from "@/components/admin/AdminCustomerListView";

export const metadata: Metadata = {
  title: "Khách hàng | Quản trị PCZone",
};

/** Tiêu đề trang nằm trong khung tối của AdminCustomerListView (cùng tông thanh menu) */
export default function AdminCustomersPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <AdminCustomerListView />
    </div>
  );
}
