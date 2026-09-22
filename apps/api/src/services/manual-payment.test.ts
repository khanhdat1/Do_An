/**
 * Kiểm thử các hàm thuần của chuyển khoản thủ công (cấu hình đủ/thiếu, dựng URL VietQR) — không cần
 * DB/mạng. Chạy: npx tsx src/services/manual-payment.test.ts
 */
import { buildBankQrUrl, isBankTransferConfigured, isMomoConfigured } from "./manual-payment.service.js";

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

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
