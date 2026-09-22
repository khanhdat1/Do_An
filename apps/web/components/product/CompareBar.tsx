"use client";

import Link from "next/link";
import { Scale } from "lucide-react";
import { useCompare } from "@/components/providers/CompareProvider";
import { cn } from "@/lib/utils";

/** Thanh nổi ở đáy trang khi có sản phẩm đang chọn để so sánh — hiện toàn site (đặt trong layout gốc) */
export default function CompareBar() {
  const { slugs, clear } = useCompare();

  if (slugs.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="container-page flex flex-wrap items-center gap-3 py-3">
        <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
          <Scale className="size-4.5 text-brand-500" />
          Đang so sánh {slugs.length} sản phẩm
        </span>

        <button type="button" onClick={clear} className="text-xs font-semibold text-slate-500 hover:underline">
          Bỏ hết
        </button>

        <Link
          href="/so-sanh"
          aria-disabled={slugs.length < 2}
          className={cn(
            "ml-auto rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition",
            slugs.length < 2 ? "pointer-events-none bg-slate-300" : "bg-brand-500 hover:bg-brand-600",
          )}
        >
          {slugs.length < 2 ? "Chọn thêm để so sánh" : "So sánh ngay"}
        </Link>
      </div>
    </div>
  );
}
