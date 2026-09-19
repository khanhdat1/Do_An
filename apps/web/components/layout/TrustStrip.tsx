import { Crown, ShieldCheck, Zap } from "lucide-react";

/**
 * Dải thông tin nằm ngay dưới header: định vị thương hiệu + 2 cam kết dịch vụ.
 */
export default function TrustStrip() {
  return (
    <div className="container-page pt-4">
      <div className="surface-card flex flex-wrap items-center justify-between gap-y-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-md bg-gold-400/15 px-2 py-1 text-gold-600 ring-1 ring-gold-400/40">
            <Crown className="size-3.5" />
            PCZone VIP
          </span>
          <span className="text-slate-500">
            <span className="mr-2 text-slate-300">/</span>
            Hệ sinh thái phần cứng Hi-End &amp; cố vấn AI tiên phong
          </span>
        </div>

        <div className="flex items-center gap-4 text-slate-600">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            Bảo hành On-site tại nhà 24/7
          </span>
          <span className="hidden h-3.5 w-px bg-slate-200 sm:block" />
          <span className="hidden items-center gap-1.5 sm:flex">
            <Zap className="size-3.5 text-blue-500" />
            Giao hàng hỏa tốc 2H toàn quốc
          </span>
        </div>
      </div>
    </div>
  );
}
