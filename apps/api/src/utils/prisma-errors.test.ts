// Kiểm thử nhận diện lỗi Prisma và thử lại transaction khi deadlock. Chạy: npx tsx src/utils/prisma-errors.test.ts
import { Prisma } from "@pczone/db";
import { isTransactionConflict, isUniqueViolation, retryOnTransactionConflict } from "./prisma-errors.js";

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

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`lỗi giả lập ${code}`, { code, clientVersion: "test" });
const deadlock = () => prismaError("P2034");
const noWait = async () => {};

console.log("\n[1] Nhận diện mã lỗi");
check("P2034 là xung đột transaction", isTransactionConflict(deadlock()), true);
check("P2002 không phải xung đột transaction", isTransactionConflict(prismaError("P2002")), false);
check("Error thường không phải xung đột transaction", isTransactionConflict(new Error("P2034")), false);
check("chuỗi/undefined không phải xung đột transaction", [isTransactionConflict("P2034"), isTransactionConflict(undefined)], [false, false]);
check("P2002 vẫn là vi phạm unique", isUniqueViolation(prismaError("P2002")), true);
check("P2034 không phải vi phạm unique", isUniqueViolation(deadlock()), false);

console.log("\n[2] Thử lại cả transaction khi gặp P2034");
{
  let calls = 0;
  const result = await retryOnTransactionConflict(async () => {
    calls++;
    if (calls < 3) throw deadlock();
    return "ok";
  }, 5, noWait);
  check("deadlock 2 lần rồi thành công → trả kết quả lần 3", { result, calls }, { result: "ok", calls: 3 });
}
{
  let calls = 0;
  let caught: unknown;
  try {
    await retryOnTransactionConflict(async () => {
      calls++;
      throw deadlock();
    }, 5, noWait);
  } catch (error) {
    caught = error;
  }
  check("deadlock mãi → dừng sau đúng 5 lần và ném lại P2034", { calls, conflict: isTransactionConflict(caught) }, { calls: 5, conflict: true });
}
{
  let calls = 0;
  let caught: unknown;
  try {
    await retryOnTransactionConflict(async () => {
      calls++;
      throw new Error("hết hàng (ConflictError)");
    }, 5, noWait);
  } catch (error) {
    caught = error;
  }
  check("lỗi khác (vd hết hàng) → không thử lại, ném nguyên vẹn", { calls, message: (caught as Error).message }, { calls: 1, message: "hết hàng (ConflictError)" });
}
{
  const waits: number[] = [];
  let calls = 0;
  await retryOnTransactionConflict(async () => {
    calls++;
    if (calls < 4) throw deadlock();
    return calls;
  }, 5, async (ms) => {
    waits.push(ms);
  });
  check("có nghỉ giữa các lần, trong khoảng 20–80 ms × số lần", waits.map((ms, i) => ms >= 20 * (i + 1) && ms <= 80 * (i + 1)), [true, true, true]);
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
