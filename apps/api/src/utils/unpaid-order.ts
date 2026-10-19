import type { PaymentMethod, Prisma } from "@pczone/db";

/**
 * Phần thuần (không DB, không đọc env) của việc tự huỷ đơn chuyển khoản/MoMo quá hạn thanh toán — xem
 * `services/unpaid-order.service.ts`. Tách riêng để kiểm thử không cần DB.
 */

export const DEFAULT_UNPAID_ORDER_TIMEOUT_HOURS = 24;

/**
 * Chỉ hai phương thức khách TỰ chuyển tiền rồi chờ nhân viên xác nhận tay mới bị tự huỷ: COD trả tiền lúc nhận hàng
 * nên "chưa thanh toán" là bình thường; VNPay có nút "Thanh toán lại" và IPN có thể về muộn — không đụng tới.
 */
export const AUTO_CANCEL_PAYMENT_METHODS = ["BANK_TRANSFER", "MOMO"] as const satisfies readonly PaymentMethod[];

const METHOD_LABEL: Record<(typeof AUTO_CANCEL_PAYMENT_METHODS)[number], string> = {
  BANK_TRANSFER: "chuyển khoản ngân hàng",
  MOMO: "chuyển khoản MoMo",
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

/** Điều kiện lọc đơn quá hạn: còn chờ xác nhận, chưa thanh toán, đúng phương thức, tạo trước `now - timeoutHours` */
export function staleUnpaidOrderWhere(now: Date, timeoutHours: number): Prisma.OrderWhereInput {
  return {
    status: "PENDING",
    paymentStatus: "PENDING",
    paymentMethod: { in: [...AUTO_CANCEL_PAYMENT_METHODS] },
    createdAt: { lt: new Date(now.getTime() - timeoutHours * 3_600_000) },
  };
}

/** Thời hạn để hiển thị cho khách: số giờ chẵn → "24 giờ", số lẻ đổi ra phút → "90 phút" */
export function formatTimeout(hours: number): string {
  return Number.isInteger(hours) ? `${hours} giờ` : `${Math.round(hours * 60)} phút`;
}

/** Lý do huỷ (lưu `cancelReason`, khách thấy) và ghi chú lịch sử — nói rõ là hệ thống tự huỷ và vì sao */
export function autoCancelReason(method: PaymentMethod, timeoutHours: number): string {
  const label = METHOD_LABEL[method as keyof typeof METHOD_LABEL] ?? "chuyển khoản";
  return (
    `Hệ thống tự huỷ: quá ${formatTimeout(timeoutHours)} chưa nhận được thanh toán ${label}. ` +
    "Nếu bạn đã chuyển tiền, vui lòng liên hệ cửa hàng để được đối soát và hoàn tiền."
  );
}
