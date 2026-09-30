import { Check, X } from "lucide-react";
import { ORDER_STATUS_LABEL, ORDER_STEPS } from "@/lib/data/orders";
import { cn } from "@/lib/utils";
import type { OrderStatus, OrderStatusEvent } from "@/types";

/** Nhãn ngắn cho 5 bước — vừa một dòng trên màn hình điện thoại */
const STEP_LABEL: Partial<Record<OrderStatus, string>> = {
  PENDING: "Đặt hàng",
  CONFIRMED: "Xác nhận",
  PACKING: "Đóng gói",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
};

type StepState = "done" | "current" | "todo" | "stopped";

/** "22/9 · 15:04" */
function formatStepTime(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()}/${date.getMonth() + 1} · ${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

interface OrderProgressProps {
  status: OrderStatus;
  /** Lịch sử trạng thái (trang chi tiết): cho thời điểm từng bước và bước cuối cùng trước khi huỷ/hoàn */
  history?: OrderStatusEvent[];
  size?: "sm" | "md";
  className?: string;
}

/**
 * Tiến trình đơn 5 bước nằm ngang: Đặt hàng → Xác nhận → Đóng gói → Đang giao → Đã giao. Chỉ vẽ từ trạng thái THẬT
 * (và lịch sử thật nếu có) — không có bước giả kiểu "tài xế đang tới". Đơn huỷ/hoàn trả: tô các bước đã qua, đánh
 * dấu đỏ ở bước bị dừng. Không có lịch sử (danh sách đơn) thì không biết đơn huỷ ở bước nào — trả null, huy hiệu
 * trạng thái bên cạnh đã ghi rõ "Đã huỷ".
 */
export default function OrderProgress({ status, history, size = "md", className }: OrderProgressProps) {
  const terminal = status === "CANCELLED" || status === "RETURNED";
  if (terminal && !history) return null;

  const firstTimeOf = (step: OrderStatus) => history?.find((event) => event.status === step)?.createdAt;
  const reachedIndex = terminal
    ? Math.max(0, ...(history ?? []).map((event) => ORDER_STEPS.indexOf(event.status)).filter((index) => index >= 0))
    : ORDER_STEPS.indexOf(status);
  // Huỷ/hoàn khi chưa tới bước cuối: dấu dừng nằm ngay bước kế tiếp; hoàn trả SAU khi đã giao thì ghi chú bên dưới
  const stoppedIndex = terminal && reachedIndex < ORDER_STEPS.length - 1 ? reachedIndex + 1 : null;

  const stateOf = (index: number): StepState => {
    if (index === stoppedIndex) return "stopped";
    if (index < reachedIndex) return "done";
    if (index === reachedIndex) return terminal || status === "DELIVERED" ? "done" : "current";
    return "todo";
  };

  const small = size === "sm";
  const circle = small ? "size-5" : "size-7";
  const icon = small ? "size-3" : "size-4";

  return (
    <div className={className}>
      <ol className="flex items-start" aria-label={`Tiến trình đơn hàng: ${ORDER_STATUS_LABEL[status]}`}>
        {ORDER_STEPS.map((step, index) => {
          const state = stateOf(index);
          const time = !small && state !== "todo" && state !== "stopped" ? firstTimeOf(step) : undefined;
          const lineDone = index <= reachedIndex;
          return (
            <li key={step} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
              {index > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute right-1/2 h-0.5 w-full -translate-y-1/2",
                    small ? "top-2.5" : "top-3.5",
                    lineDone ? "bg-emerald-500" : "bg-slate-200",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 grid shrink-0 place-items-center rounded-full ring-4 ring-white",
                  circle,
                  state === "done" && "bg-emerald-500 text-white",
                  state === "current" && "bg-brand-500 text-white",
                  state === "todo" && "bg-slate-100 text-slate-300",
                  state === "stopped" && "bg-sale-500 text-white",
                )}
              >
                {state === "stopped" ? <X className={icon} strokeWidth={3} /> : state === "todo" ? null : <Check className={icon} strokeWidth={3} />}
                {state === "current" ? <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/30" aria-hidden /> : null}
              </span>
              <span
                className={cn(
                  "mt-1.5 max-w-full truncate px-0.5 font-semibold",
                  small ? "text-[10px]" : "text-[11px] sm:text-xs",
                  state === "todo" ? "text-slate-500" : state === "stopped" ? "text-sale-600" : state === "current" ? "text-brand-600" : "text-slate-700",
                )}
              >
                {state === "stopped" ? ORDER_STATUS_LABEL[status] : (STEP_LABEL[step] ?? ORDER_STATUS_LABEL[step])}
              </span>
              {time ? <span className="mt-0.5 text-[10px] text-slate-500">{formatStepTime(time)}</span> : null}
              <span className="sr-only">
                {state === "done" ? "đã xong" : state === "current" ? "đang ở bước này" : state === "stopped" ? "đơn dừng ở đây" : "chưa tới"}
              </span>
            </li>
          );
        })}
      </ol>
      {terminal && stoppedIndex === null ? (
        <p className="mt-2 text-center text-xs font-semibold text-sale-600">Đơn đã giao rồi được hoàn trả</p>
      ) : null}
    </div>
  );
}
