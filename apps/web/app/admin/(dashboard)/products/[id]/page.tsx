import type { Metadata } from "next";
import AdminProductFormView from "@/components/admin/AdminProductFormView";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Sửa sản phẩm | Quản trị PCZone" };
}

export default async function AdminProductDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-6xl">
      <AdminProductFormView productId={id} />
    </div>
  );
}
