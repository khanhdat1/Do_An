import { prisma } from "@pczone/db";
import { createApp } from "./app.js";
import { env } from "./env.js";
import { getProvider, isConfigured, redirectUri } from "./services/oauth.providers.js";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`\n  PCZone API đang chạy: http://localhost:${env.port}`);
  console.log(`  Kiểm tra nhanh:       http://localhost:${env.port}/health`);
  console.log(`  Cho phép origin:      ${env.corsOrigins.join(", ")}`);

  // In trạng thái đăng nhập mạng xã hội để thấy ngay đã điền khoá đúng chưa
  for (const key of ["google", "facebook"] as const) {
    const provider = getProvider(key);
    if (!provider) continue;
    const label = `Đăng nhập ${provider.label}:`.padEnd(22);
    console.log(
      isConfigured(provider)
        ? `  ${label}đã bật — callback cần khai: ${redirectUri(provider)}`
        : `  ${label}chưa cấu hình (xem README mục 8)`,
    );
  }
  console.log("");
});

/** Đóng kết nối gọn gàng khi dừng bằng Ctrl+C hoặc khi container bị kill */
async function shutdown(signal: string) {
  console.log(`\nNhận ${signal}, đang đóng API...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
