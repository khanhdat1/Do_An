import type { NextConfig } from "next";

// `||` chứ không `??`: NEXT_PUBLIC_API_URL có thể cố ý để rỗng, không được để proxy trỏ về chính nó
const apiUrl = process.env.API_URL || "http://localhost:4000";

const nextConfig: NextConfig = {
  // Cho phép mở bản dev qua link chia sẻ tạm của Cloudflare Tunnel (README mục 3)
  allowedDevOrigins: ["*.trycloudflare.com"],
  // Không quảng cáo công nghệ phía sau (header "X-Powered-By: Next.js")
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Trình duyệt không được đoán lại kiểu nội dung (vd coi một file ảnh là HTML)
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Chống clickjacking: trang khác không được nhúng PCZone vào iframe (web không tự nhúng chính mình ở đâu)
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // Không gửi đường dẫn đầy đủ (có thể chứa mã đơn, ?next=...) sang trang khác khi khách bấm link ra ngoài
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Web không dùng camera/micro/vị trí — tắt hẳn để mã lạ (nếu có) cũng không xin được quyền
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  experimental: {
    // Mặc định 30 s — AI gợi ý cấu hình (có thể gọi AI 2 lượt) đi qua proxy dưới đây có thể lâu hơn
    proxyTimeout: 120_000,
  },
  async rewrites() {
    // NEXT_PUBLIC_API_URL để rỗng thì trình duyệt gọi /api/* ngay trên địa chỉ của web, Next chuyển tiếp
    // sang API — chỉ cần chia sẻ MỘT địa chỉ, cookie đăng nhập/giỏ hàng vẫn cùng tên miền
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
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
