/**
 * Kiểm thử chặn mật khẩu quản trị mặc định và JWT_SECRET mẫu (`default-admin.ts`). Hàm thuần, không cần DB.
 * Chạy: npx tsx src/utils/default-admin.test.ts
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDefaultAdminLoginBlocked, isExampleJwtSecret, isKnownDefaultAdminPassword } from "./default-admin.js";

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}\n      mong đợi: ${e}\n      nhận được: ${a}`);
    failed++;
  }
}

console.log("\n[1] Mật khẩu quản trị mặc định");
{
  check("admin123 là mật khẩu mặc định", isKnownDefaultAdminPassword("admin123"), true);
  check("so khớp nguyên văn, không cắt khoảng trắng", isKnownDefaultAdminPassword(" admin123"), false);
  check("mật khẩu khác thì không", isKnownDefaultAdminPassword("MatKhauManh123"), false);
  check("bản chạy thật: chặn đăng nhập bằng admin123", isDefaultAdminLoginBlocked(true, "admin123"), true);
  check("bản chạy thật: mật khẩu khác vẫn đăng nhập được", isDefaultAdminLoginBlocked(true, "MatKhauManh123"), false);
  check("bản dev: chỉ cảnh báo, không chặn", isDefaultAdminLoginBlocked(false, "admin123"), false);
}

console.log("\n[2] JWT_SECRET mẫu");
{
  check("giá trị mẫu bị nhận ra", isExampleJwtSecret("thay-bang-chuoi-ngau-nhien-dai-it-nhat-32-ky-tu"), true);
  check("bỏ qua khoảng trắng hai đầu", isExampleJwtSecret("  thay-bang-chuoi-ngau-nhien-dai-it-nhat-32-ky-tu "), true);
  check("khoá ngẫu nhiên thật thì không", isExampleJwtSecret("k3Jx9vQ2mN8pL5rT7wY1zA4bC6dE0fG2hJ4kM6nP8qR"), false);

  // Giá trị mẫu thật sự nằm trong .env.example: đổi file mẫu mà quên danh sách chặn thì test này báo
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const example = readFileSync(resolve(root, ".env.example"), "utf8");
  const sample = /^JWT_SECRET="?([^"\n]*)"?/m.exec(example)?.[1] ?? "";
  check(".env.example dùng đúng giá trị nằm trong danh sách chặn", isExampleJwtSecret(sample), true);
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
