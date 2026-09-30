/**
 * Kiểm thử các hàm thuần của thanh toán thủ công (cấu hình đủ/thiếu, dựng URL VietQR, khi nào được ghi nhận tiền
 * tay) — không cần DB/mạng. Chạy: npx tsx src/services/manual-payment.test.ts
 */
import { buildBankQrUrl, isBankTransferConfigured, isMomoConfigured, manualPaymentBlockReason } from "./manual-payment.service.js";

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

console.log("\n[1] isBankTransferConfigured");
{
  check("đủ cả 4 trường -> true", isBankTransferConfigured({ bankId: "970436", accountNumber: "123", accountName: "A", bankName: "Vietcombank" }), true);
  check("thiếu accountName -> false", isBankTransferConfigured({ bankId: "970436", accountNumber: "123", bankName: "Vietcombank" }), false);
  check("rỗng hết -> false", isBankTransferConfigured({}), false);
}

console.log("\n[2] isMomoConfigured");
{
  check("đủ 2 trường -> true", isMomoConfigured({ phone: "0900000000", displayName: "A" }), true);
  check("thiếu displayName -> false", isMomoConfigured({ phone: "0900000000" }), false);
}

console.log("\n[3] buildBankQrUrl — dựng đúng URL img.vietqr.io, mã hoá nội dung");
{
  const config = { bankId: "970436", accountNumber: "0011002345678", accountName: "NGUYEN VAN A", bankName: "Vietcombank" };
  const url = buildBankQrUrl(config, { amount: 1_250_000, addInfo: "PCZ20260922-0001" });
  check("đúng gốc + bankId-accountNumber-template", url.startsWith("https://img.vietqr.io/image/970436-0011002345678-compact2.png?"), true);
  check("amount làm tròn, không có dấu phẩy/chấm", url.includes("amount=1250000"), true);
  check("addInfo có trong URL (đã encode)", url.includes(`addInfo=${encodeURIComponent("PCZ20260922-0001")}`), true);
  // URLSearchParams mã hoá dấu cách bằng "+" (application/x-www-form-urlencoded), không phải %20 — server nào cũng hiểu đúng
  check("accountName có trong URL (đã encode dấu cách)", url.includes("accountName=NGUYEN+VAN+A"), true);
}

console.log("\n[4] manualPaymentBlockReason — khi nào nhân viên được ghi nhận tiền tay");
{
  const allowed = (order: Parameters<typeof manualPaymentBlockReason>[0]) => manualPaymentBlockReason(order) === null;
  check("chuyển khoản còn chờ tiền, đơn chờ xác nhận -> được", allowed({ paymentMethod: "BANK_TRANSFER", paymentStatus: "PENDING", status: "PENDING" }), true);
  check("MoMo, đơn đã bị huỷ -> vẫn được (ghi nhận để đối soát)", allowed({ paymentMethod: "MOMO", paymentStatus: "PENDING", status: "CANCELLED" }), true);
  for (const status of ["PENDING", "CONFIRMED", "PACKING"] as const) {
    check(`COD đang ở ${status} -> chưa được (chưa giao thì chưa thu tiền)`, allowed({ paymentMethod: "COD", paymentStatus: "PENDING", status }), false);
  }
  check("COD đang giao -> được", allowed({ paymentMethod: "COD", paymentStatus: "PENDING", status: "SHIPPING" }), true);
  check("COD đã giao -> được", allowed({ paymentMethod: "COD", paymentStatus: "PENDING", status: "DELIVERED" }), true);
  check("COD đã hoàn trả (giao không thành công) -> không", allowed({ paymentMethod: "COD", paymentStatus: "PENDING", status: "RETURNED" }), false);
  check("COD đã ghi nhận rồi -> không ghi nhận lần hai", allowed({ paymentMethod: "COD", paymentStatus: "PAID", status: "DELIVERED" }), false);
  check("VNPay -> không (cổng tự xác nhận qua IPN)", allowed({ paymentMethod: "VNPAY", paymentStatus: "PENDING", status: "PENDING" }), false);
  check(
    "lý do COD chưa giao nói rõ điều kiện",
    manualPaymentBlockReason({ paymentMethod: "COD", paymentStatus: "PENDING", status: "CONFIRMED" }),
    "Đơn COD chỉ ghi nhận đã thu tiền khi đơn đang giao hoặc đã giao",
  );
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
