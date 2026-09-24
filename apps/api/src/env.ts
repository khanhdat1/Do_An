import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Nạp biến môi trường.
 *
 * File `.env` nằm ở thư mục gốc monorepo (dùng chung với Prisma và crawler),
 * nên phải trỏ đường dẫn tuyệt đối — `dotenv/config` mặc định chỉ đọc ở
 * thư mục đang chạy lệnh.
 */
const here = dirname(fileURLToPath(import.meta.url));
for (const candidate of [
  resolve(here, "../.env"), // apps/api/.env (nếu muốn ghi đè riêng)
  resolve(here, "../../../.env"), // .env ở gốc monorepo
]) {
  if (existsSync(candidate)) {
    loadEnv({ path: candidate });
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `\n✗ Thiếu biến môi trường ${name}.\n` +
        `  Copy file .env.example ở thư mục gốc thành .env rồi chạy lại.\n`,
    );
    process.exit(1);
  }
  return value;
}

/** Biến tuỳ chọn: chuỗi rỗng hoặc toàn dấu cách coi như chưa đặt */
function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/** Khoá bí mật quá ngắn thì JWT bị dò ra bằng brute-force, nên chặn ngay lúc khởi động */
function requiredSecret(name: string, minLength: number): string {
  const value = required(name);
  if (value.length < minLength) {
    console.error(
      `\n✗ ${name} quá ngắn (${value.length} ký tự, cần tối thiểu ${minLength}).\n` +
        `  Sinh khoá mới: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"\n`,
    );
    process.exit(1);
  }
  return value;
}

const port = Number(process.env.API_PORT ?? 4000);

const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  port,
  nodeEnv: process.env.NODE_ENV ?? "development",
  isDev: (process.env.NODE_ENV ?? "development") !== "production",

  /** Danh sách origin được phép gọi API, ngăn cách bằng dấu phẩy */
  corsOrigins,

  /** Khoá ký JWT access token (HS256) */
  jwtSecret: requiredSecret("JWT_SECRET", 32),

  /**
   * URL công khai của API. Dùng dựng "redirect URI" gửi cho Google / Facebook,
   * nên phải khớp từng ký tự với địa chỉ đã khai trong trang quản lý của họ.
   */
  apiPublicUrl: stripTrailingSlash(optional("API_PUBLIC_URL") ?? `http://localhost:${port}`),

  /** URL của web: nơi trình duyệt được đưa về sau khi đăng nhập bằng mạng xã hội */
  webUrl: stripTrailingSlash(optional("WEB_URL") ?? corsOrigins[0] ?? "http://localhost:3000"),

  /**
   * Đăng nhập Google / Facebook. Thiếu khoá thì nút tương ứng báo "chưa cấu hình",
   * các phần còn lại của API vẫn chạy bình thường.
   */
  oauth: {
    google: {
      clientId: optional("GOOGLE_CLIENT_ID"),
      clientSecret: optional("GOOGLE_CLIENT_SECRET"),
    },
    facebook: {
      clientId: optional("FACEBOOK_APP_ID"),
      clientSecret: optional("FACEBOOK_APP_SECRET"),
    },
    /** Chỉ dùng khi kiểm thử: trỏ mọi lời gọi OAuth vào một máy chủ giả thay vì Google / Facebook thật */
    mockUrl: optional("OAUTH_MOCK_URL"),
  },

  /**
   * Thanh toán VNPay Sandbox. Thiếu hai khoá thì phương thức VNPay báo "chưa cấu hình" ở
   * trang đặt hàng, COD vẫn hoạt động bình thường — cùng nguyên tắc với Google / Facebook.
   * Đăng ký tài khoản thử nghiệm miễn phí tại https://sandbox.vnpayment.vn để lấy
   * vnp_TmnCode và vnp_HashSecret của riêng bạn (README mục 9).
   */
  vnpay: {
    tmnCode: optional("VNPAY_TMN_CODE"),
    hashSecret: optional("VNPAY_HASH_SECRET"),
    payUrl: optional("VNPAY_PAY_URL") ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    /** VNPay chuyển trình duyệt về đây sau khi thanh toán; API xác minh chữ ký rồi mới đưa tiếp sang web */
    returnUrl: optional("VNPAY_RETURN_URL") ?? `${stripTrailingSlash(optional("API_PUBLIC_URL") ?? `http://localhost:${port}`)}/api/payments/vnpay/return`,
  },

  /**
   * Chuyển khoản ngân hàng thủ công: không qua cổng nào, chỉ hiện mã QR VietQR (miễn phí, không cần khoá)
   * đã điền sẵn đúng số tiền + mã đơn, khách tự chuyển rồi NHÂN VIÊN xác nhận tay ở trang quản trị —
   * xem `isPaymentMethodConfigured` (order.service.ts) và route `/api/admin/orders`.
   */
  bankTransfer: {
    bankId: optional("BANK_ID"), // BIN hoặc mã ngân hàng theo VietQR, vd "970436" (Vietcombank)
    accountNumber: optional("BANK_ACCOUNT_NUMBER"),
    accountName: optional("BANK_ACCOUNT_NAME"),
    bankName: optional("BANK_NAME"), // tên hiển thị cho khách, vd "Vietcombank"
  },

  /** Chuyển khoản thủ công qua ví MoMo (số điện thoại) — cùng nguyên tắc với bankTransfer ở trên */
  momo: {
    phone: optional("MOMO_PHONE"),
    displayName: optional("MOMO_DISPLAY_NAME"),
  },

  /**
   * Gửi email "quên mật khẩu" qua Resend (resend.com — miễn phí 100 email/ngày, không cần thẻ).
   * Thiếu khoá thì KHÔNG chặn tính năng — link đặt lại mật khẩu được in ra console server thay vì
   * gửi email thật, để luồng vẫn kiểm thử được khi chưa cấu hình (README mục 8).
   */
  email: {
    resendApiKey: optional("RESEND_API_KEY"),
    from: optional("EMAIL_FROM") ?? "PCZone <onboarding@resend.dev>",
  },

  /**
   * AI Search / AI Chat / AI Build PC — gọi qua gói `openai` (chuẩn "OpenAI-compatible", nhiều hãng
   * hỗ trợ, không chỉ OpenAI thật). Thiếu khoá thì AI Search tự lùi về đúng bộ tìm kiếm từ khoá đã
   * có (không hỏng gì); AI Chat/Build PC báo rõ "chưa cấu hình" thay vì giả vờ chạy được — khác
   * VNPay/email, đây CHÍNH LÀ tính năng chứ không phải tác dụng phụ.
   *
   * `OPENAI_BASE_URL` để TRỐNG thì gói `openai` tự dùng thẳng địa chỉ thật của OpenAI — cố ý KHÔNG
   * âm thầm mặc định sang hãng khác dù đang dùng Gemini (dự án này đang dùng gói miễn phí của Gemini
   * qua lớp tương thích OpenAI của họ, https://ai.google.dev/gemini-api/docs/openai): một biến tên
   * OPENAI_* mà lặng lẽ không gọi tới OpenAI sẽ gây bất ngờ khó chịu nếu sau này ai đó chỉ điền
   * OPENAI_API_KEY (khoá OpenAI thật) mà không để ý biến base URL — README mục "Tìm kiếm bằng AI"
   * ghi rõ giá trị cần điền cho từng hãng. Tên model cũng để biến môi trường, không hardcode.
   */
  ai: {
    openaiApiKey: optional("OPENAI_API_KEY"),
    baseUrl: optional("OPENAI_BASE_URL"),
    chatModel: optional("OPENAI_CHAT_MODEL") ?? "gemini-3.1-flash-lite",
    embeddingModel: optional("OPENAI_EMBEDDING_MODEL") ?? "gemini-embedding-2-preview",
  },
};
