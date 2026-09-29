import { POLICY_PAGES } from "@/lib/data/policies";
import type { NavItem } from "@/types";

/**
 * Menu chính nằm trên thanh navigation tối.
 * `icon` là tên icon của lucide-react, được map trong components/layout/Navbar.tsx
 */
export const mainNav: NavItem[] = [
  { label: "Laptop", href: "/danh-muc/laptop", icon: "Laptop" },
  { label: "PC Lắp ráp", href: "/danh-muc/pc", icon: "Monitor" },
  // Trang cha: chọn tiếp CPU, VGA, Mainboard, RAM, SSD, Nguồn, Case bằng ô danh mục con ở đầu trang
  { label: "Linh kiện PC", href: "/danh-muc/linh-kien", icon: "Cpu" },
  { label: "Màn hình", href: "/danh-muc/man-hinh", icon: "MonitorSmartphone" },
  { label: "Gaming Gear", href: "/danh-muc/gaming-gear", icon: "Keyboard" },
];

/** Các link nhỏ ở thanh trên cùng (top bar) — chỉ trỏ tới trang có thật; `icon` phải nằm trong bảng icon của TopBar.tsx */
export const topBarLinks: NavItem[] = [
  { label: "Tra cứu đơn hàng", href: "/tra-cuu-don-hang", icon: "ShieldCheck" },
  { label: "Mã khuyến mãi", href: "/khuyen-mai", icon: "BadgeCheck" },
];

/** Cột link trong footer — chỉ trang có thật (chưa có trang giới thiệu/tin tức nên không đặt link chết) */
export const footerColumns = [
  {
    title: "Khám phá",
    links: [
      { label: "Danh mục sản phẩm", href: "/danh-muc" },
      { label: "Build PC & AI gợi ý cấu hình", href: "/ai-build-pc" },
      { label: "Trợ lý AI tư vấn", href: "/tro-ly-ai" },
      { label: "So sánh sản phẩm", href: "/so-sanh" },
    ],
  },
  {
    title: "Mua sắm",
    links: [
      { label: "Tra cứu đơn hàng", href: "/tra-cuu-don-hang" },
      { label: "Mã khuyến mãi", href: "/khuyen-mai" },
      { label: "Sản phẩm yêu thích", href: "/yeu-thich" },
      { label: "Giỏ hàng", href: "/gio-hang" },
    ],
  },
  {
    title: "Chính sách",
    links: POLICY_PAGES.map((page) => ({ label: page.label, href: page.href })),
  },
];
