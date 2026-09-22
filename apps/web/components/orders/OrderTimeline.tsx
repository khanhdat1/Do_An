import { CircleCheck } from "lucide-react";
import { ORDER_STATUS_LABEL } from "@/lib/data/orders";
import { cn } from "@/lib/utils";
import type { OrderStatusEvent } from "@/types";

/** "22 thg 9, 2026 · 15:04" */
function formatEventTime(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString("vi-VN", { day: "numeric", month: "short", year: "numeric" })} · ${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Dòng thời gian đơn hàng — đọc thẳng lịch sử chuyển trạng thái thật từ API (từ cũ tới mới) */
export default function OrderTimeline({ events }: { events: OrderStatusEvent[] }) {
  return (
    <ol className="space-y-0">
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        return (
          <li key={`${event.status}-${event.createdAt}`} className="relative flex gap-3 pb-5 last:pb-0">
            {isLast ? null : <span className="absolute left-[7px] top-4 h-full w-px bg-slate-200" aria-hidden="true" />}
            <span
              className={cn(
                "relative z-10 mt-1 grid size-4 shrink-0 place-items-center rounded-full",
                isLast ? "bg-brand-500 text-white" : "bg-emerald-500 text-white",
              )}
            >
              <CircleCheck className="size-4" />
            </span>
            <div className="min-w-0 pb-0.5">
              <p className="text-sm font-semibold text-slate-800">{ORDER_STATUS_LABEL[event.status]}</p>
              {event.note ? <p className="mt-0.5 text-xs text-slate-500">{event.note}</p> : null}
              <p className="mt-0.5 text-xs text-slate-400">{formatEventTime(event.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
