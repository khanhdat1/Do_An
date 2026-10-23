import { ACCESS_TOKEN_TTL_SECONDS } from "../services/token.service.js";

/**
 * Đăng xuất NGAY một tài khoản khách hàng (quản trị khoá tài khoản, cấp lại mật khẩu, xoá tài khoản).
 *
 * Xoá refresh token trong DB chỉ chặn được lần làm mới phiên kế tiếp — access token đã cấp vẫn còn dùng được tới
 * khi hết hạn (tối đa `ACCESS_TOKEN_TTL_SECONDS`), vì `authenticate` không tra DB mỗi request. Bảng nhớ dưới đây
 * lấp khoảng trống đó: ghi lại "tài khoản X bị thu hồi phiên lúc T", và `authenticate` từ chối mọi access token của
 * X cấp TRƯỚC T. Token cấp sau T (đăng nhập lại sau khi mở khoá / bằng mật khẩu mới) vẫn dùng bình thường.
 *
 * Nằm trong bộ nhớ của MỘT tiến trình API, cùng kiểu với bộ đệm cài đặt và chỉ mục tìm kiếm: chạy nhiều tiến trình,
 * hoặc API vừa khởi động lại, thì tiến trình chưa ghi nhận chỉ chặn được ở lần làm mới phiên (vẫn tối đa 15 phút).
 * Mỗi dòng chỉ cần giữ bằng tuổi thọ access token — quá hạn đó mọi token cấp trước T đều đã tự hết hạn.
 */
const revokedAtByUser = new Map<string, number>();

/** Giữ thêm một chút so với tuổi thọ token, bù lệch giờ giữa lúc ký và lúc kiểm */
const RETENTION_MS = (ACCESS_TOKEN_TTL_SECONDS + 60) * 1000;

function pruneExpired(nowMs: number): void {
  for (const [userId, revokedAt] of revokedAtByUser) {
    if (nowMs - revokedAt > RETENTION_MS) revokedAtByUser.delete(userId);
  }
}

/** Mọi access token của `userId` cấp từ trước thời điểm này trở thành vô hiệu */
export function revokeSessionsOf(userId: string, nowMs: number = Date.now()): void {
  pruneExpired(nowMs);
  revokedAtByUser.set(userId, nowMs);
}

/** `issuedAtMs` thiếu (token lạ, không rõ lúc cấp) thì coi như đã bị thu hồi nếu tài khoản đang trong bảng */
export function isSessionRevoked(userId: string, issuedAtMs: number | undefined, nowMs: number = Date.now()): boolean {
  const revokedAt = revokedAtByUser.get(userId);
  if (revokedAt === undefined) return false;
  if (nowMs - revokedAt > RETENTION_MS) {
    revokedAtByUser.delete(userId);
    return false;
  }
  return issuedAtMs === undefined || issuedAtMs < revokedAt;
}

/** Chỉ dùng trong kiểm thử */
export function clearSessionRevocations(): void {
  revokedAtByUser.clear();
}
