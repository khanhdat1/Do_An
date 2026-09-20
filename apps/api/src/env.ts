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
};
