import { cn } from "@/lib/utils";
import type { Tone } from "@/types";

/**
 * Huy hiệu trạng thái kiểu "subtle pill" (nền nhạt + chữ đậm màu + viền cùng tông) cho khu quản trị —
 * KHÔNG dùng chung với OrderStatusBadge/PaymentStatusBadge của khách hàng, để đổi giao diện admin
 * không ảnh hưởng trang bán hàng. Đọc cùng bảng `Tone` đã có (amber/green/blue/red/slate).
 */
const TONE_CLASS: Record<Tone, string> = {
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/15",
};

export default function AdminBadge({ tone, className, children }: { tone: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
