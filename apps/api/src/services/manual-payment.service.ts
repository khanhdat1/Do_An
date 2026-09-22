/**
 * Chuyển khoản ngân hàng / MoMo — KHÔNG phải cổng thanh toán, không chữ ký, không callback tự động.
 * Khách tự chuyển tiền (quét QR hoặc theo số điện thoại), đơn nằm ở `paymentStatus: PENDING` cho tới
 * khi nhân viên xác nhận tay ở `/quan-tri/don-hang` (xem `admin-order.service.ts`). Thiếu cấu hình thì
 * `isBankTransferConfigured`/`isMomoConfigured` trả `false`, trang đặt hàng ẩn phương thức tương ứng.
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
