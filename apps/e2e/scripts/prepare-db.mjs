// Chuẩn bị DB kiểm thử trước khi bật API — KHÔNG xoá dữ liệu nào:
//   1. `prisma migrate deploy`: lần đầu tự tạo DB `pczone_e2e`, các lần sau chỉ áp migration mới (nếu có)
//   2. seed.ts: nạp/cập nhật dữ liệu mẫu (14 sản phẩm, tài khoản quản trị mẫu, mã giảm giá — KHÔNG tải ảnh). Chạy lại
//      bao nhiêu lần cũng được: upsert theo slug, đưa tồn kho sản phẩm mẫu về đúng số ban đầu
//   3. chuẩn hoá thông số linh kiện cho Build PC
// Dữ liệu các lượt chạy trước (khách e2e-…@example.com, đơn, đánh giá) được giữ lại — test nào cũng tự tạo dữ liệu riêng
// có dấu thời gian nên không phụ thuộc vào đó; Cài đặt hệ thống được đưa về mặc định ở `tests/reset-state.setup.ts`.
// Chạy ngay trong lệnh khởi động API của Playwright (playwright.config.ts) nên luôn xong TRƯỚC khi API mở cổng.
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.E2E_DATABASE_URL ?? "mysql://root:root@localhost:3306/pczone_e2e";
const dbName = new URL(url).pathname.replace(/^\//, "");
if (!dbName.endsWith("_e2e")) {
  // Chốt chặn: test tạo khách, đơn hàng, đánh giá thật — tuyệt đối không được ghi nhầm vào DB đang dùng
  console.error(`[e2e] Từ chối dùng DB "${dbName}": tên DB kiểm thử phải kết thúc bằng _e2e.`);
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const env = { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" };
const run = (command, cwd) => execSync(command, { cwd: path.join(repoRoot, cwd), env, stdio: ["ignore", "ignore", "inherit"] });

console.log(`[e2e] Chuẩn bị DB kiểm thử ${dbName}...`);
run("npx prisma migrate deploy", "packages/db");
run("npx tsx prisma/seed.ts", "packages/db");
run("npx tsx src/scripts/backfill-product-specs.mts", "apps/api");
console.log(`[e2e] DB ${dbName} đã sẵn sàng.`);
