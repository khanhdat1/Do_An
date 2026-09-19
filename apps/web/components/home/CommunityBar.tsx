import { Users } from "lucide-react";
import { formatNumber } from "@/lib/format";

/** Dải thống kê cộng đồng PCZone Hardware Hub. */
export default function CommunityBar() {
  return (
    <section className="container-page pt-6">
      <div className="surface-card flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink-900">
            <Users className="size-5 text-gold-400" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                Cộng đồng PCZone Hardware Hub
              </h3>
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-600 ring-1 ring-emerald-200">
                Active 24/7
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Nhập tài khoản để chia sẻ benchmark thực tế, nhận tư vấn tương
              thích linh kiện trực tiếp từ Master Overclockers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              Cấu hình đã lưu hôm nay
            </p>
            <p className="font-display text-lg font-bold text-slate-800">
              {formatNumber(1842)} builds
            </p>
          </div>
          <span className="h-9 w-px bg-slate-200" />
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              Độ chính xác AI
            </p>
            <p className="font-display text-lg font-bold text-sale-600">
              99,98%
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
