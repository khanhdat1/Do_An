import type { Metadata } from "next";
import AdminBannerFormView from "@/components/admin/AdminBannerFormView";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Sửa banner | Quản trị PCZone" };
}

export default async function AdminBannerDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-3xl">
      <AdminBannerFormView bannerId={id} />
    </div>
  );
}
