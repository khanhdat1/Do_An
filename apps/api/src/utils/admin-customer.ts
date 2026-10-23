import { randomInt } from "node:crypto";
import type { OrderStatus } from "@pczone/db";

/**
 * Phần THUẦN của quản lý khách hàng ở khu quản trị (không DB) — tách ra để kiểm thử: mã khách hàng hiển thị, mật khẩu
 * tạm khi quản trị cấp lại, điều kiện được xoá tài khoản. Xem admin-customer.service.ts.
 */

/**
 * Mã khách hàng hiển thị ("KH8F3K2Q"): 6 ký tự cuối của id (cuid — phần cuối là ngẫu nhiên, không lộ thứ tự đăng ký
 * như số tự tăng). Chỉ để nhân viên đọc/đối chiếu nhanh; tra cứu chính xác vẫn theo id trong đường dẫn.
 */
export function customerCode(id: string): string {
  return `KH${id.slice(-6).toUpperCase()}`;
}

/** Bỏ ký tự dễ đọc nhầm khi quản trị đọc mật khẩu cho khách qua điện thoại: 0/O/o, 1/l/I */
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
export const TEMP_PASSWORD_LENGTH = 12;

/**
 * Mật khẩu tạm 12 ký tự sinh bằng crypto, luôn có cả chữ và số (đúng luật `newPasswordSchema`). `pick` để kiểm thử
 * truyền nguồn ngẫu nhiên cố định.
 */
export function generateTemporaryPassword(pick: (max: number) => number = randomInt): string {
  const all = LETTERS + DIGITS;
  const chars = [LETTERS[pick(LETTERS.length)], DIGITS[pick(DIGITS.length)]];
  while (chars.length < TEMP_PASSWORD_LENGTH) chars.push(all[pick(all.length)]);
  // Trộn để chữ và số bắt buộc không luôn nằm ở hai vị trí đầu (Fisher–Yates)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** Đơn chưa xong — xoá tài khoản lúc này thì khách mất trang theo dõi đơn đang giao/đang chờ */
export const OPEN_ORDER_STATUSES = ["PENDING", "CONFIRMED", "PACKING", "SHIPPING"] as const satisfies readonly OrderStatus[];

/** `null` = được xoá; ngược lại là lý do từ chối (409) */
export function deleteBlockReason(openOrderCount: number): string | null {
  if (openOrderCount <= 0) return null;
  return `Khách hàng còn ${openOrderCount} đơn đang xử lý. Hãy hoàn tất hoặc huỷ các đơn này trước khi xoá tài khoản.`;
}
