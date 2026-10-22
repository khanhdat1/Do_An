import type { PaymentMethod, Prisma } from "@pczone/db";

/**
 * Phần thuần (không DB, không đọc env) của việc tự huỷ đơn chuyển khoản/MoMo/VNPay quá hạn thanh toán — xem
 * `services/unpaid-order.service.ts`. Tách riêng để kiểm thử không cần DB.
 */

export const DEFAULT_UNPAID_ORDER_TIMEOUT_HOURS = 24;

/**
 * Mọi phương thức trả tiền TRƯỚC khi giao: chuyển khoản/MoMo (khách tự chuyển, chờ nhân viên xác nhận tay) và VNPay
 * (khách bỏ dở ở cổng, không bấm "Thanh toán lại"). COD trả tiền lúc nhận hàng nên "chưa thanh toán" là bình thường —
 * không đụng tới. IPN VNPay về muộn đúng lúc đơn bị huỷ vẫn an toàn: `applyVnpayCallback` cũng ghi có điều kiện, đơn
 * đã huỷ thì chỉ ghi nhận đã có tiền để đối soát chứ không hồi sinh.
 */
export const AUTO_CANCEL_PAYMENT_METHODS = ["BANK_TRANSFER", "MOMO", "VNPAY"] as const satisfies readonly PaymentMethod[];

const METHOD_LABEL: Record<(typeof AUTO_CANCEL_PAYMENT_METHODS)[number], string> = {
  BANK_TRANSFER: "chuyển khoản ngân hàng",
  MOMO: "chuyển khoản MoMo",
  VNPAY: "qua VNPay",
};

/**
 * Đọc `UNPAID_ORDER_TIMEOUT_HOURS`: để trống → 24 giờ; `0` → tắt hẳn việc tự huỷ (trả `null`); số dương bất kỳ,
 * kể cả số lẻ (`0.5` = 30 phút). Giá trị sai (chữ, số âm) thì dùng mặc định thay vì làm sập API lúc khởi động.
 */
export function parseUnpaidOrderTimeoutHours(raw: string | undefined): number | null {
  const value = raw?.trim();
  if (!value) return DEFAULT_UNPAID_ORDER_TIMEOUT_HOURS;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0) return DEFAULT_UNPAID_ORDER_TIMEOUT_HOURS;
  return hours === 0 ? null : hours;
}

/**
 * Điều kiện lọc đơn quá hạn: còn chờ xác nhận, chưa thanh toán, đúng phương thức, tạo trước `now - timeoutHours` — và
 * không có lượt thanh toán nào tạo sau mốc đó: khách bấm "Thanh toán lại" VNPay (lượt mới, link VNPay hết hạn sau 15
 * phút) thì tính hạn lại từ lượt mới nhất, không huỷ đơn ngay lúc khách đang ở trang VNPay. Chuyển khoản/MoMo chỉ có
 * một lượt tạo cùng lúc với đơn nên điều kiện này không đổi gì.
 */
export function staleUnpaidOrderWhere(now: Date, timeoutHours: number): Prisma.OrderWhereInput {
  const cutoff = new Date(now.getTime() - timeoutHours * 3_600_000);
  return {
    status: "PENDING",
    paymentStatus: "PENDING",
    paymentMethod: { in: [...AUTO_CANCEL_PAYMENT_METHODS] },
    createdAt: { lt: cutoff },
    payments: { none: { createdAt: { gte: cutoff } } },
  };
}

/** Thời hạn để hiển thị cho khách: số giờ chẵn → "24 giờ", số lẻ đổi ra phút → "90 phút" */
export function formatTimeout(hours: number): string {
  return Number.isInteger(hours) ? `${hours} giờ` : `${Math.round(hours * 60)} phút`;
}

/** Lý do huỷ (lưu `cancelReason`, khách thấy) và ghi chú lịch sử — nói rõ là hệ thống tự huỷ và vì sao */
export function autoCancelReason(method: PaymentMethod, timeoutHours: number): string {
  const label = METHOD_LABEL[method as keyof typeof METHOD_LABEL] ?? "chuyển khoản";
  const paid = method === "VNPAY" ? "Nếu bạn đã thanh toán" : "Nếu bạn đã chuyển tiền";
  return (
    `Hệ thống tự huỷ: quá ${formatTimeout(timeoutHours)} chưa nhận được thanh toán ${label}. ` +
    `${paid}, vui lòng liên hệ cửa hàng để được đối soát và hoàn tiền.`
  );
}
