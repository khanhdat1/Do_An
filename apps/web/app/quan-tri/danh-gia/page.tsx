import type { Metadata } from "next";
import AdminNav from "@/components/admin/AdminNav";
import AdminReviewListView from "@/components/admin/AdminReviewListView";

export const metadata: Metadata = {
  title: "Quản trị đánh giá | PCZone",
  robots: { index: false, follow: false },
};

export default function AdminReviewsPage() {
  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <AdminNav />
        <h1 className="section-title text-2xl">Đánh giá sản phẩm</h1>
        <p className="text-sm text-slate-500">
          Đánh giá chỉ hiện công khai ở trang sản phẩm sau khi được duyệt ở đây.
        </p>

        <AdminReviewListView />
      </div>
    </div>
  );
}
