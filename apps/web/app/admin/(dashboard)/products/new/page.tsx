import type { Metadata } from "next";
import AdminProductFormView from "@/components/admin/AdminProductFormView";

export const metadata: Metadata = {
  title: "Thêm sản phẩm | Quản trị PCZone",
};

export default function AdminNewProductPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <AdminProductFormView />
    </div>
  );
}
