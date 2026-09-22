import type { Metadata } from "next";
import { Ticket } from "lucide-react";
import VoucherCard from "@/components/vouchers/VoucherCard";
import { getActiveVouchers } from "@/lib/api";

export const metadata: Metadata = {
  title: "Khuyến mãi & Mã giảm giá | PCZone",
  description: "Các mã giảm giá đang áp dụng tại PCZone — sao chép mã và dùng ngay lúc đặt hàng.",
};

export default async function VouchersPage() {
  const vouchers = await getActiveVouchers();

  return (
    <div className="container-page py-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-gold-400/15">
          <Ticket className="size-7 text-gold-600" strokeWidth={1.8} />
        </span>
        <h1 className="section-title mt-3 text-2xl sm:text-3xl">Khuyến mãi & Mã giảm giá</h1>
        <p className="mt-1.5 max-w-md text-sm text-slate-500">
          Sao chép mã bên dưới và dán vào ô “Mã giảm giá” ở bước đặt hàng.
        </p>
      </div>

      {vouchers.length === 0 ? (
        <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
          <Ticket className="size-10 text-slate-400" />
          <h2 className="mt-4 text-lg font-bold text-slate-800">Hiện chưa có mã giảm giá nào</h2>
          <p className="mt-1.5 max-w-sm text-sm text-slate-500">Quay lại sau nhé, PCZone sẽ sớm có ưu đãi mới.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vouchers.map((voucher) => (
            <VoucherCard key={voucher.code} voucher={voucher} />
          ))}
        </div>
      )}
    </div>
  );
}
