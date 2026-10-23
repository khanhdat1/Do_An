/**
 * Kiểm thử phần thuần của quản lý khách hàng ở khu quản trị (`admin-customer.ts`): mã khách hàng, mật khẩu tạm khi cấp
 * lại, điều kiện được xoá tài khoản. Hàm thuần, không cần DB. Chạy: npx tsx src/utils/admin-customer.test.ts
 */
import { newPasswordSchema } from "./validators.js";
import { customerCode, deleteBlockReason, generateTemporaryPassword, OPEN_ORDER_STATUSES, TEMP_PASSWORD_LENGTH } from "./admin-customer.js";

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

console.log("\n[1] Mã khách hàng");
{
  check("KH + 6 ký tự cuối của id, viết hoa", customerCode("cmvkqkzjc00314eiqai5y9chq"), "KH5Y9CHQ");
  check("luôn 8 ký tự", customerCode("cmvaoop7c00234eyhuxgwqckz").length, 8);
  check("cùng id thì cùng mã (ổn định giữa các lần tải trang)", customerCode("abc123def456"), customerCode("abc123def456"));
}

console.log("\n[2] Mật khẩu tạm");
{
  const samples = Array.from({ length: 500 }, () => generateTemporaryPassword());
  check(`đúng ${TEMP_PASSWORD_LENGTH} ký tự`, samples.every((value) => value.length === TEMP_PASSWORD_LENGTH), true);
  check("luôn qua luật mật khẩu của hệ thống (có chữ và số, ≥ 8 ký tự)", samples.every((value) => newPasswordSchema.safeParse(value).success), true);
  check("không có ký tự dễ đọc nhầm 0/O/o/1/l/I", samples.some((value) => /[0Oo1lI]/.test(value)), false);
  check("500 mật khẩu không trùng nhau", new Set(samples).size, samples.length);
  // Nguồn ngẫu nhiên luôn trả 0: vẫn phải có cả chữ lẫn số nhờ hai ký tự bắt buộc
  const worst = generateTemporaryPassword(() => 0);
  check("nguồn ngẫu nhiên xấu nhất vẫn có chữ", /[A-Za-z]/.test(worst), true);
  check("nguồn ngẫu nhiên xấu nhất vẫn có số", /\d/.test(worst), true);
}

console.log("\n[3] Điều kiện xoá tài khoản");
{
  check("không còn đơn đang xử lý thì được xoá", deleteBlockReason(0), null);
  check("còn đơn đang xử lý thì từ chối, nêu số đơn", deleteBlockReason(2)?.includes("còn 2 đơn đang xử lý"), true);
  check("đơn chưa xong gồm chờ xác nhận → đang giao", [...OPEN_ORDER_STATUSES], ["PENDING", "CONFIRMED", "PACKING", "SHIPPING"]);
  check("đơn đã giao/huỷ/hoàn trả không chặn xoá", ["DELIVERED", "CANCELLED", "RETURNED"].some((status) => (OPEN_ORDER_STATUSES as readonly string[]).includes(status)), false);
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
