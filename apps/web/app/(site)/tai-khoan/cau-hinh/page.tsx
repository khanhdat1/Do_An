import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MyBuildsView from "@/components/build-pc/MyBuildsView";

export const metadata: Metadata = {
  title: "Cấu hình PC đã lưu | PCZone",
  robots: { index: false, follow: false },
};

export default function MyBuildsPage() {
  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <Link href="/tai-khoan" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-brand-600">
            <ArrowLeft className="size-3.5" />
            Tài khoản của tôi
          </Link>
          <h1 className="section-title mt-2 text-2xl">Cấu hình PC đã lưu</h1>
        </div>

        <MyBuildsView />
      </div>
    </div>
  );
}
