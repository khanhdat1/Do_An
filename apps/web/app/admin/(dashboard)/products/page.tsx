import type { Metadata } from "next";
import AdminProductListView from "@/components/admin/AdminProductListView";

export const metadata: Metadata = {
  title: "Sản phẩm | Quản trị PCZone",
};

export default function AdminProductsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="section-title text-2xl">Sản phẩm & kho hàng</h1>
        <p className="mt-1 text-sm text-slate-500">
          Thêm, sửa, ẩn, lưu trữ sản phẩm và theo dõi tồn kho. Sản phẩm mới luôn bắt đầu ở trạng thái nháp — duyệt để bắt
          đầu bán ra ngoài.
        </p>
      </div>

      <AdminProductListView />
    </div>
  );
}
