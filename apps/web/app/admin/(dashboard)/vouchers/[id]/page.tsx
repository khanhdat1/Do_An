import type { Metadata } from "next";
import AdminVoucherFormView from "@/components/admin/AdminVoucherFormView";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Sửa mã giảm giá | Quản trị PCZone" };
}

export default async function AdminVoucherDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-4xl">
      <AdminVoucherFormView voucherId={id} />
    </div>
  );
}
