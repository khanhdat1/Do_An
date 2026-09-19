import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  /** Icon nhỏ đứng trước tiêu đề */
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Nhãn nhỏ cạnh tiêu đề: "Tuyển chọn", "Cập nhật hôm nay"... */
  badge?: { label: string; tone?: "amber" | "green" };
  /** Link "Xem tất cả" bên phải */
  href?: string;
  /** Nội dung tự do bên phải (thay cho link) */
  aside?: React.ReactNode;
  className?: string;
}

const badgeTones = {
  amber: "bg-gold-400/15 text-gold-600 ring-gold-400/40",
  green: "bg-emerald-50 text-emerald-600 ring-emerald-200",
};

/** Tiêu đề chuẩn dùng lại cho mọi section của trang chủ. */
export default function SectionHeading({
  icon,
  title,
  subtitle,
  badge,
  href,
  aside,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2",
        className,
      )}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          {icon}
          <h2 className="section-title text-xl sm:text-2xl">{title}</h2>
          {badge ? (
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1",
                badgeTones[badge.tone ?? "amber"],
              )}
            >
              {badge.label}
            </span>
          ) : null}
        </div>
        {subtitle ? (
          <p className="mt-1.5 text-xs text-slate-500 sm:text-sm">{subtitle}</p>
        ) : null}
      </div>

      {aside}

      {href && !aside ? (
        <Link
          href={href}
          className="group flex items-center gap-1.5 text-xs font-semibold text-blue-600 transition hover:text-blue-700 sm:text-sm"
        >
          Xem tất cả
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}
