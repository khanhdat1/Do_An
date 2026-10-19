/**
 * Kiểm thử phần thuần của việc tự huỷ đơn chuyển khoản/MoMo quá hạn thanh toán (đọc cấu hình, điều kiện lọc đơn,
 * lý do huỷ) — không cần DB. Chạy: npx tsx src/utils/unpaid-order.test.ts
 */
import {
  autoCancelReason,
  DEFAULT_UNPAID_ORDER_TIMEOUT_HOURS,
  formatTimeout,
  parseUnpaidOrderTimeoutHours,
  staleUnpaidOrderWhere,
} from "./unpaid-order.js";

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

console.log("\n[1] parseUnpaidOrderTimeoutHours — đọc UNPAID_ORDER_TIMEOUT_HOURS");
{
  check("mặc định là 24 giờ", DEFAULT_UNPAID_ORDER_TIMEOUT_HOURS, 24);
  check("không đặt -> 24", parseUnpaidOrderTimeoutHours(undefined), 24);
  check("chuỗi rỗng / toàn dấu cách -> 24", [parseUnpaidOrderTimeoutHours(""), parseUnpaidOrderTimeoutHours("   ")], [24, 24]);
  check("48 -> 48", parseUnpaidOrderTimeoutHours("48"), 48);
  check("có dấu cách hai đầu -> vẫn đọc được", parseUnpaidOrderTimeoutHours(" 12 "), 12);
  check("số lẻ 0.5 -> 0.5 (30 phút)", parseUnpaidOrderTimeoutHours("0.5"), 0.5);
  check("0 -> null (tắt tự huỷ)", parseUnpaidOrderTimeoutHours("0"), null);
  check("số âm -> mặc định, không làm sập API", parseUnpaidOrderTimeoutHours("-3"), 24);
  check("chữ -> mặc định", parseUnpaidOrderTimeoutHours("mot ngay"), 24);
  check("Infinity -> mặc định", parseUnpaidOrderTimeoutHours("Infinity"), 24);
}

console.log("\n[2] staleUnpaidOrderWhere — chỉ đơn chuyển khoản/MoMo còn chờ, chưa trả tiền, quá hạn");
{
  const now = new Date("2026-10-19T12:00:00.000Z");
  const where = staleUnpaidOrderWhere(now, 24);
  check("đơn còn chờ xác nhận", where.status, "PENDING");
  check("chưa thanh toán", where.paymentStatus, "PENDING");
  check("đúng hai phương thức chuyển khoản tay — không COD, không VNPay", where.paymentMethod, { in: ["BANK_TRANSFER", "MOMO"] });
  check("tạo trước đúng 24 giờ", (where.createdAt as { lt: Date }).lt.toISOString(), "2026-10-18T12:00:00.000Z");
  check(
    "hạn số lẻ 0.5 giờ -> 30 phút",
    ((staleUnpaidOrderWhere(now, 0.5).createdAt as { lt: Date }).lt).toISOString(),
    "2026-10-19T11:30:00.000Z",
  );
}

console.log("\n[3] formatTimeout / autoCancelReason — lý do huỷ khách đọc được");
{
  check("24 -> 24 giờ", formatTimeout(24), "24 giờ");
  check("0.5 -> 30 phút", formatTimeout(0.5), "30 phút");
  check("1.5 -> 90 phút", formatTimeout(1.5), "90 phút");

  const bank = autoCancelReason("BANK_TRANSFER", 24);
  const momo = autoCancelReason("MOMO", 48);
  check("nói rõ hệ thống tự huỷ", bank.startsWith("Hệ thống tự huỷ"), true);
  check("chuyển khoản ngân hàng: nêu thời hạn và phương thức", bank.includes("quá 24 giờ chưa nhận được thanh toán chuyển khoản ngân hàng"), true);
  check("MoMo: nêu thời hạn và phương thức", momo.includes("quá 48 giờ chưa nhận được thanh toán chuyển khoản MoMo"), true);
  check("hướng dẫn khách đã chuyển tiền liên hệ cửa hàng", bank.includes("liên hệ cửa hàng"), true);
  // Order.cancelReason là VarChar(300)
  check("vừa cột cancelReason (≤ 300 ký tự)", Math.max(bank.length, momo.length) <= 300, true);
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
