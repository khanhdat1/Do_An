import type { Metadata } from "next";
import AdminOrderPrintView from "@/components/admin/AdminOrderPrintView";

type PageProps = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  return { title: `In đơn ${code} | Quản trị PCZone` };
}

/**
 * Nằm NGOÀI app/admin/(dashboard) có chủ ý — phiếu in không cần sidebar/khung quản trị, chỉ cần
 * AdminAuthProvider từ app/admin/layout.tsx (root layout chung của mọi /admin/*).
 */
export default async function AdminOrderPrintPage({ params }: PageProps) {
  const { code } = await params;

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white">
      <AdminOrderPrintView orderCode={code} />
    </div>
  );
}
