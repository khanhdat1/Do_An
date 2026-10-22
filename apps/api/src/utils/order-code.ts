import { randomInt } from "node:crypto";

/** "PCZ20260919" — tiền tố theo ngày (giờ máy chủ, đủ dùng cho một mã hiển thị) */
function todayPrefix(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `PCZ${y}${m}${d}`;
}

/** Chữ và số dễ đọc qua điện thoại: bỏ 0/O, 1/I/L để khách đọc mã cho tổng đài không nhầm */
export const ORDER_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const ORDER_CODE_SUFFIX_LENGTH = 6;

/**
 * Sinh mã đơn hiển thị cho khách, dạng "PCZ20260919-7K4Q9M": tiền tố theo ngày + 6 ký tự NGẪU NHIÊN (crypto).
 * Trước đây phần đuôi là số thứ tự trong ngày ("-0001", "-0002"…) nên đoán được mã đơn của người khác — mà tra cứu
 * đơn công khai chỉ cần mã đơn + số điện thoại. 31^6 ≈ 887 triệu khả năng mỗi ngày; trùng (cực hiếm) thì
 * `Order.create` báo lỗi trùng khoá và `order.service.ts` sinh mã khác. Mã cũ dạng số thứ tự vẫn tra cứu bình thường.
 */
export function generateOrderCode(now: Date = new Date()): string {
  let suffix = "";
  for (let i = 0; i < ORDER_CODE_SUFFIX_LENGTH; i++) {
    suffix += ORDER_CODE_ALPHABET[randomInt(ORDER_CODE_ALPHABET.length)];
  }
  return `${todayPrefix(now)}-${suffix}`;
}
