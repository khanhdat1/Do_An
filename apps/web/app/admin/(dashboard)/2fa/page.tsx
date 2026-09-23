import type { Metadata } from "next";
import AdminTwoFactorSettings from "@/components/admin/AdminTwoFactorSettings";

export const metadata: Metadata = {
  title: "Bảo mật tài khoản | Quản trị PCZone",
};

export default function AdminTwoFactorPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="section-title text-2xl">Bảo mật tài khoản</h1>
      <AdminTwoFactorSettings />
    </div>
  );
}
