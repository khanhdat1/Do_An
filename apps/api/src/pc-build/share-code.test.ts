// Kiểm thử mã chia sẻ cấu hình. Chạy: npx tsx src/pc-build/share-code.test.ts
import { generateShareCode, isShareCode } from "./share-code.js";

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

console.log("\n[1] generateShareCode / isShareCode");
{
  const codes = Array.from({ length: 500 }, () => generateShareCode());
  check("mọi mã dài đúng 8 ký tự", codes.every((code) => code.length === 8), true);
  check("mọi mã tự sinh đều qua isShareCode", codes.every(isShareCode), true);
  check("không có ký tự dễ nhầm 0 O o 1 l I", codes.some((code) => /[0Oo1lI]/.test(code)), false);
  check("500 mã không trùng nhau", new Set(codes).size, 500);
  check("chuỗi quá ngắn bị từ chối", isShareCode("abc"), false);
  check("có ký tự dễ nhầm bị từ chối", isShareCode("abcdefg0"), false);
  check("có ký tự lạ bị từ chối", isShareCode("abcd-efg"), false);
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
