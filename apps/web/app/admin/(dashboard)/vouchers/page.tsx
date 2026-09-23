import type { Metadata } from "next";
import AdminVoucherListView from "@/components/admin/AdminVoucherListView";

export const metadata: Metadata = {
  title: "Mã giảm giá | Quản trị PCZone",
};

export default function AdminVouchersPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="section-title text-2xl">Mã giảm giá</h1>
        <p className="mt-1 text-sm text-slate-500">Tạo, sửa, tắt/xoá mã giảm giá — áp dụng ngay tại trang đặt hàng và trang khuyến mãi công khai.</p>
      </div>

      <AdminVoucherListView />
    </div>
  );
}
