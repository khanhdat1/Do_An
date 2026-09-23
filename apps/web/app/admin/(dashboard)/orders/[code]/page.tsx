import type { Metadata } from "next";
import AdminOrderDetailView from "@/components/admin/AdminOrderDetailView";

type PageProps = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  return { title: `Đơn ${code} | Quản trị PCZone` };
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { code } = await params;

  return (
    <div className="mx-auto max-w-6xl">
      <AdminOrderDetailView orderCode={code} />
    </div>
  );
}
