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

/**
 * Hãng có sản phẩm đang bán tại PCZone (tìm theo từ khoá đều ra kết quả). Logo lấy từ Wikimedia Commons — public domain,
 * riêng NVIDIA theo Apache-2.0; tên và logo là nhãn hiệu thuộc sở hữu của từng hãng.
 */
export const partnerBrands: Brand[] = [
  { name: "ASUS ROG", logo: "/images/brands/rog.svg", width: 500, height: 500, query: "ROG" },
  { name: "MSI", logo: "/images/brands/msi.svg", width: 800, height: 232, query: "MSI" },
  { name: "GIGABYTE", logo: "/images/brands/gigabyte.svg", width: 626, height: 135, query: "GIGABYTE" },
  { name: "Intel", logo: "/images/brands/intel.svg", width: 395, height: 156, query: "Intel" },
  { name: "AMD", logo: "/images/brands/amd.svg", width: 800, height: 191, query: "AMD" },
  { name: "NVIDIA", logo: "/images/brands/nvidia.svg", width: 656, height: 120, query: "NVIDIA" },
];
