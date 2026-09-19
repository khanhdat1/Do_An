import Link from "next/link";
import { BadgeCheck, Mail, Phone } from "lucide-react";
import Logo from "./Logo";
import { footerColumns } from "@/lib/data/navigation";

const paymentMethods = [
  "VISA",
  "Mastercard",
  "MoMo",
  "VNPay",
  "FE Credit",
  "HomeCredit",
];

/** Footer tối 5 cột: giới thiệu, về PCZone, chính sách, hỗ trợ, thanh toán. */
export default function Footer() {
  return (
    <footer className="mt-10 bg-ink-950 text-slate-400">
      <div className="container-page grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-5">
        {/* Cột giới thiệu */}
        <div className="lg:col-span-1">
          <Logo />
          <p className="mt-4 text-xs leading-relaxed">
            Hệ thống bán lẻ thiết bị Hi-End, laptop, linh kiện chính hãng tích
            hợp cố vấn phần cứng AI đầu tiên tại Việt Nam.
          </p>
          <p className="mt-4 text-[11px] text-gold-500">
            GPĐKKD: 0108888144 do Sở KH &amp; ĐT TP.HCM cấp
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
              <span className="font-bold text-white">1800 6868</span>
            </li>
            <li className="flex items-center gap-1.5">
              <BadgeCheck className="size-3.5 text-brand-500" />
              Kỹ thuật:
              <span className="font-bold text-gold-400">1900 8888</span>
            </li>
            <li className="flex items-center gap-1.5">
              <Mail className="size-3.5 text-brand-500" />
              support@pczone.vn
            </li>
            <li>
              <Link href="/tra-cuu-don-hang" className="font-semibold text-gold-400 hover:underline">
                Tra cứu đơn hàng trực tuyến
              </Link>
            </li>
          </ul>
        </div>

        {/* Thanh toán & chứng nhận */}
        <div>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-white">
            Thanh toán &amp; Chứng nhận
          </h3>
          <ul className="flex flex-wrap gap-2">
            {paymentMethods.map((method) => (
              <li
                key={method}
                className="rounded-lg bg-ink-850 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 ring-1 ring-white/10"
              >
                {method}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-ink-850 p-3 ring-1 ring-white/10">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-500">
              <BadgeCheck className="size-4.5 text-white" />
            </span>
            <span className="text-[10px] leading-tight">
              <span className="block font-bold uppercase text-white">
                Bộ Công Thương
              </span>
              Đã thông báo và đăng ký
            </span>
          </div>
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
