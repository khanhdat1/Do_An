/**
 * Địa chỉ gốc công khai của trang, không có "/" ở cuối — dùng cho sitemap, robots.txt và `metadataBase` (link tuyệt đối
 * của ảnh chia sẻ mạng xã hội). Bản triển khai Docker đặt `SITE_URL` = `PUBLIC_URL` (deploy/docker-compose.yml, cả lúc
 * build lẫn lúc chạy); chạy dev để trống thì dùng địa chỉ dev mặc định.
 */
export function siteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}
