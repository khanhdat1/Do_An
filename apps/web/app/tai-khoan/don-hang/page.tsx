import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import OrderListView from "@/components/orders/OrderListView";

export const metadata: Metadata = {
  title: "Đơn hàng của tôi | PCZone",
  robots: { index: false, follow: false },
};

export default function MyOrdersPage() {
  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <Link href="/tai-khoan" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-brand-600">
            <ArrowLeft className="size-3.5" />
            Tài khoản của tôi
          </Link>
          <h1 className="section-title mt-2 text-2xl">Đơn hàng của tôi</h1>
        </div>

        <OrderListView />
      </div>
    </div>
  );
}
