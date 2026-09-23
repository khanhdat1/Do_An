import type { Metadata } from "next";
import AdminAccountFormView from "@/components/admin/AdminAccountFormView";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Sửa tài khoản quản trị | Quản trị PCZone" };
}

export default async function AdminAccountDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-3xl">
      <AdminAccountFormView accountId={id} />
    </div>
  );
}
