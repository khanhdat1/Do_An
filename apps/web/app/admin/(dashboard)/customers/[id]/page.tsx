import type { Metadata } from "next";
import AdminCustomerDetailView from "@/components/admin/AdminCustomerDetailView";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Khách hàng | Quản trị PCZone" };
}

export default async function AdminCustomerDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-4xl">
      <AdminCustomerDetailView customerId={id} />
    </div>
  );
}
