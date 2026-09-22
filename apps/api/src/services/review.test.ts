/**
 * Kiểm thử `isValidRating` (số sao 1..5, số nguyên) — hàm thuần, không cần DB.
 * Chạy: npx tsx src/services/review.test.ts
 */
import { isValidRating } from "./review.service.js";

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}\n      mong đợi: ${expected}\n      nhận được: ${actual}`);
    failed++;
  }
}

console.log("\n[1] Hợp lệ: số nguyên 1..5");
{
  check("1", isValidRating(1), true);
  check("5", isValidRating(5), true);
  check("3", isValidRating(3), true);
}

console.log("\n[2] Không hợp lệ: ngoài khoảng");
{
  check("0", isValidRating(0), false);
  check("6", isValidRating(6), false);
  check("-1", isValidRating(-1), false);
}

console.log("\n[3] Không hợp lệ: không phải số nguyên");
{
  check("3.5", isValidRating(3.5), false);
  check("NaN", isValidRating(NaN), false);
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
