import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Đọc SITE_URL lúc chạy (địa chỉ thật chỉ biết khi triển khai), không đóng băng giá trị lúc build
export const dynamic = "force-dynamic";

/**
 * Cho công cụ tìm kiếm đọc trang bán hàng; chặn khu quản trị, API và các trang riêng của từng khách (giỏ hàng, tài
 * khoản, đơn hàng, đăng nhập...) — những trang đó không có nội dung đáng lập chỉ mục. Trang tìm kiếm vốn đã `noindex`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/tai-khoan",
        "/gio-hang",
        "/thanh-toan",
        "/don-hang",
        "/yeu-thich",
        "/so-sanh",
        "/tim-kiem",
        "/dang-nhap",
        "/dang-ky",
        "/quen-mat-khau",
        "/dat-lai-mat-khau",
        "/xac-minh-email",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
