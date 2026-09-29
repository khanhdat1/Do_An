// Kiểm thử phần thuần của cài đặt hệ thống (ghép mặc định, kiểm tra dữ liệu, phí vận chuyển theo cấu hình, phương
// thức thanh toán/tính năng AI dùng được, so sánh trước/sau) — không cần DB/mạng. Chạy: npx tsx src/settings/settings.test.ts
import type { SystemSettingsDto } from "../types/dto.js";
import { calcShippingFee } from "../utils/shipping.js";
import {
  availableAiFeatures,
  availablePaymentMethods,
  DEFAULT_SETTINGS,
  diffSettings,
  disabledAiFeatureMessage,
  disabledPaymentMessage,
  mergeWithDefaults,
  paymentSettingsProblem,
  systemSettingsSchema,
} from "./system-settings.js";

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

/** Bản sao sâu của mặc định để từng ca tự sửa mà không đụng vào DEFAULT_SETTINGS */
function defaults(): SystemSettingsDto {
  return structuredClone(DEFAULT_SETTINGS);
}

/** Lỗi đầu tiên zod báo cho một body (null = hợp lệ) */
function firstError(body: unknown): string | null {
  const parsed = systemSettingsSchema.safeParse(body);
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? "?");
}

console.log("\n[1] Mặc định = đúng các số đang viết cứng trước khi có trang cài đặt");
{
  check("hotline 1800 8888 (TopBar/ProductDescription/phiếu in)", DEFAULT_SETTINGS.store.hotline, "1800 8888");
  check("email support@pczone.vn", DEFAULT_SETTINGS.store.supportEmail, "support@pczone.vn");
  check("chưa có địa chỉ showroom (trước đây không nơi nào hiện)", DEFAULT_SETTINGS.store.showroomAddress, "");
  check("phí 30.000đ, miễn phí từ 500.000đ", DEFAULT_SETTINGS.shipping, { flatFee: 30_000, freeThreshold: 500_000 });
  check("mọi phương thức thanh toán đều bật", DEFAULT_SETTINGS.payments, { cod: true, vnpay: true, bankTransfer: true, momo: true });
  check("mọi tính năng AI đều bật", DEFAULT_SETTINGS.ai, { search: true, chat: true, build: true });
  check("mặc định tự qua được kiểm tra của chính nó", firstError(DEFAULT_SETTINGS), null);
}

console.log("\n[2] Ghép dữ liệu trong DB với mặc định");
{
  check("DB trống = y nguyên mặc định", mergeWithDefaults({}), DEFAULT_SETTINGS);
  check(
    "nhóm có đủ trường hợp lệ thì lấy hết",
    mergeWithDefaults({ shipping: { flatFee: 25_000, freeThreshold: 1_000_000 } }).shipping,
    { flatFee: 25_000, freeThreshold: 1_000_000 },
  );
  check(
    "thiếu một trường thì CHỈ trường đó về mặc định",
    mergeWithDefaults({ shipping: { flatFee: 15_000 } }).shipping,
    { flatFee: 15_000, freeThreshold: 500_000 },
  );
  check(
    "trường sai kiểu / vượt giới hạn về mặc định, trường đúng giữ nguyên",
    mergeWithDefaults({ shipping: { flatFee: "abc", freeThreshold: 200_000_000 }, payments: { cod: false, momo: "yes" } }),
    { ...defaults(), payments: { cod: false, vnpay: true, bankTransfer: true, momo: true } },
  );
  check(
    "email hỏng trong DB về mặc định, hotline hợp lệ vẫn giữ (có cắt khoảng trắng)",
    mergeWithDefaults({ store: { hotline: "  1900 1234 ", supportEmail: "khong-phai-email" } }).store,
    { hotline: "1900 1234", supportEmail: "support@pczone.vn", showroomAddress: "" },
  );
  check("giá trị của nhóm là mảng / chuỗi / null thì bỏ qua cả nhóm", mergeWithDefaults({ ai: [false], store: "x", payments: null }), DEFAULT_SETTINGS);
  check("khoá lạ trong DB bị bỏ qua", mergeWithDefaults({ other: { a: 1 }, ai: { chat: false, extra: 1 } }).ai, { search: true, chat: false, build: true });
  const merged = mergeWithDefaults({});
  merged.store.hotline = "đã sửa";
  check("kết quả ghép là bản mới, sửa nó không làm hỏng DEFAULT_SETTINGS", DEFAULT_SETTINGS.store.hotline, "1800 8888");
}

console.log("\n[3] Kiểm tra body PUT /api/admin/settings");
{
  const body = defaults();
  body.shipping.flatFee = -1;
  check("phí âm bị chặn", firstError(body), "Phí vận chuyển không được âm");
  body.shipping.flatFee = 1_000_001;
  check("phí > 1.000.000đ bị chặn", firstError(body), "Phí vận chuyển tối đa 1.000.000đ");
  body.shipping.flatFee = 1_000_000;
  check("phí đúng 1.000.000đ được nhận", firstError(body), null);
  body.shipping.flatFee = 15_000.5;
  check("phí lẻ (không phải số nguyên đồng) bị chặn", firstError(body), "Phí vận chuyển phải là số nguyên (đồng)");
}
{
  const body = defaults();
  body.shipping.freeThreshold = 100_000_001;
  check("ngưỡng > 100.000.000đ bị chặn", firstError(body), "Ngưỡng miễn phí vận chuyển tối đa 100.000.000đ");
  body.shipping.freeThreshold = 0;
  check("ngưỡng 0 (miễn phí mọi đơn) được nhận", firstError(body), null);
  check(
    "số gửi dạng chuỗi bị chặn (không tự ép kiểu)",
    firstError({ ...defaults(), shipping: { flatFee: "30000", freeThreshold: 500_000 } }),
    "Phí vận chuyển phải là một số",
  );
}
{
  const withStore = (store: Partial<SystemSettingsDto["store"]>) => ({ ...defaults(), store: { ...DEFAULT_SETTINGS.store, ...store } });
  check("hotline rỗng bị chặn", firstError(withStore({ hotline: "   " })), "Hotline không được để trống");
  check("hotline có chữ cái bị chặn", firstError(withStore({ hotline: "1800 abc" })), "Hotline chỉ gồm chữ số, dấu cách và các ký tự + . - ( )");
  check("hotline quá ít chữ số bị chặn", firstError(withStore({ hotline: "+ 1" })), "Hotline phải có ít nhất 3 chữ số");
  check("hotline kiểu (+84) 28.1234-5678 được nhận", firstError(withStore({ hotline: "(+84) 28.1234-5678" })), null);
  check("email sai định dạng bị chặn", firstError(withStore({ supportEmail: "support@" })), "Email hỗ trợ không hợp lệ");
  check("địa chỉ > 300 ký tự bị chặn", firstError(withStore({ showroomAddress: "a".repeat(301) })), "Địa chỉ showroom tối đa 300 ký tự");
  check("địa chỉ để trống được nhận", firstError(withStore({ showroomAddress: "" })), null);
  const parsed = systemSettingsSchema.parse({ ...withStore({ hotline: " 1800 8888 ", supportEmail: " cskh@pczone.vn " }), extra: 1 });
  check("cắt khoảng trắng hotline/email, bỏ khoá lạ", [parsed.store.hotline, parsed.store.supportEmail, "extra" in parsed], ["1800 8888", "cskh@pczone.vn", false]);
}
{
  const { ai: _ai, ...withoutAi } = defaults();
  check("thiếu hẳn một nhóm bị chặn", firstError(withoutAi) !== null, true);
  check("bật/tắt không phải boolean bị chặn", firstError({ ...defaults(), payments: { ...DEFAULT_SETTINGS.payments, cod: "true" } }), "Giá trị bật/tắt không hợp lệ");
}

console.log("\n[4] Phí vận chuyển theo cấu hình (API tính lại lúc tạo đơn, web xem trước bằng cùng công thức)");
{
  const standard = { flatFee: 30_000, freeThreshold: 500_000 };
  check("giỏ trống = 0đ", calcShippingFee(0, standard), 0);
  check("dưới ngưỡng thu phí cố định", calcShippingFee(499_999, standard), 30_000);
  check("ĐÚNG bằng ngưỡng thì miễn phí", calcShippingFee(500_000, standard), 0);
  check("trên ngưỡng miễn phí", calcShippingFee(12_000_000, standard), 0);
  check("đổi số: phí 45.000đ, ngưỡng 2.000.000đ", [calcShippingFee(1_999_999, { flatFee: 45_000, freeThreshold: 2_000_000 }), calcShippingFee(2_000_000, { flatFee: 45_000, freeThreshold: 2_000_000 })], [45_000, 0]);
  check("ngưỡng 0 = mọi đơn miễn phí", calcShippingFee(10_000, { flatFee: 30_000, freeThreshold: 0 }), 0);
  check("phí 0 = không bao giờ thu phí", calcShippingFee(10_000, { flatFee: 0, freeThreshold: 500_000 }), 0);
}

console.log("\n[5] Phương thức thanh toán: dùng được = đang bật VÀ đã cấu hình trong .env");
{
  const configured = { cod: true, vnpay: false, bankTransfer: true, momo: true };
  check("mặc định: chỉ thiếu VNPay (chưa cấu hình)", availablePaymentMethods(DEFAULT_SETTINGS.payments, configured), configured);
  check(
    "tắt MoMo thì MoMo không dùng được dù đã cấu hình",
    availablePaymentMethods({ ...DEFAULT_SETTINGS.payments, momo: false }, configured),
    { cod: true, vnpay: false, bankTransfer: true, momo: false },
  );
  check("bật VNPay cũng vô ích khi chưa cấu hình", availablePaymentMethods({ cod: false, vnpay: true, bankTransfer: false, momo: false }, configured).vnpay, false);
  check("phương thức đang bật: không có lỗi", disabledPaymentMessage(DEFAULT_SETTINGS.payments, "COD"), null);
  check(
    "phương thức đang tắt: câu báo rõ tên phương thức",
    disabledPaymentMessage({ ...DEFAULT_SETTINGS.payments, bankTransfer: false }, "BANK_TRANSFER"),
    "Phương thức Chuyển khoản ngân hàng đang tạm tắt. Vui lòng chọn phương thức thanh toán khác.",
  );
  check("còn ít nhất một phương thức dùng được: lưu được", paymentSettingsProblem({ cod: false, vnpay: false, bankTransfer: true, momo: false }, configured), null);
  check(
    "tắt hết: chặn lưu",
    paymentSettingsProblem({ cod: false, vnpay: false, bankTransfer: false, momo: false }, configured),
    "Phải bật ít nhất một phương thức thanh toán đã được cấu hình, nếu không khách sẽ không đặt hàng được.",
  );
  check(
    "chỉ bật đúng phương thức CHƯA cấu hình: cũng chặn lưu",
    paymentSettingsProblem({ cod: false, vnpay: true, bankTransfer: false, momo: false }, configured) !== null,
    true,
  );
}

console.log("\n[6] Tính năng AI: dùng được = đang bật VÀ đã có khoá AI");
{
  check("đã cấu hình + bật hết", availableAiFeatures(DEFAULT_SETTINGS.ai, true), { search: true, chat: true, build: true });
  check("tắt riêng chat", availableAiFeatures({ search: true, chat: false, build: true }, true), { search: true, chat: false, build: true });
  check("chưa có khoá AI thì bật cũng không dùng được", availableAiFeatures(DEFAULT_SETTINGS.ai, false), { search: false, chat: false, build: false });
  check("câu báo 503 của chat", disabledAiFeatureMessage("chat"), "Tính năng Trợ lý AI đang tạm tắt.");
  check("câu báo 503 của AI gợi ý cấu hình", disabledAiFeatureMessage("build"), "Tính năng AI gợi ý cấu hình đang tạm tắt.");
}

console.log("\n[7] So sánh trước/sau cho nhật ký thao tác");
{
  check("không đổi gì = không có nhóm nào cần ghi", diffSettings(defaults(), defaults()).changedGroups, []);
  const after = defaults();
  after.shipping.flatFee = 25_000;
  after.ai.chat = false;
  after.store.showroomAddress = "123 Đường Số 1, Quận 1, TP.HCM";
  const diff = diffSettings(defaults(), after);
  check("liệt kê đúng các trường đã đổi (theo thứ tự nhóm)", diff.changedKeys, ["store.showroomAddress", "shipping.flatFee", "ai.chat"]);
  check("chỉ các nhóm có đổi mới được ghi lại", diff.changedGroups, ["store", "shipping", "ai"]);
  check("trước: chỉ giữ giá trị cũ của trường đã đổi", diff.before, { store: { showroomAddress: "" }, shipping: { flatFee: 30_000 }, ai: { chat: true } });
  check("sau: giá trị mới tương ứng", diff.after, { store: { showroomAddress: "123 Đường Số 1, Quận 1, TP.HCM" }, shipping: { flatFee: 25_000 }, ai: { chat: false } });
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
