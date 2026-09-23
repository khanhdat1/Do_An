import type { Metadata } from "next";
import AdminVoucherFormView from "@/components/admin/AdminVoucherFormView";

export const metadata: Metadata = {
  title: "Thêm mã giảm giá | Quản trị PCZone",
};

export default function AdminNewVoucherPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <AdminVoucherFormView />
    </div>
  );
}
