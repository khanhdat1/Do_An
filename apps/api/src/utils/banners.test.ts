/**
 * Kiểm thử liên kết banner (`isSafeBannerLink`): chỉ nhận đường dẫn nội bộ bắt đầu bằng "/" hoặc địa chỉ http(s) đầy
 * đủ; chặn `javascript:`/`data:` và các dạng trình duyệt hiểu thành sang trang khác. Hàm thuần, không cần DB.
 * Chạy: npx tsx src/utils/banners.test.ts
 */
import { isSafeBannerLink } from "./banners.js";

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

console.log("\n[1] Hợp lệ");
{
  for (const link of [
    "/danh-muc/laptop",
    "/",
    "/khuyen-mai?ma=WELCOME10#chi-tiet",
    "/san-pham/cpu-amd-ryzen-7-9700x",
    "https://pczone.vn/khuyen-mai",
    "http://example.com",
    "HTTPS://EXAMPLE.COM/A",
  ]) {
    check(JSON.stringify(link), isSafeBannerLink(link), true);
  }
}

console.log("\n[2] Chạy mã khi bấm / không phải http(s)");
{
  for (const link of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "mailto:a@b.c",
    "ftp://example.com/file",
    "khuyen-mai",
    "www.example.com",
    "https:/example.com",
    "https://",
  ]) {
    check(JSON.stringify(link), isSafeBannerLink(link), false);
  }
}

console.log("\n[3] Dạng trình duyệt hiểu thành sang trang khác");
{
  for (const link of ["//evil.com", "/\\evil.com", "\\\\evil.com", "/\t/evil.com", "/\n/evil.com", "/ /evil.com", "/\u0000x"]) {
    check(JSON.stringify(link), isSafeBannerLink(link), false);
  }
  check("có khoảng trắng trong URL đầy đủ", isSafeBannerLink("https://example.com/a b"), false);
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
