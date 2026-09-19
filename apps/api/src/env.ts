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

export const env = {
  databaseUrl: required("DATABASE_URL"),
  port: Number(process.env.API_PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isDev: (process.env.NODE_ENV ?? "development") !== "production",

  /** Danh sách origin được phép gọi API, ngăn cách bằng dấu phẩy */
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
