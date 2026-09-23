import type { Metadata } from "next";
import AdminOrderListView from "@/components/admin/AdminOrderListView";

export const metadata: Metadata = {
  title: "Đơn hàng | Quản trị PCZone",
};

export default function AdminOrdersPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="section-title text-2xl">Đơn hàng</h1>
        <p className="mt-1 text-sm text-slate-500">
          Bấm vào một đơn để xem chi tiết, chuyển trạng thái, cập nhật mã vận đơn hoặc xử lý huỷ/hoàn. Đơn chuyển khoản
          ngân hàng / MoMo không có cổng nào tự báo đã thanh toán — xác nhận tay sau khi đối chiếu đã nhận được tiền.
        </p>
      </div>

      <AdminOrderListView />
    </div>
  );
}
