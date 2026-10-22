/**
 * Kiểm thử `isValidRating` (số sao 1..5, số nguyên) và `reviewCreateError` (lỗi nào thành 409) — hàm thuần, không cần DB.
 * Chạy: npx tsx src/services/review.test.ts
 */
import { Prisma } from "@pczone/db";
import { ConflictError } from "../middleware/errors.js";
import { isValidRating, reviewCreateError } from "./review.service.js";

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

console.log("\n[4] reviewCreateError — chỉ trùng khoá (P2002) mới thành 409");
{
  const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError(`lỗi giả lập ${code}`, { code, clientVersion: "test" });

  const duplicate = reviewCreateError(prismaError("P2002"));
  check("P2002 -> ConflictError", duplicate instanceof ConflictError, true);
  check("P2002 -> 409", duplicate instanceof ConflictError && duplicate.status, 409);

  const foreignKey = prismaError("P2003");
  check("P2003 (khoá ngoại) -> ném lại nguyên lỗi, không thành 409", reviewCreateError(foreignKey), foreignKey);
  const lostConnection = new Prisma.PrismaClientInitializationError("Can't reach database server", "test");
  check("mất kết nối DB -> ném lại nguyên lỗi", reviewCreateError(lostConnection), lostConnection);
  const plain = new Error("lỗi khác");
  check("Error thường -> ném lại nguyên lỗi", reviewCreateError(plain), plain);
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
