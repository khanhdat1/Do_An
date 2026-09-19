import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * Ảnh sản phẩm theo kế hoạch là tự host: crawler tải về
     * `apps/web/public/images/products/` nên dùng đường dẫn nội bộ (`/images/...`)
     * — không cần khai báo gì ở đây.
     *
     * Danh sách dưới đây chỉ để tạm dùng ảnh từ trang hãng trong lúc phát triển.
     * Khi đã tải hết ảnh về, xoá phần này đi cho chặt.
     */
    remotePatterns: [
      { protocol: "https", hostname: "**.asus.com" },
      { protocol: "https", hostname: "**.gigabyte.com" },
      { protocol: "https", hostname: "**.msi.com" },
      { protocol: "https", hostname: "**.asrock.com" },
    ],
  },
};

export default nextConfig;
