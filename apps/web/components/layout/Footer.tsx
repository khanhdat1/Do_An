import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import Logo from "./Logo";
import { getPublicSettings } from "@/lib/api";
import { footerColumns } from "@/lib/data/navigation";
import type { PaymentMethods } from "@/types";

/** Nhãn phương thức thanh toán — VNPay mở trang cổng có sẵn thẻ ATM nội địa và Visa/Master */
const PAYMENT_LABELS: Record<keyof PaymentMethods, string> = {
  cod: "Tiền mặt khi nhận hàng (COD)",
  bankTransfer: "Chuyển khoản ngân hàng",
  momo: "Ví MoMo",
  vnpay: "VNPay (ATM, Visa, Master)",
};

/**
 * Footer tối 5 cột: giới thiệu, khám phá, mua sắm, hỗ trợ, thanh toán.
 * Tổng đài / email / địa chỉ showroom và phương thức thanh toán lấy từ cài đặt hệ thống (`/admin/settings`) —
 * cùng số với TopBar (trước đây Footer ghi 1800 6868 trong khi TopBar ghi 1800 8888), và chỉ liệt kê phương thức
 * khách dùng được thật (đang bật và đã cấu hình), không in logo đối tác/chứng nhận không có thật.
 */
export default async function Footer() {
  const { store, payments } = await getPublicSettings();
  const paymentMethods = (Object.keys(PAYMENT_LABELS) as (keyof PaymentMethods)[]).filter((key) => payments[key]);

  return (
    <footer className="mt-10 bg-ink-950 text-slate-400">
      <div className="container-page grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-5">
        {/* Cột giới thiệu */}
        <div className="lg:col-span-1">
          <Logo />
          <p className="mt-4 text-xs leading-relaxed">
            Laptop, linh kiện PC chính hãng — tự ráp cấu hình có kiểm tra tương thích, trợ lý AI chỉ gợi ý
            từ hàng đang bán.
          </p>
        </div>

        {/* Các cột link */}
        {footerColumns.map((column) => (
          <div key={column.title}>
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-white">
              {column.title}
            </h3>
            <ul className="space-y-2.5 text-xs">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="transition hover:text-gold-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Hỗ trợ khách hàng */}
        <div>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-white">
            Hỗ trợ khách hàng
          </h3>
          <ul className="space-y-2.5 text-xs">
            <li className="flex items-center gap-1.5">
              <Phone className="size-3.5 text-brand-500" />
              Tổng đài miễn phí:
              <span className="font-bold text-white">{store.hotline}</span>
            </li>
            <li className="flex items-center gap-1.5">
              <Mail className="size-3.5 text-brand-500" />
              <a href={`mailto:${store.supportEmail}`} className="transition hover:text-gold-400">
                {store.supportEmail}
              </a>
            </li>
            {store.showroomAddress ? (
              <li className="flex items-start gap-1.5">
                <MapPin className="mt-px size-3.5 shrink-0 text-brand-500" />
                <span>Showroom: {store.showroomAddress}</span>
              </li>
            ) : null}
            <li>
              <Link href="/tra-cuu-don-hang" className="font-semibold text-gold-400 hover:underline">
                Tra cứu đơn hàng trực tuyến
              </Link>
            </li>
          </ul>
        </div>

        {/* Phương thức thanh toán đang dùng được */}
        <div>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-white">
            Thanh toán
          </h3>
          <ul className="flex flex-wrap gap-2">
            {paymentMethods.map((key) => (
              <li
                key={key}
                className="rounded-lg bg-ink-850 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 ring-1 ring-white/10"
              >
                {PAYMENT_LABELS[key]}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-5 text-[11px]">
          <p>© 2026 PCZONE High-End Systems. All rights reserved.</p>
          <p>
            Kiến tạo hệ sinh thái phần cứng AI chuyên biệt cho game thủ &amp;
            nhà phát triển.
          </p>
        </div>
      </div>
    </footer>
  );
}
