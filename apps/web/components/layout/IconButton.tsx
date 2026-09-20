import Link from "next/link";
import { cn } from "@/lib/utils";

interface IconButtonProps {
  href: string;
  label: string;
  count?: number;
  className?: string;
  children: React.ReactNode;
}

/** Nút icon vuông bo góc có badge số lượng (wishlist, giỏ hàng) trên header */
export default function IconButton({
  href,
  label,
  count,
  className,
  children,
}: IconButtonProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "relative grid size-10 place-items-center rounded-xl bg-ink-800 text-slate-200 ring-1 ring-white/10 transition hover:text-gold-400 hover:ring-gold-400/50",
        className,
      )}
    >
      {children}
      {count ? (
        <span className="absolute -right-1 -top-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-sale-600 px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
