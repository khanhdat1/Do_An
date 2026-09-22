import type { Metadata } from "next";
import AdminOrderListView from "@/components/admin/AdminOrderListView";

export const metadata: Metadata = {
  title: "Quản trị đơn hàng | PCZone",
  robots: { index: false, follow: false },
};

export default function AdminOrdersPage() {
  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="section-title text-2xl">Xác nhận thanh toán</h1>
        <p className="text-sm text-slate-500">
          Đơn chuyển khoản ngân hàng / MoMo không có cổng nào tự báo đã thanh toán — xác nhận tay sau khi đối chiếu đã nhận
          được tiền.
        </p>

        <AdminOrderListView />
      </div>
    </div>
  );
}
