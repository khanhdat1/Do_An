import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/data/orders";
import { cn } from "@/lib/utils";
import type { OrderStatus, Tone } from "@/types";

const TONE_CLASS: Record<Tone, string> = {
  amber: "bg-gold-400/15 text-gold-700",
  green: "bg-emerald-50 text-emerald-700",
  blue: "bg-blue-50 text-blue-700",
  red: "bg-sale-500/10 text-sale-700",
  slate: "bg-slate-100 text-slate-600",
};

export default function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold",
        TONE_CLASS[ORDER_STATUS_TONE[status]],
        className,
      )}
    >
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}
