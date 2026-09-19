/**
 * Các hàm format hiển thị cho thị trường Việt Nam.
 * Tách riêng để dùng lại ở trang danh sách, chi tiết, giỏ hàng...
 */

/** 41990000 -> "41.990.000đ" */
export function formatPrice(value: number): string {
  return `${value.toLocaleString("vi-VN")}đ`;
}

/** Tính % giảm giá, làm tròn xuống. Trả về 0 nếu không có giá gốc. */
export function discountPercent(price: number, oldPrice?: number): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.floor(((oldPrice - price) / oldPrice) * 100);
}

/** 1842 -> "1.842" */
export function formatNumber(value: number): string {
  return value.toLocaleString("vi-VN");
}

/** Ghép giây thành cặp số 2 chữ số cho đồng hồ đếm ngược */
export function splitCountdown(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return { hours: pad(hours), minutes: pad(minutes), seconds: pad(seconds) };
}
