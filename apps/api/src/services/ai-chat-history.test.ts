/**
 * Kiểm thử phần thuần của việc mở lại hội thoại trợ lý AI (`readCitedProductIds` trong ai-chat.service.ts): cột JSON
 * `citedProductIds` chỉ được hiểu là mảng chuỗi, dữ liệu lạ không làm hỏng trang. Không cần DB.
 * Chạy: npx tsx src/services/ai-chat-history.test.ts
 */
import { readCitedProductIds } from "./ai-chat.service.js";

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

console.log("\n[1] Đọc danh sách sản phẩm trích dẫn đã lưu");
{
  check("mảng id giữ nguyên thứ tự", readCitedProductIds(["p2", "p1"]), ["p2", "p1"]);
  check("null (tin nhắn của khách) → rỗng", readCitedProductIds(null), []);
  check("không phải mảng → rỗng", readCitedProductIds({ id: "p1" }), []);
  check("bỏ phần tử không phải chuỗi", readCitedProductIds(["p1", 2, null, { id: "x" }, "p3"]), ["p1", "p3"]);
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
