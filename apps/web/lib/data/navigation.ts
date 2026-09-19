import type { NavItem } from "@/types";

/**
 * Menu chính nằm trên thanh navigation tối.
 * `icon` là tên icon của lucide-react, được map trong components/layout/Navbar.tsx
 */
export const mainNav: NavItem[] = [
  { label: "Laptop Hi-End", href: "/laptop", icon: "Laptop" },
  { label: "PC Gaming", href: "/pc-gaming", icon: "Monitor" },
  { label: "CPU & GPU", href: "/linh-kien", icon: "Cpu" },
  { label: "Mainboard & RAM", href: "/mainboard-ram", icon: "CircuitBoard" },
  { label: "Màn hình", href: "/man-hinh", icon: "MonitorSmartphone" },
  { label: "Gaming Gear", href: "/gaming-gear", icon: "Keyboard" },
];

/** Các link nhỏ ở thanh trên cùng (top bar) */
export const topBarLinks: NavItem[] = [
  { label: "Hệ thống Showroom VIP", href: "/showroom", icon: "Store" },
  { label: "Tra cứu bảo hành điện tử", href: "/bao-hanh", icon: "ShieldCheck" },
  { label: "100% Chính hãng phân phối", href: "/chinh-hang", icon: "BadgeCheck" },
];

/** Cột link trong footer */
export const footerColumns = [
  {
    title: "Về PCZone",
    links: [
      { label: "Giới thiệu thương hiệu", href: "/gioi-thieu" },
      { label: "Hệ thống 18 cửa hàng", href: "/showroom" },
      { label: "Tuyển dụng kỹ sư", href: "/tuyen-dung" },
      { label: "Tin tức công nghệ", href: "/tin-tuc" },
    ],
  },
  {
    title: "Chính sách VIP",
    links: [
      { label: "Bảo hành On-site 24/7", href: "/chinh-sach/bao-hanh" },
      { label: "Chính sách 1 đổi 1 trong 30 ngày", href: "/chinh-sach/doi-tra" },
      { label: "Vận chuyển hỏa tốc 2 giờ", href: "/chinh-sach/van-chuyen" },
      { label: "Chính sách bảo mật", href: "/chinh-sach/bao-mat" },
    ],
  },
];
