/**
 * Kiểm thử tính giảm giá của mã (PERCENT có trần, FIXED không vượt subtotal, làm tròn, không âm) bằng
 * hàm thuần `computeDiscountAmount` — không cần DB. Chạy: npx tsx src/services/voucher.test.ts
 */
import { computeDiscountAmount } from "./voucher.service.js";

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

type VoucherLike = { discountType: "PERCENT" | "FIXED"; discountValue: number; maxDiscount: number | null };

console.log("\n[1] PERCENT — có trần maxDiscount");
{
  const voucher: VoucherLike = { discountType: "PERCENT", discountValue: 10, maxDiscount: 300_000 };
  check("10% của 1.000.000đ = 100.000đ (chưa chạm trần)", computeDiscountAmount(voucher, 1_000_000), 100_000);
  check("10% của 5.000.000đ = 500.000đ nhưng bị chặn ở trần 300.000đ", computeDiscountAmount(voucher, 5_000_000), 300_000);
  check("đúng bằng trần thì lấy đúng trần", computeDiscountAmount(voucher, 3_000_000), 300_000);
}

console.log("\n[2] PERCENT — không có trần (maxDiscount null)");
{
  const voucher: VoucherLike = { discountType: "PERCENT", discountValue: 20, maxDiscount: null };
  check("20% của 2.500.000đ = 500.000đ, không bị chặn", computeDiscountAmount(voucher, 2_500_000), 500_000);
}

console.log("\n[3] FIXED — số tiền cố định, không vượt quá subtotal");
{
  const voucher: VoucherLike = { discountType: "FIXED", discountValue: 50_000, maxDiscount: null };
  check("subtotal lớn hơn giá trị mã: giảm đúng 50.000đ", computeDiscountAmount(voucher, 1_000_000), 50_000);
  check("subtotal nhỏ hơn giá trị mã: giảm tối đa bằng subtotal, không âm", computeDiscountAmount(voucher, 30_000), 30_000);
  check("subtotal bằng 0: giảm 0", computeDiscountAmount(voucher, 0), 0);
}

console.log("\n[4] FIXED — maxDiscount bị bỏ qua (chỉ áp cho PERCENT)");
{
  // Trường hợp lý thuyết: FIXED mà lỡ có maxDiscount nhỏ hơn discountValue thì vẫn không bị chặn,
  // vì maxDiscount không có ý nghĩa với FIXED (csdl.md mục 4.6)
  const voucher: VoucherLike = { discountType: "FIXED", discountValue: 100_000, maxDiscount: 10_000 };
  check("FIXED không bị maxDiscount chặn", computeDiscountAmount(voucher, 1_000_000), 100_000);
}

console.log("\n[5] Làm tròn số nguyên VNĐ");
{
  const voucher: VoucherLike = { discountType: "PERCENT", discountValue: 15, maxDiscount: null };
  // 15% của 333.333đ = 49.999,95đ -> làm tròn 50.000đ
  check("làm tròn về số nguyên", computeDiscountAmount(voucher, 333_333), 50_000);
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
