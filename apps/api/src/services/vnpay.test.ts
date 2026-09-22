/**
 * Kiểm thử chữ ký VNPay (dựng URL, xác minh return/IPN, phát hiện dữ liệu bị sửa) bằng khoá giả,
 * không cần biến môi trường thật hay gọi mạng. Chạy: npx tsx src/services/vnpay.test.ts
 */
import {
  buildPaymentUrl,
  foldAscii,
  isVnpayConfigured,
  signVnpayParams,
  verifyCallback,
  vnpayMessage,
  type VnpayConfig,
} from "./vnpay.service.js";

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

// Khai riêng hai hằng (không đọc lại qua config.tmnCode/hashSecret): VnpayConfig khai chúng optional
// (chưa cấu hình thật thì để trống) nên TypeScript không tự biết ở ĐÂY chúng luôn có giá trị.
const TMN_CODE = "TESTCODE";
const HASH_SECRET = "TESTSECRET123456";

const config: VnpayConfig = {
  tmnCode: TMN_CODE,
  hashSecret: HASH_SECRET,
  payUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  returnUrl: "http://localhost:4000/api/payments/vnpay/return",
};

/** Đọc lại chuỗi truy vấn của một URL thành object phẳng, giống `req.query` của Express */
function parseQuery(url: string): Record<string, string> {
  const query = url.split("?")[1] ?? "";
  const params = new URLSearchParams(query);
  return Object.fromEntries(params.entries());
}

console.log("\n[1] Cấu hình");
{
  check("đủ hai khoá → đã cấu hình", isVnpayConfigured(config), true);
  check("thiếu hashSecret → chưa cấu hình", isVnpayConfigured({ tmnCode: "X" }), false);
  check("thiếu cả hai → chưa cấu hình", isVnpayConfigured({}), false);
}

console.log("\n[2] Dựng URL thanh toán");
const now = new Date("2026-09-22T08:00:00.000Z"); // 15:00 giờ VN
const url = buildPaymentUrl(config, { paymentId: "pay_abc123", amount: 1_990_000, orderCode: "PCZ20260922-0001", ip: "127.0.0.1", now });
const query = parseQuery(url);
{
  check("bắt đầu bằng payUrl đã cấu hình", url.startsWith(config.payUrl + "?"), true);
  check("vnp_TxnRef = paymentId", query.vnp_TxnRef, "pay_abc123");
  check("vnp_Amount nhân 100", query.vnp_Amount, "199000000");
  check("vnp_TmnCode đúng khoá", query.vnp_TmnCode, config.tmnCode);
  check("vnp_CreateDate theo giờ VN (UTC+7)", query.vnp_CreateDate, "20260922150000");
  check("vnp_ExpireDate cách 15 phút", query.vnp_ExpireDate, "20260922151500");
  check("vnp_OrderInfo đã bỏ dấu", query.vnp_OrderInfo.includes("don hang"), true);
  check("có vnp_SecureHash dạng hex 128 ký tự (SHA-512)", /^[0-9a-f]{128}$/.test(query.vnp_SecureHash), true);
  check("thiếu cấu hình → ném lỗi", (() => {
    try {
      buildPaymentUrl({ payUrl: config.payUrl, returnUrl: config.returnUrl }, { paymentId: "x", amount: 1000, orderCode: "X", ip: "127.0.0.1" });
      return "không ném lỗi";
    } catch {
      return "đã ném lỗi";
    }
  })(), "đã ném lỗi");
}

// VNPay tự tính chữ ký của RETURN/IPN trên đúng bộ tham số nó gửi về — khác bộ tham số của bước
// dựng URL thanh toán ở trên (có thêm vnp_BankCode, vnp_PayDate, vnp_ResponseCode...). Dựng một
// phản hồi giả bằng signVnpayParams để mô phỏng đúng việc VNPay tự ký, không tái dùng URL ở trên.
function fakeVnpayReturn(overrides: Record<string, string> = {}): Record<string, string> {
  const params: Record<string, string> = {
    vnp_Amount: "199000000",
    vnp_BankCode: "NCB",
    vnp_BankTranNo: "VNP14123456",
    vnp_CardType: "ATM",
    vnp_OrderInfo: "Thanh toan don hang PCZ20260922-0001",
    vnp_PayDate: "20260922150130",
    vnp_ResponseCode: "00",
    vnp_TmnCode: TMN_CODE,
    vnp_TransactionNo: "14123456",
    vnp_TransactionStatus: "00",
    vnp_TxnRef: "pay_abc123",
    ...overrides,
  };
  return { ...params, vnp_SecureHash: signVnpayParams(HASH_SECRET, params) };
}

console.log("\n[3] Xác minh return/IPN — VNPay tự ký bộ tham số nó gửi về");
{
  const result = verifyCallback(config.hashSecret, fakeVnpayReturn());
  check("chữ ký hợp lệ", result.signatureValid, true);
  check("nhận diện thành công (responseCode 00)", result.success, true);
  check("paymentId đọc lại đúng", result.paymentId, "pay_abc123");
  check("amount chia lại 100 đúng số tiền gốc", result.amount, 1_990_000);
  check("đọc được transactionNo / bankCode", [result.transactionNo, result.bankCode], ["14123456", "NCB"]);
}

console.log("\n[4] Phát hiện dữ liệu bị sửa / sai khoá");
{
  const signed = fakeVnpayReturn();

  const tampered = verifyCallback(config.hashSecret, { ...signed, vnp_Amount: "1" });
  check("đổi vnp_Amount sau khi ký → chữ ký sai", tampered.signatureValid, false);

  const wrongSecret = verifyCallback("khoa-sai", signed);
  check("xác minh bằng sai hash secret → chữ ký sai", wrongSecret.signatureValid, false);

  const noSecret = verifyCallback(undefined, signed);
  check("chưa cấu hình hash secret → chữ ký sai (không tin bừa)", noSecret.signatureValid, false);

  const missingHash = verifyCallback(config.hashSecret, { vnp_TxnRef: "pay_abc123", vnp_ResponseCode: "00" });
  check("thiếu hẳn vnp_SecureHash → chữ ký sai", missingHash.signatureValid, false);

  const failedTxn = fakeVnpayReturn({ vnp_ResponseCode: "24", vnp_TransactionStatus: "02" });
  const failedResult = verifyCallback(config.hashSecret, failedTxn);
  check("responseCode khác 00 → success = false dù chữ ký vẫn hợp lệ", [failedResult.signatureValid, failedResult.success], [true, false]);
}

console.log("\n[5] Thông điệp lỗi và bỏ dấu OrderInfo");
{
  check("mã 24 → khách huỷ giao dịch", vnpayMessage("24"), "Bạn đã huỷ giao dịch");
  check("mã lạ → thông điệp chung", vnpayMessage("xyz"), "Giao dịch không thành công");
  check("bỏ dấu tiếng Việt kèm đ/Đ", foldAscii("Đặt hàng đơn vị đo"), "Dat hang don vi do");
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
