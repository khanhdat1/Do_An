import Link from "next/link";
import { Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Kích thước chữ: header dùng "md", footer dùng "md", mobile dùng "sm" */
  size?: "sm" | "md";
}

/**
 * Logo PCZone: icon bánh răng cam + chữ "PC" trắng, "ZONE" vàng,
 * dòng nhỏ "POWERED GEAR" bên dưới.
 */
export default function Logo({ className, size = "md" }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn("group flex shrink-0 items-center gap-2.5", className)}
      aria-label="PCZone - Trang chủ"
    >
      <span className="grid size-10 place-items-center rounded-lg bg-brand-500/15 ring-1 ring-brand-500/40 transition group-hover:bg-brand-500/25">
        <Cpu className="size-5 text-brand-500" strokeWidth={2.4} />
      </span>
      <span className="leading-none">
        <span
          className={cn(
            "block font-display font-extrabold tracking-tight text-white",
            size === "md" ? "text-2xl" : "text-xl",
          )}
        >
          PC<span className="text-gold-400">ZONE</span>
        </span>
        <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.32em] text-slate-400">
          Powered Gear
        </span>
      </span>
    </Link>
  );
}
