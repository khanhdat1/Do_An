import type { Metadata } from "next";
import { PackageSearch } from "lucide-react";
import GuestLookupForm from "@/components/orders/GuestLookupForm";

export const metadata: Metadata = {
  title: "Tra cứu đơn hàng | PCZone",
  description: "Tra cứu tình trạng đơn hàng PCZone bằng mã đơn và số điện thoại nhận hàng, không cần đăng nhập.",
};

export default function OrderLookupPage() {
  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-50">
            <PackageSearch className="size-7 text-brand-500" strokeWidth={1.8} />
          </span>
          <h1 className="section-title mt-3 text-2xl sm:text-3xl">Tra cứu đơn hàng</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Nhập mã đơn hàng và số điện thoại nhận hàng để xem tình trạng đơn — không cần đăng nhập.
          </p>
        </div>

        <GuestLookupForm />
      </div>
    </div>
  );
}
