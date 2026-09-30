/**
 * Chuyển khoản ngân hàng / MoMo — KHÔNG phải cổng thanh toán, không chữ ký, không callback tự động.
 * Khách tự chuyển tiền (quét QR hoặc theo số điện thoại), đơn nằm ở `paymentStatus: PENDING` cho tới
 * khi nhân viên xác nhận tay ở `/admin/orders` (xem `admin-order.service.ts`). Thiếu cấu hình thì
 * `isBankTransferConfigured`/`isMomoConfigured` trả `false`, trang đặt hàng ẩn phương thức tương ứng.
 * Đơn COD cũng được ghi nhận tay (nhân viên giao hàng thu tiền lúc giao) — xem `manualPaymentBlockReason`.
 *
 * Cùng nguyên tắc với `vnpay.service.ts`: không đọc `env` trực tiếp, nhận cấu hình qua tham số.
 */

export interface BankTransferConfig {
  bankId?: string;
  accountNumber?: string;
  accountName?: string;
  bankName?: string;
}

export interface MomoConfig {
  phone?: string;
  displayName?: string;
}

export function isBankTransferConfigured(
  config: BankTransferConfig,
): config is Required<BankTransferConfig> {
  return Boolean(config.bankId && config.accountNumber && config.accountName && config.bankName);
}

export function isMomoConfigured(config: MomoConfig): config is Required<MomoConfig> {
  return Boolean(config.phone && config.displayName);
}

/**
 * URL ảnh mã QR VietQR (dịch vụ công khai của NAPAS, không cần khoá) đã điền sẵn đúng số tiền + nội
 * dung chuyển khoản — khách quét là app ngân hàng tự điền hết, không phải gõ tay. Xem vietqr.io.
 */
export function buildBankQrUrl(
  config: Required<BankTransferConfig>,
  input: { amount: number; addInfo: string },
): string {
  const params = new URLSearchParams({
    amount: String(Math.round(input.amount)),
    addInfo: input.addInfo,
    accountName: config.accountName,
  });
  return `https://img.vietqr.io/image/${encodeURIComponent(config.bankId)}-${encodeURIComponent(config.accountNumber)}-compact2.png?${params.toString()}`;
}

/** Phần của đơn cần để quyết định nhân viên có được ghi nhận tiền tay hay không (khớp các enum trong schema) */
export interface ManualPaymentOrder {
  paymentMethod: "COD" | "VNPAY" | "BANK_TRANSFER" | "MOMO";
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "CANCELLED";
  status: "PENDING" | "CONFIRMED" | "PACKING" | "SHIPPING" | "DELIVERED" | "CANCELLED" | "RETURNED";
}

/**
 * Lý do KHÔNG được ghi nhận tiền tay (`null` = được) — dùng chung cho API (chặn, báo đúng lý do) và DTO quản trị
 * (`canConfirmPayment`, quyết định có hiện nút):
 * - Chuyển khoản / MoMo: khách tự chuyển, tiền về lúc nào xác nhận lúc đó — kể cả khi đơn đã đổi trạng thái (vẫn
 *   ghi nhận để đối soát, không hồi sinh đơn).
 * - COD: nhân viên giao hàng thu tiền lúc giao, nên chỉ ghi nhận khi đơn đang giao hoặc đã giao.
 * - VNPay: cổng tự báo kết quả qua IPN, không xác nhận tay.
 */
export function manualPaymentBlockReason(order: ManualPaymentOrder): string | null {
  if (order.paymentStatus !== "PENDING") return "Đơn hàng này đã được xử lý thanh toán rồi";
  switch (order.paymentMethod) {
    case "BANK_TRANSFER":
    case "MOMO":
      return null;
    case "COD":
      return order.status === "SHIPPING" || order.status === "DELIVERED"
        ? null
        : "Đơn COD chỉ ghi nhận đã thu tiền khi đơn đang giao hoặc đã giao";
    default:
      return "Đơn VNPay do cổng thanh toán tự xác nhận, không ghi nhận tay";
  }
}
