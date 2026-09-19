import type { Brand, Category } from "@/types";

/** 6 ô "Danh mục nổi bật" ngay dưới hero banner */
export const featuredCategories: Category[] = [
  {
    slug: "laptop-gaming",
    name: "Laptop Gaming",
    caption: "Từ 15.000.000đ",
    icon: "Gamepad2",
  },
  {
    slug: "laptop-van-phong",
    name: "Laptop Văn phòng",
    caption: "Từ 9.900.000đ",
    icon: "Laptop",
  },
  {
    slug: "pc-gaming",
    name: "PC Gaming",
    caption: "Tối ưu đồ họa",
    icon: "Monitor",
  },
  {
    slug: "pc-workstation",
    name: "PC Workstation",
    caption: "Render & AI Data",
    icon: "Server",
  },
  {
    slug: "cpu",
    name: "CPU – Vi xử lý",
    caption: "Intel & AMD Gen mới",
    icon: "Cpu",
  },
  {
    slug: "vga",
    name: "VGA – Card đồ họa",
    caption: "RTX 40 Series & RX",
    icon: "MemoryStick",
  },
];

/** Logo hãng ở section "Thương hiệu đồng hành chính hãng" */
export const partnerBrands: Brand[] = [
  { name: "ASUS ROG", label: "ROG", color: "#e01e37" },
  { name: "MSI", label: "MSI", color: "#c8102e" },
  { name: "GIGABYTE", label: "GIGABYTE", color: "#111827" },
  { name: "Intel", label: "intel", color: "#0068b5" },
  { name: "AMD", label: "AMD", color: "#111827" },
  { name: "NVIDIA", label: "NVIDIA", color: "#76b900" },
];
