/**
 * Kiểm thử tính giảm giá của mã (PERCENT có trần, FIXED không vượt subtotal, làm tròn, không âm) bằng
 * hàm thuần `computeDiscountAmount`, và thứ tự ghi của `redeemVoucher` (giữ khoá dòng mã rồi mới đếm lượt mỗi người)
 * trên một transaction GIẢ — không cần DB. Hai đơn của cùng một người chạy thật cùng lúc trên MySQL nằm ở kịch bản E2E
 * TC26 (apps/e2e/tests/order-edge-cases.spec.ts). Chạy: npx tsx src/services/voucher.test.ts
 */
import type { Prisma } from "@pczone/db";
import { HttpError } from "../middleware/errors.js";
import { computeDiscountAmount, redeemVoucher } from "./voucher.service.js";

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

console.log("\n[6] redeemVoucher — giới hạn mỗi người đếm lại SAU khi giữ khoá dòng mã");
{
  /** Transaction giả: `voucher.updateMany` trả `count` cho trước, câu đếm có khoá trả `used` lượt người này đã dùng */
  function fakeDb(voucherCount: number, used: number) {
    const ops: string[] = [];
    const queries: { sql: string; values: unknown[] }[] = [];
    const created: unknown[] = [];
    const db = {
      voucher: {
        updateMany: async () => {
          ops.push("voucher.updateMany");
          return { count: voucherCount };
        },
      },
      $queryRaw: async (query: { sql: string; values: unknown[] }) => {
        ops.push("$queryRaw");
        queries.push({ sql: query.sql, values: query.values });
        return [{ used: BigInt(used) }]; // MySQL COUNT(*) về qua Prisma là BigInt
      },
      voucherRedemption: {
        create: async (args: { data: unknown }) => {
          ops.push("voucherRedemption.create");
          created.push(args.data);
          return args.data;
        },
      },
    };
    return { db: db as unknown as Prisma.TransactionClient, ops, queries, created };
  }

  const params = {
    voucher: { id: "v1", usageLimit: null, perUserLimit: 1 },
    userId: "u1",
    orderCode: "PCZ20261022-0001",
    discountAmount: 50_000,
  };
  const statusOf = async (run: () => Promise<void>) => {
    try {
      await run();
      return "ok";
    } catch (error) {
      return error instanceof HttpError ? [error.status, error.message] : String(error);
    }
  };

  const fresh = fakeDb(1, 0);
  check("chưa dùng lần nào -> ghi lượt dùng", await statusOf(() => redeemVoucher(fresh.db, params)), "ok");
  check("thứ tự: khoá dòng mã (updateMany) -> đếm có khoá -> ghi lượt dùng", fresh.ops, [
    "voucher.updateMany",
    "$queryRaw",
    "voucherRedemption.create",
  ]);
  check("câu đếm là đọc CÓ KHOÁ (FOR UPDATE) — thấy cả lượt đơn khác vừa commit", /FOR UPDATE\s*$/.test(fresh.queries[0].sql), true);
  check("câu đếm lọc đúng mã + đúng người (tham số, không nối chuỗi)", fresh.queries[0].values, ["v1", "u1"]);

  const usedUp = fakeDb(1, 1);
  check(
    "đơn khác của cùng người vừa dùng hết lượt -> 409, không ghi lượt dùng",
    await statusOf(() => redeemVoucher(usedUp.db, params)),
    [409, "Bạn đã dùng hết lượt cho mã giảm giá này"],
  );
  check("không ghi VoucherRedemption", usedUp.created, []);

  const twoPerUser = fakeDb(1, 1);
  check(
    "perUserLimit = 2, đã dùng 1 -> còn dùng được",
    await statusOf(() => redeemVoucher(twoPerUser.db, { ...params, voucher: { ...params.voucher, perUserLimit: 2 } })),
    "ok",
  );

  const soldOut = fakeDb(0, 0);
  check(
    "hết lượt tổng (updateMany count = 0) -> 409, không cần đếm lượt mỗi người",
    [await statusOf(() => redeemVoucher(soldOut.db, { ...params, voucher: { ...params.voucher, usageLimit: 10 } })), soldOut.ops],
    [[409, "Mã giảm giá vừa hết lượt sử dụng. Vui lòng bỏ mã và thử lại."], ["voucher.updateMany"]],
  );
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
