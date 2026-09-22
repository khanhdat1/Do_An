"use client";

import { Scale } from "lucide-react";
import { useCompare } from "@/components/providers/CompareProvider";
import { cn } from "@/lib/utils";

interface CompareButtonProps {
  slug: string;
  name: string;
  /**
   * "overlay": nút tròn nhỏ đè lên góc ảnh (ProductCard), dưới nút yêu thích.
   * "panel": nút vuông cùng hàng với "Thêm vào giỏ" (trang chi tiết).
   */
  variant?: "overlay" | "panel";
  className?: string;
}

/** Nút thêm/bỏ một sản phẩm khỏi danh sách so sánh (localStorage, không cần đăng nhập) */
export default function CompareButton({ slug, name, variant = "overlay", className }: CompareButtonProps) {
  const { slugs, toggle } = useCompare();
  const active = slugs.includes(slug);

  function handleClick(event: React.MouseEvent) {
    event.preventDefault(); // nút thường nằm trong <Link> bọc cả thẻ sản phẩm
    event.stopPropagation();
    toggle(slug);
  }

  const label = active ? `Bỏ "${name}" khỏi so sánh` : `Thêm "${name}" vào so sánh`;

  if (variant === "panel") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={active}
        aria-label={label}
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl border transition",
          active ? "border-brand-300 bg-brand-500/10 text-brand-600" : "border-slate-200 bg-white text-slate-400 hover:text-brand-500",
          className,
        )}
      >
        <Scale className="size-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "absolute right-2 top-11 z-10 grid size-8 place-items-center rounded-full bg-white/90 text-slate-400 shadow-sm ring-1 ring-slate-900/5 backdrop-blur transition hover:text-brand-500",
        active && "text-brand-600",
        className,
      )}
    >
      <Scale className="size-4" />
    </button>
  );
}
