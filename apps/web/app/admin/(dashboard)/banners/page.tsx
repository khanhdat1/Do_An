import type { Metadata } from "next";
import AdminBannerListView from "@/components/admin/AdminBannerListView";

export const metadata: Metadata = {
  title: "Banner trang chủ | Quản trị PCZone",
};

export default function AdminBannersPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="section-title text-2xl">Banner trang chủ</h1>
        <p className="mt-1 text-sm text-slate-500">Dải banner khuyến mãi xoay vòng, hiện ngay dưới banner thương hiệu ở trang chủ.</p>
      </div>

      <AdminBannerListView />
    </div>
  );
}
