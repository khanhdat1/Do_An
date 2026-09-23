import type { Metadata } from "next";
import AdminReviewListView from "@/components/admin/AdminReviewListView";

export const metadata: Metadata = {
  title: "Đánh giá sản phẩm | Quản trị PCZone",
};

export default function AdminReviewsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="section-title text-2xl">Đánh giá sản phẩm</h1>
        <p className="mt-1 text-sm text-slate-500">Đánh giá chỉ hiện công khai ở trang sản phẩm sau khi được duyệt ở đây.</p>
      </div>

      <AdminReviewListView />
    </div>
  );
}
