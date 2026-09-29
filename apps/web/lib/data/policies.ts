/**
 * Các trang chính sách — dùng chung cho chân trang, sitemap và mục "Chính sách khác" cuối mỗi trang. Nội dung mô tả
 * đúng những gì hệ thống đang làm (dữ liệu thu thập, cách huỷ/hoàn đơn, phí vận chuyển...); điều khoản kinh doanh chưa
 * được chốt (thời hạn đổi trả, thời gian giao) cố ý không ghi con số.
 */
export const POLICY_PAGES = [
  { href: "/chinh-sach-bao-mat", label: "Chính sách bảo mật" },
  { href: "/dieu-khoan-su-dung", label: "Điều khoản sử dụng" },
  { href: "/chinh-sach-doi-tra-bao-hanh", label: "Đổi trả & bảo hành" },
  { href: "/chinh-sach-van-chuyen-thanh-toan", label: "Vận chuyển & thanh toán" },
] as const;

/** Sửa nội dung trang chính sách nào thì cập nhật lại ngày này */
export const POLICY_UPDATED_AT = "30/09/2026";
