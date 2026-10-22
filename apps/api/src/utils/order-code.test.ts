/**
 * Kiểm thử mã đơn (`order-code.ts`): tiền tố theo ngày + 6 ký tự ngẫu nhiên dễ đọc, không còn số thứ tự đoán được.
 * Hàm thuần, không cần DB. Chạy: npx tsx src/utils/order-code.test.ts
 */
import { generateOrderCode, ORDER_CODE_ALPHABET, ORDER_CODE_SUFFIX_LENGTH } from "./order-code.js";

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

console.log("\n[1] Định dạng");
{
  const code = generateOrderCode(new Date(2026, 9, 22, 10, 30));
  check("tiền tố theo ngày (giờ máy chủ)", code.slice(0, 12), "PCZ20261022-");
  check("tổng độ dài 18 ký tự, vừa cột VarChar(30)", code.length, 18);
  check("đuôi đúng 6 ký tự", code.slice(12).length, ORDER_CODE_SUFFIX_LENGTH);
  check("chỉ dùng ký tự trong bảng chữ dễ đọc", [...code.slice(12)].every((ch) => ORDER_CODE_ALPHABET.includes(ch)), true);
  check("bảng chữ không có 0/O/1/I/L dễ đọc nhầm", /[0O1IL]/.test(ORDER_CODE_ALPHABET), false);
}

console.log("\n[2] Không đoán được");
{
  const day = new Date(2026, 9, 22);
  const codes = Array.from({ length: 2000 }, () => generateOrderCode(day));
  check("2000 mã trong cùng một ngày không trùng nhau", new Set(codes).size, codes.length);
  check("không còn dạng số thứ tự -0001", codes.some((code) => /-\d{4}$/.test(code)), false);
  const firstChars = new Set(codes.map((code) => code[12]));
  check("ký tự đầu của đuôi trải đều (≥ 25/31 ký tự xuất hiện)", firstChars.size >= 25, true);
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
