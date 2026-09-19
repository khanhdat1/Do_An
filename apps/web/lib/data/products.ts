import type { Product } from "@/types";

/**
 * DỮ LIỆU DỰ PHÒNG (fallback).
 *
 * Trang chủ lấy dữ liệu thật từ Express API qua `lib/api.ts`. Khi API chưa
 * chạy (chưa bật MySQL hoặc chưa `npm run dev:api`), các mảng dưới đây được
 * dùng tạm để giao diện vẫn render được thay vì trắng trang.
 *
 * Nội dung ở đây trùng với `packages/db/prisma/seed.ts` — sửa seed thì sửa
 * luôn file này cho khớp.
 */

/* -------------------------------------------------------------------------- */
/*  Flash Sale                                                                */
/* -------------------------------------------------------------------------- */
export const flashSaleProducts: Product[] = [
  {
    id: "fs-01",
    slug: "laptop-asus-rog-strix-g16-g614jir",
    name: "Laptop ASUS ROG Strix G16 G614JIR",
    specs: ["i9-14900HX", "RTX 4070"],
    price: 41_990_000,
    oldPrice: 49_990_000,
    rating: 5.0,
    reviewCount: 47,
    categorySlug: "laptop-gaming",
    categoryPath: ["laptop", "laptop-gaming"],
    tag: { label: "Quà tặng 3 triệu", tone: "amber" },
    stock: { sold: 80, total: 90, note: "Gần cháy hàng", urgent: true },
  },
  {
    id: "fs-02",
    slug: "pc-gaming-pczone-ultra-master-g7",
    name: "PC Gaming PCZone Ultra Master G7",
    specs: ["Ryzen 7 7800X3D", "RTX 4080 Super"],
    price: 54_900_000,
    oldPrice: 62_500_000,
    rating: 4.9,
    reviewCount: 31,
    categorySlug: "pc-gaming",
    categoryPath: ["pc", "pc-gaming"],
    tag: { label: "Trả góp 0%", tone: "green" },
    stock: { sold: 19, total: 24, note: "Còn 5 suất", urgent: true },
  },
  {
    id: "fs-03",
    slug: "card-man-hinh-asus-tuf-rtx-4070-ti-super",
    name: "Card màn hình ASUS TUF RTX 4070 Ti SUPER",
    specs: ["16GB GDDR6X", "DLSS 3.5"],
    price: 23_490_000,
    oldPrice: 26_990_000,
    rating: 4.9,
    reviewCount: 86,
    categorySlug: "vga",
    categoryPath: ["linh-kien", "vga"],
    tag: { label: "Freeship 600K", tone: "amber" },
    stock: { sold: 45, total: 50, note: "Sắp hết hàng", urgent: true },
  },
  {
    id: "fs-04",
    slug: "cpu-amd-ryzen-7-9700x",
    name: "CPU AMD Ryzen 7 9700X AM5 Zen 5",
    specs: ["8C/16T", "Up 5.5GHz"],
    price: 9_290_000,
    oldPrice: 10_990_000,
    rating: 5.0,
    reviewCount: 19,
    categorySlug: "cpu",
    categoryPath: ["linh-kien", "cpu"],
    tag: { label: "Bảo hành 36T", tone: "blue" },
    stock: { sold: 40, total: 46, note: "Còn 6 cái", urgent: false },
  },
  {
    id: "fs-05",
    slug: "man-hinh-samsung-odyssey-oled-g8",
    name: "Màn hình Samsung Odyssey OLED G8",
    specs: ["34\" OLED UWQHD", "175Hz 0.03ms"],
    price: 23_990_000,
    oldPrice: 28_990_000,
    rating: 4.8,
    reviewCount: 64,
    categorySlug: "man-hinh",
    categoryPath: ["man-hinh"],
    tag: { label: "Giá sốc", tone: "red" },
    stock: { sold: 27, total: 30, note: "Còn 3 chiếc", urgent: true },
  },
];

/* -------------------------------------------------------------------------- */
/*  Sản phẩm nổi bật                                                          */
/* -------------------------------------------------------------------------- */

/** Các tab lọc phía trên lưới "Sản phẩm nổi bật" */
export const featuredTabs = [
  { slug: "all", label: "Tất cả" },
  { slug: "laptop", label: "Laptop & Gaming" },
  { slug: "pc", label: "PC Hi-End" },
  { slug: "vga", label: "VGA RTX 40 Series" },
  { slug: "man-hinh", label: "Màn hình OLED 4K" },
  { slug: "gaming-gear", label: "Bàn phím cơ & Gear" },
];

export const featuredProducts: Product[] = [
  {
    id: "ft-01",
    slug: "laptop-lenovo-legion-pro-7i-gen-9",
    name: "Laptop Lenovo Legion Pro 7i Gen 9",
    summary: "32GB DDR5 • 1TB NVMe PCIe 4.0 • Màn 240Hz",
    specs: ["i9-14900HX", "RTX 4080"],
    price: 68_990_000,
    oldPrice: 74_990_000,
    rating: 5.0,
    reviewCount: 63,
    categorySlug: "laptop-gaming",
    categoryPath: ["laptop", "laptop-gaming"],
    tag: { label: "Nổi bật", tone: "amber" },
    gift: "Tặng Balo Legion 2.5tr",
  },
  {
    id: "ft-02",
    slug: "pc-gaming-pczone-dragon-knight",
    name: "PC Gaming PCZone Dragon Knight",
    summary: "32GB DDR5 • AIO 360 ARGB • Nguồn 850W Gold",
    specs: ["i7-14700K", "RTX 4070 Ti Super"],
    price: 45_990_000,
    oldPrice: 51_500_000,
    rating: 4.9,
    reviewCount: 24,
    categorySlug: "pc-gaming",
    categoryPath: ["pc", "pc-gaming"],
    tag: { label: "Bán chạy", tone: "red" },
    gift: "Tặng Chuột & Pad Master VIP",
  },
  {
    id: "ft-03",
    slug: "gigabyte-rtx-4080-super-gaming-oc-16gb",
    name: "GIGABYTE RTX 4080 SUPER Gaming OC 16GB",
    summary: "Tối ưu AI Generation • Dual BIOS • WINDFORCE",
    specs: ["16GB GDDR6X", "WINDFORCE"],
    price: 29_890_000,
    oldPrice: 32_500_000,
    rating: 5.0,
    reviewCount: 32,
    categorySlug: "vga",
    categoryPath: ["linh-kien", "vga"],
    tag: { label: "RTX AI", tone: "blue" },
    gift: "Sẵn hàng tại 18 chi nhánh",
  },
  {
    id: "ft-04",
    slug: "asus-rog-swift-oled-pg32ucdm",
    name: "ASUS ROG Swift OLED PG32UCDM 32\" 4K",
    summary: "Đồ họa & Gaming đỉnh cao • G-Sync Compatible",
    specs: ["32\" 4K 240Hz", "0.03ms GTG"],
    price: 36_900_000,
    oldPrice: 39_990_000,
    rating: 4.9,
    reviewCount: 19,
    categorySlug: "man-hinh",
    categoryPath: ["man-hinh"],
    tag: { label: "4K QD-OLED", tone: "green" },
    gift: "Bảo hành 36 tháng On-site VIP",
  },
  {
    id: "ft-05",
    slug: "logitech-g-pro-x-superlight-2",
    name: "Logitech G Pro X Superlight 2 Hero 2 32K",
    summary: "Switch quang từ LIGHTFORCE • Pin 95 giờ",
    specs: ["HERO 2 32K", "60g siêu nhẹ"],
    price: 3_490_000,
    oldPrice: 3_990_000,
    rating: 5.0,
    reviewCount: 156,
    categorySlug: "chuot",
    categoryPath: ["gaming-gear", "chuot"],
    tag: { label: "Gear Esports", tone: "amber" },
    gift: "Miễn phí giao hàng hỏa tốc 2h",
  },
];

/* -------------------------------------------------------------------------- */
/*  Top bán chạy trong tuần                                                   */
/* -------------------------------------------------------------------------- */
export const bestSellerProducts: Product[] = [
  {
    id: "bs-01",
    slug: "laptop-asus-tuf-gaming-a15-fa507nv",
    name: "Laptop ASUS TUF Gaming A15 FA507NV",
    summary: "16GB DDR5 4800MHz • 512GB PCIe 4.0 SSD",
    specs: ["Ryzen 7 7735HS", "RTX 4060 140W"],
    price: 24_490_000,
    oldPrice: 27_990_000,
    rating: 4.9,
    reviewCount: 312,
    categorySlug: "laptop-gaming",
    categoryPath: ["laptop", "laptop-gaming"],
    stock: { sold: 250, total: 280, note: "Cháy hàng", urgent: true },
  },
  {
    id: "bs-02",
    slug: "cpu-amd-ryzen-7-7800x3d-box",
    name: "CPU AMD Ryzen 7 7800X3D Box Chính Hãng",
    summary: "Gaming CPU tốt nhất thế giới • Socket AM5",
    specs: ["8C/16T", "96MB 3D V-Cache"],
    price: 10_890_000,
    oldPrice: 12_200_000,
    rating: 5.0,
    reviewCount: 130,
    categorySlug: "cpu",
    categoryPath: ["linh-kien", "cpu"],
    stock: { sold: 185, total: 220, note: "Bán chạy", urgent: true },
  },
  {
    id: "bs-03",
    slug: "ssd-samsung-990-pro-2tb",
    name: "Ổ cứng SSD Samsung 990 Pro 2TB NVMe M.2",
    summary: "Tốc độ đọc 7.450MB/s • Ghi 6.900MB/s",
    specs: ["PCIe Gen 4.0", "7450 MB/s"],
    price: 4_890_000,
    oldPrice: 5_490_000,
    rating: 4.9,
    reviewCount: 210,
    categorySlug: "ssd",
    categoryPath: ["linh-kien", "ssd"],
    stock: { sold: 142, total: 180, note: "Hàng hot", urgent: true },
  },
  {
    id: "bs-04",
    slug: "ram-corsair-vengeance-rgb-ddr5-32gb",
    name: "RAM Corsair Vengeance RGB DDR5 32GB 6000MHz",
    summary: "Tương thích Intel XMP 3.0 & AMD EXPO • Led RGB",
    specs: ["32GB (2x16GB)", "6000MHz CL36"],
    price: 2_890_000,
    oldPrice: 3_990_000,
    rating: 4.8,
    reviewCount: 95,
    categorySlug: "ram",
    categoryPath: ["linh-kien", "ram"],
    stock: { sold: 118, total: 200, note: "Sẵn hàng", urgent: false },
  },
];
