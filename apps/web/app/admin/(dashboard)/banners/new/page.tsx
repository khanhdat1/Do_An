import type { Metadata } from "next";
import AdminBannerFormView from "@/components/admin/AdminBannerFormView";

export const metadata: Metadata = {
  title: "Thêm banner | Quản trị PCZone",
};

export default function AdminNewBannerPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <AdminBannerFormView />
    </div>
  );
}
