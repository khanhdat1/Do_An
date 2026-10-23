/**
 * Kiểm thử thu hồi phiên tức thì (`session-revocation.ts`): token cấp trước lúc thu hồi bị từ chối, cấp sau thì dùng
 * được, bảng tự dọn khi mọi token cũ đã hết hạn. Hàm thuần (truyền mốc thời gian), không cần DB.
 * Chạy: npx tsx src/utils/session-revocation.test.ts
 */
import { ACCESS_TOKEN_TTL_SECONDS } from "../services/token.service.js";
import { clearSessionRevocations, isSessionRevoked, revokeSessionsOf } from "./session-revocation.js";

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

const T = Date.UTC(2026, 9, 23, 10, 0, 0);
const TTL_MS = ACCESS_TOKEN_TTL_SECONDS * 1000;

console.log("\n[1] Thu hồi theo thời điểm cấp token");
{
  clearSessionRevocations();
  check("tài khoản chưa từng bị thu hồi: token hợp lệ", isSessionRevoked("u1", T - 5_000, T), false);
  revokeSessionsOf("u1", T);
  check("token cấp trước lúc thu hồi: bị từ chối", isSessionRevoked("u1", T - 5_000, T + 1_000), true);
  check("token cấp trước đúng 1 ms: vẫn bị từ chối (đo bằng mili giây, không làm tròn giây)", isSessionRevoked("u1", T - 1, T + 1), true);
  check("token cấp sau lúc thu hồi (đăng nhập lại): dùng được", isSessionRevoked("u1", T + 300, T + 1_000), false);
  check("tài khoản khác không bị ảnh hưởng", isSessionRevoked("u2", T - 5_000, T + 1_000), false);
  check("token không rõ lúc cấp: coi như đã bị thu hồi", isSessionRevoked("u1", undefined, T + 1_000), true);
}

console.log("\n[2] Thu hồi lần nữa và tự dọn");
{
  clearSessionRevocations();
  revokeSessionsOf("u1", T);
  revokeSessionsOf("u1", T + 60_000);
  check("lần thu hồi sau thay mốc: token cấp giữa hai lần cũng bị từ chối", isSessionRevoked("u1", T + 30_000, T + 61_000), true);
  check("quá tuổi thọ access token: mọi token cũ đã tự hết hạn, bỏ dòng thu hồi", isSessionRevoked("u1", T, T + 60_000 + TTL_MS + 120_000), false);
  revokeSessionsOf("u3", T);
  revokeSessionsOf("u4", T + TTL_MS + 120_000);
  check("thu hồi tài khoản khác cũng dọn dòng đã quá hạn", isSessionRevoked("u3", T - 1, T + TTL_MS + 120_000), false);
  check("dòng mới vẫn còn hiệu lực", isSessionRevoked("u4", T, T + TTL_MS + 121_000), true);
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
