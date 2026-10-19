/**
 * Kiểm thử thứ tự ghi của huỷ/hoàn đơn (`order-cancellation.service.ts`) trên một transaction GIẢ ghi lại từng lời gọi
 * — không cần DB. Điểm cốt lõi chống chạy đua: bước đổi trạng thái có điều kiện phải đi ĐẦU TIÊN, và khi không giành
 * được đơn (count = 0) thì không được hoàn kho/hoàn mã/ghi lịch sử gì cả. Chạy hai request thật cùng lúc trên MySQL
 * nằm ở kịch bản E2E TC21/TC22 (apps/e2e/tests/order-edge-cases.spec.ts).
 * Chạy: npx tsx src/services/order-cancellation.test.ts
 */
import type { Prisma } from "@pczone/db";
import { HttpError } from "../middleware/errors.js";
import {
  cancelOrderInTx,
  claimOrderTransition,
  claimOrderTransitionOrThrow,
  ORDER_CHANGED_MESSAGE,
  restockOrderItems,
} from "./order-cancellation.service.js";

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

/** Transaction giả: ghi lại mọi lời gọi; `order.updateMany` trả `count` cho trước (1 = giành được đơn, 0 = đã bị đổi) */
function fakeTx(orderUpdateCount: number) {
  const calls: Call[] = [];
  const stock: Record<string, number> = { p1: 3, p2: 0 };
  const record =
    (op: string, result: (args: Record<string, unknown>) => unknown = () => ({ count: 1 })) =>
    async (args: Record<string, unknown>) => {
      calls.push({ op, args });
      return result(args);
    };
  const tx = {
    order: { updateMany: record("order.updateMany", () => ({ count: orderUpdateCount })) },
    product: {
      update: record("product.update", (args) => {
        const id = (args.where as { id: string }).id;
        const data = args.data as { inventoryQuantity: { increment: number } };
        stock[id] = (stock[id] ?? 0) + data.inventoryQuantity.increment;
        return { inventoryQuantity: stock[id] };
      }),
    },
    inventoryTransaction: { create: record("inventoryTransaction.create") },
    voucher: { updateMany: record("voucher.updateMany") },
    voucherRedemption: { deleteMany: record("voucherRedemption.deleteMany") },
    orderStatusHistory: { create: record("orderStatusHistory.create") },
    payment: { updateMany: record("payment.updateMany") },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, calls, ops: () => calls.map((call) => call.op) };
}

const ORDER = {
  id: "o1",
  orderCode: "PCZ20261019-0001",
  status: "PENDING" as const,
  voucherId: "v1",
  // productId null: dòng hàng của sản phẩm đã bị xoá khỏi catalog — bỏ qua khi hoàn kho
  items: [
    { productId: "p1", quantity: 2 },
    { productId: null, quantity: 1 },
    { productId: "p2", quantity: 1 },
  ],
};

const OPTIONS = { reason: "đổi ý", historyNote: "đổi ý", stockNote: "Hoàn kho do huỷ đơn PCZ20261019-0001", requireUnpaid: true };

console.log("\n[1] cancelOrderInTx — đơn đã bị thao tác khác đổi trạng thái (count = 0)");
{
  const { tx, ops } = fakeTx(0);
  const result = await cancelOrderInTx(tx, ORDER, OPTIONS);
  check("trả false", result, false);
  check("chỉ có đúng lượt giành đơn, không hoàn kho/hoàn mã/ghi lịch sử", ops(), ["order.updateMany"]);
}

console.log("\n[2] cancelOrderInTx — giành được đơn");
{
  const { tx, calls, ops } = fakeTx(1);
  const result = await cancelOrderInTx(tx, ORDER, OPTIONS);
  check("trả true", result, true);
  check(
    "thứ tự: giành đơn → hoàn mã → hoàn kho từng dòng → lịch sử → huỷ lượt thanh toán chờ",
    ops(),
    [
      "order.updateMany",
      "voucher.updateMany",
      "voucherRedemption.deleteMany",
      "product.update",
      "inventoryTransaction.create",
      "product.update",
      "inventoryTransaction.create",
      "orderStatusHistory.create",
      "payment.updateMany",
    ],
  );
  const claim = calls[0].args as { where: Record<string, unknown>; data: Record<string, unknown> };
  check("điều kiện giành đơn: đúng id + trạng thái vừa đọc + chưa thanh toán", claim.where, {
    paymentStatus: "PENDING",
    id: "o1",
    status: "PENDING",
  });
  check("ghi CANCELLED kèm lý do", [claim.data.status, claim.data.cancelReason, claim.data.cancelledAt instanceof Date], [
    "CANCELLED",
    "đổi ý",
    true,
  ]);
  const stockRows = calls.filter((call) => call.op === "inventoryTransaction.create").map((call) => call.args.data);
  check("sổ kho: ADJUST, cộng đúng số lượng, quantityAfter là tồn kho sau khi cộng", stockRows, [
    { productId: "p1", type: "ADJUST", quantityChange: 2, quantityAfter: 5, orderId: "o1", note: OPTIONS.stockNote },
    { productId: "p2", type: "ADJUST", quantityChange: 1, quantityAfter: 1, orderId: "o1", note: OPTIONS.stockNote },
  ]);
  const history = calls.find((call) => call.op === "orderStatusHistory.create")!.args.data as Record<string, unknown>;
  check("lịch sử ghi đúng trạng thái trước/sau và ghi chú", [history.fromStatus, history.toStatus, history.note], [
    "PENDING",
    "CANCELLED",
    "đổi ý",
  ]);
  check(
    "hoàn mã: chỉ trừ khi usageCount > 0, xoá đúng lượt dùng của đơn",
    [calls[1].args.where, calls[2].args.where],
    [{ id: "v1", usageCount: { gt: 0 } }, { voucherId: "v1", orderId: "PCZ20261019-0001" }],
  );
}

console.log("\n[3] cancelOrderInTx — các tuỳ chọn");
{
  const admin = fakeTx(1);
  await cancelOrderInTx(admin.tx, { ...ORDER, status: "PACKING", voucherId: null }, { ...OPTIONS, requireUnpaid: false, changedBy: "u1" });
  check("nhân viên huỷ: không đòi chưa thanh toán", (admin.calls[0].args.where as object), { id: "o1", status: "PACKING" });
  check("không có mã giảm giá -> không đụng bảng mã", admin.ops().filter((op) => op.startsWith("voucher")), []);
  const history = admin.calls.find((call) => call.op === "orderStatusHistory.create")!.args.data as Record<string, unknown>;
  check("lịch sử ghi người thực hiện", history.changedBy, "u1");

  const auto = fakeTx(1);
  await cancelOrderInTx(auto.tx, ORDER, { ...OPTIONS, cancelPendingPayments: false });
  check("cancelPendingPayments: false -> giữ nguyên lượt thanh toán", auto.ops().includes("payment.updateMany"), false);
}

console.log("\n[4] claimOrderTransition / claimOrderTransitionOrThrow");
{
  const lost = fakeTx(0);
  check("count = 0 -> false", await claimOrderTransition(lost.tx, ORDER, { status: "CONFIRMED" }), false);

  const won = fakeTx(1);
  check("count = 1 -> true", await claimOrderTransition(won.tx, ORDER, { status: "CONFIRMED" }), true);

  const guarded = fakeTx(1);
  await claimOrderTransition(guarded.tx, ORDER, { status: "CONFIRMED" }, { id: "khac", status: "CANCELLED" });
  check("điều kiện thêm không ghi đè được id/trạng thái vừa đọc", guarded.calls[0].args.where, { id: "o1", status: "PENDING" });

  let thrown: unknown;
  try {
    await claimOrderTransitionOrThrow(fakeTx(0).tx, ORDER, { status: "CONFIRMED" });
  } catch (error) {
    thrown = error;
  }
  check(
    "không giành được -> 409 với thông báo tải lại trang",
    thrown instanceof HttpError ? [thrown.status, thrown.message] : thrown,
    [409, ORDER_CHANGED_MESSAGE],
  );
}

console.log("\n[5] restockOrderItems — hoàn hàng dùng RETURN");
{
  const { tx, calls } = fakeTx(1);
  await restockOrderItems(tx, ORDER, "RETURN", "Khách trả hàng");
  check(
    "mỗi dòng có sản phẩm một phiếu RETURN",
    calls.filter((call) => call.op === "inventoryTransaction.create").map((call) => (call.args.data as { type: string }).type),
    ["RETURN", "RETURN"],
  );
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
