import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuildCheck, BuildSeverity } from "@/types";

const SEVERITY_STYLE: Record<BuildSeverity, { icon: typeof Info; className: string; iconClassName: string }> = {
  ERROR: { icon: CircleX, className: "bg-red-50 text-red-800", iconClassName: "text-red-600" },
  WARNING: { icon: TriangleAlert, className: "bg-amber-50 text-amber-900", iconClassName: "text-amber-600" },
  INFO: { icon: Info, className: "bg-slate-50 text-slate-600", iconClassName: "text-slate-400" },
  PASS: { icon: CircleCheck, className: "bg-emerald-50/70 text-emerald-900", iconClassName: "text-emerald-600" },
};

interface BuildCheckListProps {
  checks: BuildCheck[];
  pending: boolean;
}

export default function BuildCheckList({ checks, pending }: BuildCheckListProps) {
  return (
    <section className="surface-card p-4 sm:p-5" aria-labelledby="build-checks-title">
      <h2 id="build-checks-title" className="section-title text-base">
        Kiểm tra tương thích
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Kiểm tra theo thông số trong dữ liệu sản phẩm, bằng luật cố định (không dùng AI). Thiếu thông số thì báo
        &quot;chưa đủ dữ liệu&quot; — không bao giờ tự coi là tương thích.
      </p>

      <ul className={cn("mt-3 space-y-2 transition-opacity", pending && "opacity-60")} aria-live="polite">
        {checks.map((check) => {
          const style = SEVERITY_STYLE[check.severity];
          return (
            <li key={check.rule} className={cn("flex gap-2.5 rounded-lg px-3 py-2.5 text-sm leading-relaxed", style.className)}>
              <style.icon className={cn("mt-0.5 size-4 shrink-0", style.iconClassName)} aria-hidden />
              <p className="min-w-0">
                {check.message}
                {check.insufficientData ? (
                  <span className="ml-2 inline-block rounded bg-white/80 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                    Thiếu dữ liệu
                  </span>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
