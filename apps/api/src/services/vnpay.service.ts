import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Tích hợp VNPay Sandbox (phương thức "Thanh toán qua cổng VNPAYQR" — vpcpay).
 * Chỉ cần hai khoá `VNPAY_TMN_CODE` / `VNPAY_HASH_SECRET` (README mục 9); thiếu thì
 * {@link isVnpayConfigured} trả `false`, trang đặt hàng ẩn phương thức này, COD vẫn hoạt động.
 *
 * File này CHỦ ĐỘNG không đọc `env` trực tiếp — mọi hàm nhận cấu hình qua tham số, để kiểm thử được
 * bằng khoá giả (xem `vnpay.test.ts`) mà không cần đặt biến môi trường thật. Nơi gọi thật (routes/
 * order.service) tự truyền `env.vnpay` vào.
 *
 * Thuật toán ký đúng theo tài liệu chính thức của VNPay: nối các tham số `vnp_*` đã sắp xếp theo
 * tên (trừ chính `vnp_SecureHash`), mã hoá từng giá trị bằng `encodeURIComponent` rồi đổi "%20"
 * thành "+", nối thành `key=value&key=value...`, rồi HMAC-SHA512 chuỗi đó bằng hash secret.
 * Dùng lại đúng một hàm mã hoá/sắp xếp cho cả lúc dựng URL thanh toán lẫn lúc xác minh dữ liệu
 * VNPay gửi về (return/IPN) để hai bên luôn tính ra cùng một chữ ký.
 */

export interface VnpayConfig {
  tmnCode?: string;
  hashSecret?: string;
  payUrl: string;
  returnUrl: string;
}

export function isVnpayConfigured(config: Pick<VnpayConfig, "tmnCode" | "hashSecret">): boolean {
  return Boolean(config.tmnCode && config.hashSecret);
}

function vnpEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

/** Chuỗi cần ký: các cặp `key=value` đã mã hoá, sắp xếp theo `key`, nối bằng "&" */
function signData(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${vnpEncode(params[key])}`)
    .join("&");
}

/**
 * Chữ ký HMAC-SHA512 của một bộ tham số `vnp_*` (không gồm `vnp_SecureHash`) — lõi dùng chung cho cả
 * lúc dựng URL thanh toán lẫn lúc xác minh return/IPN, và cho kiểm thử tự dựng một "phản hồi VNPay"
 * hợp lệ mà không cần gọi VNPay thật (xem `vnpay.test.ts`).
 */
export function signVnpayParams(hashSecret: string, params: Record<string, string>): string {
  return createHmac("sha512", hashSecret).update(Buffer.from(signData(params), "utf-8")).digest("hex");
}

/** "20260922153000" — giờ Việt Nam (UTC+7) viết liền, không phụ thuộc múi giờ máy chủ chạy API */
function vnpTimestamp(date: Date): string {
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${shifted.getUTCFullYear()}${pad(shifted.getUTCMonth() + 1)}${pad(shifted.getUTCDate())}` +
    `${pad(shifted.getUTCHours())}${pad(shifted.getUTCMinutes())}${pad(shifted.getUTCSeconds())}`
  );
}

/**
 * `vnp_OrderInfo` đi qua nhiều lớp mã hoá/giải mã (trình duyệt, VNPay, ngân hàng); một số ngân hàng
 * thành viên từng hiển thị sai hoặc làm lệch chữ ký với chữ có dấu. Bỏ dấu cho chắc — đây chỉ là dòng
 * diễn giải trên sao kê, không phải dữ liệu nghiệp vụ.
 */
export function foldAscii(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export interface BuildPaymentUrlInput {
  /** Payment.id — dùng làm vnp_TxnRef, duy nhất cho từng LẦN thử thanh toán của một đơn */
  paymentId: string;
  /** VNĐ, đã tính đủ subtotal + shippingFee - discount */
  amount: number;
  orderCode: string;
  /** IP của khách, chỉ để ghi nhận */
  ip: string;
  now?: Date;
}

/** Dựng URL chuyển khách sang cổng thanh toán VNPay. Ném lỗi nếu chưa cấu hình — gọi {@link isVnpayConfigured} trước. */
export function buildPaymentUrl(config: VnpayConfig, input: BuildPaymentUrlInput): string {
  if (!config.tmnCode || !config.hashSecret) {
    throw new Error("VNPay chưa được cấu hình (thiếu VNPAY_TMN_CODE / VNPAY_HASH_SECRET)");
  }

  const now = input.now ?? new Date();
  const expireAt = new Date(now.getTime() + 15 * 60 * 1000);

  const params: Record<string, string> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: config.tmnCode,
    vnp_Locale: "vn",
    vnp_CurrCode: "VND",
    vnp_TxnRef: input.paymentId,
    vnp_OrderInfo: foldAscii(`Thanh toan don hang ${input.orderCode}`),
    vnp_OrderType: "other",
    // VNPay quy định số tiền nhân 100 (không có phần thập phân)
    vnp_Amount: String(Math.round(input.amount) * 100),
    vnp_ReturnUrl: config.returnUrl,
    vnp_IpAddr: input.ip,
    vnp_CreateDate: vnpTimestamp(now),
    vnp_ExpireDate: vnpTimestamp(expireAt),
  };

  const secureHash = signVnpayParams(config.hashSecret, params);
  return `${config.payUrl}?${signData(params)}&vnp_SecureHash=${secureHash}`;
}

export interface VerifiedCallback {
  /** Chữ ký khớp — CHỈ tin `success` / số tiền khi cờ này true */
  signatureValid: boolean;
  paymentId?: string;
  /** vnp_ResponseCode === "00" */
  success: boolean;
  responseCode?: string;
  /** VNĐ, đã chia lại 100 */
  amount?: number;
  transactionNo?: string;
  bankCode?: string;
  raw: Record<string, string>;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length > 0 && bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Kiểm tra dữ liệu VNPay gửi về (dùng chung cho cả trang `return` trình duyệt và `IPN` server-to-server:
 * hai bên cùng một tập tham số, chỉ khác nơi gọi tới). `query` là `req.query` của Express, có thể chứa
 * giá trị không phải chuỗi (mảng, undefined) — chỉ những khoá `vnp_*` dạng chuỗi mới được xét.
 */
export function verifyCallback(hashSecret: string | undefined, query: Record<string, unknown>): VerifiedCallback {
  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith("vnp_") && typeof value === "string") raw[key] = value;
  }

  const receivedHash = raw.vnp_SecureHash;
  const toVerify = { ...raw };
  delete toVerify.vnp_SecureHash;
  delete toVerify.vnp_SecureHashType;

  const signatureValid = Boolean(
    hashSecret && receivedHash && timingSafeEqualHex(receivedHash, signVnpayParams(hashSecret, toVerify)),
  );

  return {
    signatureValid,
    paymentId: raw.vnp_TxnRef,
    success: raw.vnp_ResponseCode === "00",
    responseCode: raw.vnp_ResponseCode,
    amount: raw.vnp_Amount ? Number(raw.vnp_Amount) / 100 : undefined,
    transactionNo: raw.vnp_TransactionNo,
    bankCode: raw.vnp_BankCode,
    raw,
  };
}

/** Các mã lỗi phổ biến của VNPay Sandbox — dùng hiện thông báo dễ hiểu thay vì trần mã số */
const RESPONSE_MESSAGES: Record<string, string> = {
  "00": "Giao dịch thành công",
  "07": "Giao dịch bị nghi ngờ gian lận",
  "09": "Tài khoản chưa đăng ký InternetBanking tại ngân hàng",
  "10": "Xác thực thông tin sai quá 3 lần",
  "11": "Đã hết hạn chờ thanh toán",
  "12": "Tài khoản/thẻ bị khoá",
  "13": "Sai mật khẩu xác thực giao dịch (OTP)",
  "24": "Bạn đã huỷ giao dịch",
  "51": "Tài khoản không đủ số dư",
  "65": "Tài khoản đã vượt hạn mức giao dịch trong ngày",
  "75": "Ngân hàng thanh toán đang bảo trì",
  "79": "Sai mật khẩu thanh toán quá số lần quy định",
};

export function vnpayMessage(responseCode: string | undefined): string {
  return (responseCode && RESPONSE_MESSAGES[responseCode]) || "Giao dịch không thành công";
}
