/**
 * Kiểm thử phần ghi nhận tiền VNPay vào đơn (`recordVnpayPaid` trong order.service.ts) trên một transaction GIẢ ghi lại
 * từng lời gọi — không cần DB. Điểm cốt lõi: đơn chỉ lên CONFIRMED qua cập nhật CÓ ĐIỀU KIỆN (đơn vẫn PENDING, chưa thanh
 * toán); không giành được (khách/hệ thống vừa huỷ) thì chỉ ghi nhận đã có tiền + lịch sử "cần đối soát", không bao giờ
 * ghi đè trạng thái đơn. IPN và lượt huỷ chạy thật cùng lúc trên MySQL nằm ở kịch bản E2E TC24/TC25
 * (apps/e2e/tests/order-edge-cases.spec.ts).
 * Chạy: npx tsx src/services/vnpay-callback.test.ts
 */
import type { OrderStatus, Prisma } from "@pczone/db";
import { recordVnpayPaid } from "./order.service.js";

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

interface Call {
  op: string;
  args: Record<string, unknown>;
}

/**
 * Transaction giả: `order.updateMany` (lượt giành đơn) trả `count` cho trước — 1 = đơn còn chờ, 0 = đã bị đổi; `order.findUniqueOrThrow`
 * trả trạng thái hiện tại `currentStatus` (bản mới nhất sau khi lượt huỷ commit).
 */
function fakeTx(claimCount: number, currentStatus: OrderStatus) {
  const calls: Call[] = [];
  const record =
    (op: string, result: () => unknown = () => ({ count: 1 })) =>
    async (args: Record<string, unknown>) => {
      calls.push({ op, args });
      return result();
    };
  const tx = {
    order: {
      updateMany: record("order.updateMany", () => ({ count: claimCount })),
      update: record("order.update", () => ({})),
      findUniqueOrThrow: record("order.findUniqueOrThrow", () => ({ status: currentStatus })),
    },
    orderStatusHistory: { create: record("orderStatusHistory.create") },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, calls, ops: () => calls.map((call) => call.op) };
}

const dataOf = (call: Call | undefined) => (call?.args.data ?? {}) as Record<string, unknown>;

console.log("\n[1] Đơn còn chờ thanh toán -> xác nhận bằng cập nhật có điều kiện");
{
  const { tx, calls, ops } = fakeTx(1, "PENDING");
  await recordVnpayPaid(tx, "o1");
  check("chỉ giành đơn rồi ghi lịch sử, không ghi đè trạng thái bằng update thường", ops(), [
    "order.updateMany",
    "orderStatusHistory.create",
  ]);
  check("điều kiện: đúng đơn, vẫn PENDING, vẫn chưa thanh toán", calls[0].args.where, {
    paymentStatus: "PENDING",
    id: "o1",
    status: "PENDING",
  });
  const claim = dataOf(calls[0]);
  check("ghi CONFIRMED + PAID + confirmedAt", [claim.status, claim.paymentStatus, claim.confirmedAt instanceof Date], [
    "CONFIRMED",
    "PAID",
    true,
  ]);
  const history = dataOf(calls[1]);
  check("lịch sử PENDING -> CONFIRMED", [history.fromStatus, history.toStatus, history.note], [
    "PENDING",
    "CONFIRMED",
    "Thanh toán VNPay thành công",
  ]);
}

console.log("\n[2] Khách/hệ thống vừa huỷ đơn đúng lúc IPN tới (giành đơn thất bại) -> không hồi sinh");
{
  const { tx, calls, ops } = fakeTx(0, "CANCELLED");
  await recordVnpayPaid(tx, "o1");
  check("giành đơn -> ghi nhận tiền -> đọc trạng thái mới nhất -> lịch sử", ops(), [
    "order.updateMany",
    "order.update",
    "order.findUniqueOrThrow",
    "orderStatusHistory.create",
  ]);
  const paid = calls[1];
  check("chỉ ghi paymentStatus PAID, KHÔNG đổi trạng thái đơn", [paid.args.where, paid.args.data], [
    { id: "o1" },
    { paymentStatus: "PAID" },
  ]);
  const history = dataOf(calls[3]);
  check("lịch sử giữ nguyên Đã huỷ, ghi cần đối soát", [history.fromStatus, history.toStatus, history.note], [
    "CANCELLED",
    "CANCELLED",
    "Nhận được thanh toán VNPay sau khi đơn đã đổi trạng thái — cần đối soát thủ công",
  ]);
  check(
    "không có lời gọi nào ghi CONFIRMED ngoài lượt giành đơn có điều kiện",
    calls.slice(1).some((call) => dataOf(call).status === "CONFIRMED"),
    false,
  );
}

console.log("\n[3] Đơn đã được xác nhận qua lượt thanh toán khác -> vẫn ghi nhận, giữ trạng thái");
{
  const { tx, calls } = fakeTx(0, "CONFIRMED");
  await recordVnpayPaid(tx, "o1");
  const history = dataOf(calls.find((call) => call.op === "orderStatusHistory.create"));
  check("lịch sử CONFIRMED -> CONFIRMED, cần đối soát", [history.fromStatus, history.toStatus], ["CONFIRMED", "CONFIRMED"]);
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
