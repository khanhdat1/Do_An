import Link from "next/link";
import {
  BadgeCheck,
  Globe,
  PhoneCall,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";

import { topBarLinks } from "@/lib/data/navigation";

const linkIcons = {
  Store,
  ShieldCheck,
  BadgeCheck,
} as const;

/**
 * Thanh thông tin trên cùng: hotline, showroom, tra cứu bảo hành,
 * đăng nhập và chọn ngôn ngữ. Ẩn trên màn hình nhỏ.
 */
export default function TopBar() {
  return (
    <div className="hidden border-b border-white/5 bg-ink-950 lg:block">
      <div className="container-page flex h-9 items-center justify-between text-[11px] font-medium text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-slate-300">
            <PhoneCall className="size-3.5 text-brand-500" />
            Hotline:
            <span className="font-semibold text-gold-400">1800 8888</span>
            <span className="text-slate-500">(Miễn phí)</span>
          </span>

          {topBarLinks.map((item) => {
            const Icon = linkIcons[item.icon as keyof typeof linkIcons];
            return (
              <span
                key={item.href}
                className="flex items-center gap-3 border-l border-white/10 pl-4"
              >
                <Link
                  href={item.href}
                  className="flex items-center gap-1.5 transition hover:text-gold-400"
                >
                  {Icon ? <Icon className="size-3.5 text-brand-500" /> : null}
                  {item.label}
                </Link>
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/dang-nhap"
            className="flex items-center gap-1.5 transition hover:text-gold-400"
          >
            <UserRound className="size-3.5" />
            Đăng nhập / Đăng ký
          </Link>
          <span className="flex items-center gap-1.5 border-l border-white/10 pl-4">
            <Globe className="size-3.5" />
            VN | Bảng tin nhanh
          </span>
        </div>
      </div>
    </div>
  );
}
