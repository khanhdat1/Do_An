import type { Metadata } from "next";
import AdminAccountFormView from "@/components/admin/AdminAccountFormView";

export const metadata: Metadata = {
  title: "Thêm tài khoản quản trị | Quản trị PCZone",
};

export default function AdminNewAccountPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <AdminAccountFormView />
    </div>
  );
}
