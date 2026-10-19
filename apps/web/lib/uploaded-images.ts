/**
 * Ảnh quản trị tải lên LÚC ĐANG CHẠY (banner, API ghi vào `public/images/banners/`). Bản production của Next
 * (`next start`) chỉ phục vụ những file đã có trong `public/` lúc khởi động, nên bộ tối ưu ảnh `/_next/image` báo lỗi với
 * ảnh vừa tải lên cho tới khi khởi động lại web. Những ảnh này được tải thẳng (`unoptimized`): bản triển khai Docker để
 * Caddy đọc thẳng thư mục banner trên ổ lưu trữ chung (`deploy/Caddyfile`), còn chạy dev thì `next dev` tự phục vụ.
 *
 * Ảnh sản phẩm quản trị viên tải lên (`/images/products/uploads/`) thì không cần: web chuyển tiếp đường dẫn đó sang API
 * (next.config.ts), nên vẫn đi qua bộ tối ưu ảnh như ảnh sản phẩm của crawler.
 */
export function isRuntimeUpload(src: string): boolean {
  return src.startsWith("/images/banners/");
}
