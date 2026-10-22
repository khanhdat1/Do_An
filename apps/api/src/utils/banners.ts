/**
 * Phần thuần (không DB, không đọc env) của banner trang chủ: đường dẫn công khai của ảnh tải lên và kiểm tra liên kết
 * khi bấm vào banner. Tách riêng để kiểm thử không cần DB/HTTP.
 */

/** Ảnh banner quản trị tải lên được phục vụ ở `/images/banners/<tên file>` (apps/api/src/app.ts + apps/web/next.config.ts) */
export const BANNER_PUBLIC_PREFIX = "/images/banners";

export const BANNER_LINK_MESSAGE =
  'Liên kết phải là đường dẫn trong trang bắt đầu bằng "/" (vd /danh-muc/laptop) hoặc địa chỉ đầy đủ bắt đầu bằng http:// hoặc https://';

/**
 * Liên kết banner hợp lệ: đường dẫn nội bộ bắt đầu bằng MỘT dấu "/", hoặc địa chỉ http(s) đầy đủ. Chặn `javascript:`,
 * `data:`... (chạy mã khi khách bấm) và các dạng trình duyệt hiểu thành "sang trang khác": "//evil.com", "/\evil.com"
 * (trình duyệt coi "\" như "/"), "/<tab>/evil.com" (trình duyệt bỏ tab/xuống dòng trong URL) — nên không nhận gạch ngược,
 * khoảng trắng hay ký tự điều khiển ở bất kỳ đâu.
 */
export function isSafeBannerLink(value: string): boolean {
  // eslint-disable-next-line no-control-regex -- cố ý tìm ký tự điều khiển
  if (/[\s\\\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
  } catch {
    return false;
  }
}
