/**
 * Seed dữ liệu mẫu cho PCZone.
 *
 * Chạy:  npm run db:seed   (từ thư mục gốc monorepo)
 *
 * Idempotent: chạy lại nhiều lần không tạo bản ghi trùng, vì mọi thứ đều
 * dùng `upsert` theo slug / sku.
 *
 * Dữ liệu này để trang chủ có nội dung thật ngay mà không cần chạy crawler.
 * Sản phẩm do crawler nạp về sẽ nằm ở trạng thái DRAFT và không đụng tới
 * các bản ghi seed (khác `source`).
 */
import {
  ComponentType,
  PrismaClient,
  ProductStatus,
  StockStatus,
  UserRole,
} from "@prisma/client";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { productDescriptions } from "./seed-descriptions.js";

const prisma = new PrismaClient();

/* -------------------------------------------------------------------------- */
/*  Danh mục                                                                  */
/* -------------------------------------------------------------------------- */

interface CategorySeed {
  slug: string;
  name: string;
  icon?: string;
  /** Dòng phụ hiện dưới tên ở lưới danh mục trang chủ */
  description?: string;
  componentType?: ComponentType;
  children?: CategorySeed[];
}

const categoryTree: CategorySeed[] = [
  {
    slug: "laptop",
    name: "Laptop",
    icon: "Laptop",
    children: [
      { slug: "laptop-gaming", name: "Laptop Gaming", icon: "Gamepad2", description: "Từ 15.000.000đ" },
      { slug: "laptop-van-phong", name: "Laptop Văn phòng", icon: "Laptop", description: "Từ 9.900.000đ" },
    ],
  },
  {
    slug: "pc",
    name: "PC Lắp ráp",
    icon: "Monitor",
    children: [
      { slug: "pc-gaming", name: "PC Gaming", icon: "Monitor", description: "Tối ưu đồ họa" },
      { slug: "pc-workstation", name: "PC Workstation", icon: "Server", description: "Render & AI Data" },
    ],
  },
  {
    slug: "linh-kien",
    name: "Linh kiện máy tính",
    icon: "Cpu",
    children: [
      { slug: "cpu", name: "CPU – Vi xử lý", icon: "Cpu", description: "Intel & AMD Gen mới", componentType: ComponentType.CPU },
      { slug: "vga", name: "VGA – Card đồ họa", icon: "MemoryStick", description: "RTX 40 Series & RX", componentType: ComponentType.VGA },
      { slug: "mainboard", name: "Mainboard", icon: "CircuitBoard", componentType: ComponentType.MAINBOARD },
      { slug: "ram", name: "RAM", icon: "MemoryStick", componentType: ComponentType.RAM },
      { slug: "ssd", name: "Ổ cứng SSD", icon: "HardDrive", componentType: ComponentType.SSD },
      { slug: "psu", name: "Nguồn máy tính", icon: "Plug", componentType: ComponentType.PSU },
      { slug: "case", name: "Vỏ case", icon: "Box", componentType: ComponentType.CASE },
    ],
  },
  {
    slug: "man-hinh",
    name: "Màn hình",
    icon: "MonitorSmartphone",
    componentType: ComponentType.MONITOR,
  },
  {
    slug: "gaming-gear",
    name: "Gaming Gear",
    icon: "Keyboard",
    children: [
      { slug: "ban-phim", name: "Bàn phím cơ", icon: "Keyboard", componentType: ComponentType.KEYBOARD },
      { slug: "chuot", name: "Chuột gaming", icon: "Mouse", componentType: ComponentType.MOUSE },
    ],
  },
];

async function seedCategories() {
  let order = 0;

  async function upsertNode(node: CategorySeed, parentId: string | null) {
    const category = await prisma.category.upsert({
      where: { slug: node.slug },
      update: {
        name: node.name,
        icon: node.icon,
        description: node.description,
        parentId,
        componentType: node.componentType ?? null,
        sortOrder: order++,
        isActive: true,
      },
      create: {
        slug: node.slug,
        name: node.name,
        icon: node.icon,
        description: node.description,
        parentId,
        componentType: node.componentType ?? null,
        sortOrder: order++,
      },
    });

    for (const child of node.children ?? []) {
      await upsertNode(child, category.id);
    }
  }

  for (const node of categoryTree) {
    await upsertNode(node, null);
  }

  console.log(`✓ Danh mục: ${await prisma.category.count()} bản ghi`);
}

/* -------------------------------------------------------------------------- */
/*  Thương hiệu                                                               */
/* -------------------------------------------------------------------------- */

const brands = [
  { name: "ASUS", slug: "asus", website: "https://www.asus.com" },
  { name: "ASUS ROG", slug: "asus-rog", website: "https://rog.asus.com" },
  { name: "Lenovo", slug: "lenovo", website: "https://www.lenovo.com" },
  { name: "GIGABYTE", slug: "gigabyte", website: "https://www.gigabyte.com" },
  { name: "MSI", slug: "msi", website: "https://www.msi.com" },
  { name: "Intel", slug: "intel", website: "https://www.intel.vn" },
  { name: "AMD", slug: "amd", website: "https://www.amd.com" },
  { name: "NVIDIA", slug: "nvidia", website: "https://www.nvidia.com" },
  { name: "Samsung", slug: "samsung", website: "https://www.samsung.com" },
  { name: "Corsair", slug: "corsair", website: "https://www.corsair.com" },
  { name: "Logitech", slug: "logitech", website: "https://www.logitechg.com" },
  { name: "PCZone", slug: "pczone", website: "https://pczone.vn" },
];

async function seedBrands() {
  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: { name: brand.name, website: brand.website },
      create: brand,
    });
  }
  console.log(`✓ Thương hiệu: ${brands.length} bản ghi`);
}

/* -------------------------------------------------------------------------- */
/*  Sản phẩm                                                                  */
/* -------------------------------------------------------------------------- */

interface ProductSeed {
  slug: string;
  name: string;
  categorySlug: string;
  brandSlug: string;
  shortDescription?: string;
  shortSpecs: string[];
  sellingPrice: number;
  originalPrice?: number;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  inventoryQuantity: number;
  warrantyMonths: number;
  isFeatured?: boolean;
  isFlashSale?: boolean;
  flashSaleQuota?: number;
  promoTag?: string;
  promoTone?: "amber" | "green" | "blue" | "red" | "slate";
  giftNote?: string;
}

const products: ProductSeed[] = [
  /* ---------- Flash Sale ---------- */
  {
    slug: "laptop-asus-rog-strix-g16-g614jir",
    name: "Laptop ASUS ROG Strix G16 G614JIR",
    categorySlug: "laptop-gaming",
    brandSlug: "asus-rog",
    shortDescription: "32GB DDR5 • 1TB NVMe PCIe 4.0 • Màn 240Hz",
    shortSpecs: ["i9-14900HX", "RTX 4070"],
    sellingPrice: 41_990_000,
    originalPrice: 49_990_000,
    ratingAvg: 5.0,
    ratingCount: 47,
    soldCount: 80,
    inventoryQuantity: 10,
    warrantyMonths: 24,
    isFlashSale: true,
    flashSaleQuota: 90,
    promoTag: "Quà tặng 3 triệu",
    promoTone: "amber",
  },
  {
    slug: "pc-gaming-pczone-ultra-master-g7",
    name: "PC Gaming PCZone Ultra Master G7",
    categorySlug: "pc-gaming",
    brandSlug: "pczone",
    shortDescription: "32GB DDR5 • AIO 360 ARGB • Nguồn 1000W Gold",
    shortSpecs: ["Ryzen 7 7800X3D", "RTX 4080 Super"],
    sellingPrice: 54_900_000,
    originalPrice: 62_500_000,
    ratingAvg: 4.9,
    ratingCount: 31,
    soldCount: 19,
    inventoryQuantity: 5,
    warrantyMonths: 36,
    isFlashSale: true,
    flashSaleQuota: 24,
    promoTag: "Trả góp 0%",
    promoTone: "green",
  },
  {
    slug: "card-man-hinh-asus-tuf-rtx-4070-ti-super",
    name: "Card màn hình ASUS TUF RTX 4070 Ti SUPER",
    categorySlug: "vga",
    brandSlug: "asus",
    shortDescription: "Tối ưu DLSS 3.5 • 3 quạt Axial-tech",
    shortSpecs: ["16GB GDDR6X", "DLSS 3.5"],
    sellingPrice: 23_490_000,
    originalPrice: 26_990_000,
    ratingAvg: 4.9,
    ratingCount: 86,
    soldCount: 45,
    inventoryQuantity: 5,
    warrantyMonths: 36,
    isFlashSale: true,
    flashSaleQuota: 50,
    promoTag: "Freeship 600K",
    promoTone: "amber",
  },
  {
    slug: "cpu-amd-ryzen-7-9700x",
    name: "CPU AMD Ryzen 7 9700X AM5 Zen 5",
    categorySlug: "cpu",
    brandSlug: "amd",
    shortDescription: "Socket AM5 • TDP 65W • Hỗ trợ PCIe 5.0",
    shortSpecs: ["8C/16T", "Up 5.5GHz"],
    sellingPrice: 9_290_000,
    originalPrice: 10_990_000,
    ratingAvg: 5.0,
    ratingCount: 19,
    soldCount: 40,
    inventoryQuantity: 6,
    warrantyMonths: 36,
    isFlashSale: true,
    flashSaleQuota: 46,
    promoTag: "Bảo hành 36T",
    promoTone: "blue",
  },
  {
    slug: "man-hinh-samsung-odyssey-oled-g8",
    name: "Màn hình Samsung Odyssey OLED G8",
    categorySlug: "man-hinh",
    brandSlug: "samsung",
    shortDescription: "Tấm nền QD-OLED • HDR10+ Gaming • Smart Monitor",
    shortSpecs: ['34" OLED UWQHD', "175Hz 0.03ms"],
    sellingPrice: 23_990_000,
    originalPrice: 28_990_000,
    ratingAvg: 4.8,
    ratingCount: 64,
    soldCount: 27,
    inventoryQuantity: 3,
    warrantyMonths: 24,
    isFlashSale: true,
    flashSaleQuota: 30,
    promoTag: "Giá sốc",
    promoTone: "red",
  },

  /* ---------- Sản phẩm nổi bật ---------- */
  {
    slug: "laptop-lenovo-legion-pro-7i-gen-9",
    name: "Laptop Lenovo Legion Pro 7i Gen 9",
    categorySlug: "laptop-gaming",
    brandSlug: "lenovo",
    shortDescription: "32GB DDR5 • 1TB NVMe PCIe 4.0 • Màn 240Hz",
    shortSpecs: ["i9-14900HX", "RTX 4080"],
    sellingPrice: 68_990_000,
    originalPrice: 74_990_000,
    ratingAvg: 5.0,
    ratingCount: 63,
    soldCount: 58,
    inventoryQuantity: 12,
    warrantyMonths: 24,
    isFeatured: true,
    promoTag: "Nổi bật",
    promoTone: "amber",
    giftNote: "Tặng Balo Legion 2.5tr",
  },
  {
    slug: "pc-gaming-pczone-dragon-knight",
    name: "PC Gaming PCZone Dragon Knight",
    categorySlug: "pc-gaming",
    brandSlug: "pczone",
    shortDescription: "32GB DDR5 • AIO 360 ARGB • Nguồn 850W Gold",
    shortSpecs: ["i7-14700K", "RTX 4070 Ti Super"],
    sellingPrice: 45_990_000,
    originalPrice: 51_500_000,
    ratingAvg: 4.9,
    ratingCount: 24,
    soldCount: 33,
    inventoryQuantity: 8,
    warrantyMonths: 36,
    isFeatured: true,
    promoTag: "Bán chạy",
    promoTone: "red",
    giftNote: "Tặng Chuột & Pad Master VIP",
  },
  {
    slug: "gigabyte-rtx-4080-super-gaming-oc-16gb",
    name: "GIGABYTE RTX 4080 SUPER Gaming OC 16GB",
    categorySlug: "vga",
    brandSlug: "gigabyte",
    shortDescription: "Tối ưu AI Generation • Dual BIOS • WINDFORCE",
    shortSpecs: ["16GB GDDR6X", "WINDFORCE"],
    sellingPrice: 29_890_000,
    originalPrice: 32_500_000,
    ratingAvg: 5.0,
    ratingCount: 32,
    soldCount: 41,
    inventoryQuantity: 15,
    warrantyMonths: 36,
    isFeatured: true,
    promoTag: "RTX AI",
    promoTone: "blue",
    giftNote: "Sẵn hàng tại 18 chi nhánh",
  },
  {
    slug: "asus-rog-swift-oled-pg32ucdm",
    name: 'ASUS ROG Swift OLED PG32UCDM 32" 4K',
    categorySlug: "man-hinh",
    brandSlug: "asus-rog",
    shortDescription: "Đồ họa & Gaming đỉnh cao • G-Sync Compatible",
    shortSpecs: ['32" 4K 240Hz', "0.03ms GTG"],
    sellingPrice: 36_900_000,
    originalPrice: 39_990_000,
    ratingAvg: 4.9,
    ratingCount: 19,
    soldCount: 22,
    inventoryQuantity: 7,
    warrantyMonths: 36,
    isFeatured: true,
    promoTag: "4K QD-OLED",
    promoTone: "green",
    giftNote: "Bảo hành 36 tháng On-site VIP",
  },
  {
    slug: "logitech-g-pro-x-superlight-2",
    name: "Logitech G Pro X Superlight 2 Hero 2 32K",
    categorySlug: "chuot",
    brandSlug: "logitech",
    shortDescription: "Switch quang từ LIGHTFORCE • Pin 95 giờ",
    shortSpecs: ["HERO 2 32K", "60g siêu nhẹ"],
    sellingPrice: 3_490_000,
    originalPrice: 3_990_000,
    ratingAvg: 5.0,
    ratingCount: 156,
    soldCount: 320,
    inventoryQuantity: 60,
    warrantyMonths: 24,
    isFeatured: true,
    promoTag: "Gear Esports",
    promoTone: "amber",
    giftNote: "Miễn phí giao hàng hỏa tốc 2h",
  },

  /* ---------- Top bán chạy ---------- */
  {
    slug: "laptop-asus-tuf-gaming-a15-fa507nv",
    name: "Laptop ASUS TUF Gaming A15 FA507NV",
    categorySlug: "laptop-gaming",
    brandSlug: "asus",
    shortDescription: "16GB DDR5 4800MHz • 512GB PCIe 4.0 SSD",
    shortSpecs: ["Ryzen 7 7735HS", "RTX 4060 140W"],
    sellingPrice: 24_490_000,
    originalPrice: 27_990_000,
    ratingAvg: 4.9,
    ratingCount: 312,
    soldCount: 250,
    inventoryQuantity: 30,
    warrantyMonths: 24,
  },
  {
    slug: "cpu-amd-ryzen-7-7800x3d-box",
    name: "CPU AMD Ryzen 7 7800X3D Box Chính Hãng",
    categorySlug: "cpu",
    brandSlug: "amd",
    shortDescription: "Gaming CPU tốt nhất thế giới • Socket AM5",
    shortSpecs: ["8C/16T", "96MB 3D V-Cache"],
    sellingPrice: 10_890_000,
    originalPrice: 12_200_000,
    ratingAvg: 5.0,
    ratingCount: 130,
    soldCount: 185,
    inventoryQuantity: 35,
    warrantyMonths: 36,
  },
  {
    slug: "ssd-samsung-990-pro-2tb",
    name: "Ổ cứng SSD Samsung 990 Pro 2TB NVMe M.2",
    categorySlug: "ssd",
    brandSlug: "samsung",
    shortDescription: "Tốc độ đọc 7.450MB/s • Ghi 6.900MB/s",
    shortSpecs: ["PCIe Gen 4.0", "7450 MB/s"],
    sellingPrice: 4_890_000,
    originalPrice: 5_490_000,
    ratingAvg: 4.9,
    ratingCount: 210,
    soldCount: 142,
    inventoryQuantity: 38,
    warrantyMonths: 60,
  },
  {
    slug: "ram-corsair-vengeance-rgb-ddr5-32gb",
    name: "RAM Corsair Vengeance RGB DDR5 32GB 6000MHz",
    categorySlug: "ram",
    brandSlug: "corsair",
    shortDescription: "Hỗ trợ Intel XMP 3.0 • LED RGB 10 vùng • iCUE",
    shortSpecs: ["32GB (2x16GB)", "6000MHz CL36"],
    sellingPrice: 2_890_000,
    originalPrice: 3_990_000,
    ratingAvg: 4.8,
    ratingCount: 95,
    soldCount: 118,
    inventoryQuantity: 82,
    warrantyMonths: 60,
  },
];

/* -------------------------------------------------------------------------- */
/*  Nội dung trang chi tiết: mô tả + bảng thông số                            */
/* -------------------------------------------------------------------------- */

interface ProductDetailSeed {
  /** [nhãn, giá trị] — lưu dạng mảng để giữ đúng thứ tự hiển thị */
  specifications: [label: string, value: string][];
}

/**
 * Bảng thông số kỹ thuật. Chỉ ghi thông số công bố chính thức của hãng (đã đối chiếu với trang
 * sản phẩm của hãng lúc viết) hoặc thông số nêu trong shortDescription / shortSpecs. Bài mô tả dài
 * của từng sản phẩm nằm ở seed-descriptions.ts. Dữ liệu thật do crawler và admin nhập sau này.
 */
const productDetails: Record<string, ProductDetailSeed> = {
  "laptop-asus-rog-strix-g16-g614jir": {
    specifications: [
      ["CPU", "Intel Core i9-14900HX (24 nhân, 32 luồng, xung nhịp tối đa 5.8GHz)"],
      ["Card đồ họa", "NVIDIA GeForce RTX 4070 Laptop GPU 8GB GDDR6 (tối đa 140W)"],
      ["RAM", "32GB DDR5"],
      ["Ổ cứng", "1TB SSD NVMe PCIe 4.0"],
      ["Màn hình", '16" QHD+ (2560 x 1600), tỷ lệ 16:10, tần số quét 240Hz'],
      ["Bàn phím", "Chiclet có đèn nền RGB 4 vùng"],
      ["Cổng kết nối", "Thunderbolt 4, USB-C 3.2 Gen 2, 2 x USB-A 3.2 Gen 2, HDMI 2.1, LAN RJ45, jack 3.5mm"],
      ["Không dây", "Wi-Fi 6E, Bluetooth 5.3"],
      ["Pin", "90Wh"],
      ["Khối lượng", "Khoảng 2,5kg"],
      ["Hệ điều hành", "Windows 11 Home"],
      ["Bảo hành", "24 tháng"],
    ],
  },
  "pc-gaming-pczone-ultra-master-g7": {
    specifications: [
      ["CPU", "AMD Ryzen 7 7800X3D (8 nhân, 16 luồng, 96MB 3D V-Cache)"],
      ["Card đồ họa", "NVIDIA GeForce RTX 4080 SUPER"],
      ["RAM", "32GB DDR5"],
      ["Tản nhiệt", "Tản nhiệt nước AIO 360mm, LED ARGB"],
      ["Nguồn", "1000W 80 Plus Gold"],
      ["Bảo hành", "36 tháng"],
    ],
  },
  "card-man-hinh-asus-tuf-rtx-4070-ti-super": {
    specifications: [
      ["GPU", "NVIDIA GeForce RTX 4070 Ti SUPER"],
      ["Nhân CUDA", "8448"],
      ["Xung nhịp boost", "2670MHz (chế độ OC) / 2640MHz (mặc định)"],
      ["Bộ nhớ", "16GB GDDR6X, 21 Gbps, bus 256-bit"],
      ["Chuẩn giao tiếp", "PCIe 4.0 x16"],
      ["Công nghệ", "DLSS 3.5, Ray Tracing"],
      ["Làm mát", "3 quạt Axial-tech"],
      ["Kích thước", "305 x 138 x 65mm (chiếm 3.25 khe)"],
      ["Nguồn cấp", "1 x 16-pin"],
      ["Nguồn khuyến nghị", "750W trở lên"],
      ["Bảo hành", "36 tháng"],
    ],
  },
  "cpu-amd-ryzen-7-9700x": {
    specifications: [
      ["Socket", "AM5"],
      ["Kiến trúc", "Zen 5"],
      ["Số nhân / luồng", "8 nhân, 16 luồng"],
      ["Xung nhịp", "Cơ bản 3.8GHz, tối đa 5.5GHz"],
      ["Bộ nhớ đệm", "L2 8MB + L3 32MB"],
      ["Tiến trình", "TSMC 4nm"],
      ["TDP", "65W"],
      ["Bộ nhớ hỗ trợ", "DDR5-5600, tối đa 256GB"],
      ["PCIe", "PCIe 5.0 (28 làn, 24 làn khả dụng)"],
      ["Đồ họa tích hợp", "AMD Radeon (2 nhân)"],
      ["Tản nhiệt kèm theo", "Không (cần mua riêng)"],
      ["Bảo hành", "36 tháng"],
    ],
  },
  "man-hinh-samsung-odyssey-oled-g8": {
    specifications: [
      ["Kích thước", '34" màn hình cong 1800R, tỷ lệ 21:9'],
      ["Tấm nền", "QD-OLED"],
      ["Độ phân giải", "3440 x 1440 (UWQHD)"],
      ["Tần số quét", "175Hz"],
      ["Thời gian phản hồi", "0.03ms (GtG)"],
      ["Độ tương phản", "1.000.000:1 (tĩnh)"],
      ["Độ phủ màu", "99% DCI-P3"],
      ["HDR", "HDR10+ Gaming"],
      ["Đồng bộ hình ảnh", "G-Sync Compatible, AMD FreeSync Premium Pro"],
      ["Cổng kết nối", "1 x DisplayPort, 2 x HDMI 2.1, hub USB 3.0 (2 x USB-A, 1 x USB-B)"],
      ["Không dây", "Wi-Fi 5, Bluetooth 5.2"],
      ["Bảo hành", "24 tháng"],
    ],
  },
  "laptop-lenovo-legion-pro-7i-gen-9": {
    specifications: [
      ["CPU", "Intel Core i9-14900HX (24 nhân, 32 luồng)"],
      ["Card đồ họa", "NVIDIA GeForce RTX 4080 Laptop GPU 12GB GDDR6 (175W)"],
      ["RAM", "32GB DDR5"],
      ["Ổ cứng", "1TB SSD NVMe PCIe 4.0"],
      ["Màn hình", '16" WQXGA (2560 x 1600), IPS, 240Hz, 500 nit, 100% DCI-P3'],
      ["Pin", "99,99Wh, sạc nhanh 0-80% trong khoảng 30 phút"],
      ["Cổng kết nối", "Thunderbolt 4, USB-C 3.2 Gen 2 (sạc PD 140W), 2 x USB-A 3.2 Gen 1, HDMI 2.1, LAN RJ45"],
      ["Hệ điều hành", "Windows 11 Home"],
      ["Bảo hành", "24 tháng"],
    ],
  },
  "pc-gaming-pczone-dragon-knight": {
    specifications: [
      ["CPU", "Intel Core i7-14700K (20 nhân, 28 luồng, xung nhịp tối đa 5.6GHz)"],
      ["Card đồ họa", "NVIDIA GeForce RTX 4070 Ti SUPER 16GB"],
      ["RAM", "32GB DDR5"],
      ["Tản nhiệt", "Tản nhiệt nước AIO 360mm, LED ARGB"],
      ["Nguồn", "850W 80 Plus Gold"],
      ["Bảo hành", "36 tháng"],
    ],
  },
  "gigabyte-rtx-4080-super-gaming-oc-16gb": {
    specifications: [
      ["GPU", "NVIDIA GeForce RTX 4080 SUPER"],
      ["Nhân CUDA", "10240"],
      ["Xung nhịp boost", "2595MHz (chế độ OC)"],
      ["Bộ nhớ", "16GB GDDR6X, 23 Gbps, bus 256-bit"],
      ["Chuẩn giao tiếp", "PCIe 4.0"],
      ["Làm mát", "WINDFORCE 3 quạt"],
      ["BIOS", "Dual BIOS"],
      ["Cổng xuất hình", "3 x DisplayPort 1.4a, 1 x HDMI 2.1a"],
      ["Kích thước", "342 x 150 x 75mm"],
      ["Nguồn cấp", "1 x 16-pin"],
      ["Nguồn khuyến nghị", "850W trở lên"],
      ["Bảo hành", "36 tháng"],
    ],
  },
  "asus-rog-swift-oled-pg32ucdm": {
    specifications: [
      ["Kích thước", '32" (31,5")'],
      ["Tấm nền", "QD-OLED thế hệ 3"],
      ["Độ phân giải", "3840 x 2160 (4K)"],
      ["Tần số quét", "240Hz"],
      ["Thời gian phản hồi", "0.03ms (GTG)"],
      ["Độ sáng đỉnh HDR", "1.000 nit"],
      ["Độ phủ màu", "99% DCI-P3"],
      ["HDR", "HDR10, Dolby Vision"],
      ["Đồng bộ hình ảnh", "G-Sync Compatible (Adaptive-Sync)"],
      ["Cổng kết nối", "1 x DisplayPort 1.4, 2 x HDMI 2.1, USB-C (DisplayPort Alt Mode, sạc tới 90W), 3 x USB-A, SPDIF quang, jack tai nghe"],
      ["Bảo hành", "36 tháng, đổi mới tại nhà, bao gồm burn-in tấm nền"],
    ],
  },
  "logitech-g-pro-x-superlight-2": {
    specifications: [
      ["Cảm biến", "HERO 2, tối đa 32.000 DPI"],
      ["Switch", "LIGHTFORCE lai quang – cơ"],
      ["Trọng lượng", "Khoảng 60g"],
      ["Kết nối", "LIGHTSPEED không dây 2.4GHz"],
      ["Thời lượng pin", "Tới khoảng 95 giờ"],
      ["Cổng sạc", "USB-C"],
      ["Chân chuột", "PTFE không phụ gia"],
      ["Phần mềm", "Logitech G HUB"],
      ["Bảo hành", "24 tháng"],
    ],
  },
  "laptop-asus-tuf-gaming-a15-fa507nv": {
    specifications: [
      ["CPU", "AMD Ryzen 7 7735HS (8 nhân, 16 luồng, xung nhịp tối đa 4.7GHz)"],
      ["Card đồ họa", "NVIDIA GeForce RTX 4060 Laptop GPU 8GB GDDR6 (tối đa 140W)"],
      ["RAM", "16GB DDR5 4800MHz (2 x 8GB, nâng cấp tối đa 32GB)"],
      ["Ổ cứng", "512GB SSD NVMe PCIe 4.0"],
      ["Màn hình", '15.6" Full HD (1920 x 1080), 144Hz, IPS-level chống chói, 100% sRGB'],
      ["Cổng kết nối", "HDMI 2.1, USB-C 3.2 Gen 2, USB4 Type-C, 2 x USB-A 3.2 Gen 1, LAN RJ45, jack 3.5mm"],
      ["Pin", "90Wh"],
      ["Khối lượng", "Khoảng 2,2kg"],
      ["Hệ điều hành", "Windows 11 Home"],
      ["Bảo hành", "24 tháng"],
    ],
  },
  "cpu-amd-ryzen-7-7800x3d-box": {
    specifications: [
      ["Socket", "AM5"],
      ["Số nhân / luồng", "8 nhân, 16 luồng"],
      ["Xung nhịp", "Cơ bản 4.2GHz, tối đa 5.0GHz"],
      ["Bộ nhớ đệm", "L3 96MB (3D V-Cache) + L2 8MB"],
      ["Tiến trình", "TSMC 5nm"],
      ["TDP", "120W"],
      ["Bộ nhớ hỗ trợ", "DDR5-5200, tối đa 128GB"],
      ["PCIe", "PCIe 5.0 (28 làn, 24 làn khả dụng)"],
      ["Đồ họa tích hợp", "AMD Radeon (2 nhân)"],
      ["Tản nhiệt kèm theo", "Không (cần mua riêng)"],
      ["Bảo hành", "36 tháng"],
    ],
  },
  "ssd-samsung-990-pro-2tb": {
    specifications: [
      ["Dung lượng", "2TB"],
      ["Chuẩn kết nối", "M.2 2280, NVMe 2.0 PCIe 4.0 x4"],
      ["Tốc độ đọc tuần tự", "Tới 7.450MB/s"],
      ["Tốc độ ghi tuần tự", "Tới 6.900MB/s"],
      ["IOPS ngẫu nhiên 4KB (QD32)", "Đọc tới 1.400.000, ghi tới 1.550.000"],
      ["Bộ nhớ NAND", "Samsung V-NAND TLC"],
      ["Mã hoá", "AES 256-bit, TCG Opal, IEEE 1667"],
      ["Độ bền (TBW)", "1.200TB"],
      ["Bảo hành", "60 tháng"],
    ],
  },
  "ram-corsair-vengeance-rgb-ddr5-32gb": {
    specifications: [
      ["Dung lượng", "32GB (2 x 16GB)"],
      ["Loại RAM", "DDR5"],
      ["Tốc độ", "6000MT/s (PC5-48000)"],
      ["Độ trễ", "CL36"],
      ["Điện áp", "1.35V"],
      ["Cấu hình sẵn", "Intel XMP 3.0"],
      ["Tương thích", "Bo mạch chủ Intel 600 / 700 / 800 series"],
      ["Đèn LED", "RGB 10 vùng mỗi thanh, điều khiển bằng iCUE"],
      ["Bảo hành", "60 tháng"],
    ],
  },
};

/** SKU ổn định, cùng quy tắc với crawler: PCZ-<DANHMUC>-<HÃNG>-<HASH> */
function makeSku(categorySlug: string, brandSlug: string, productSlug: string) {
  const cat = categorySlug.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const brand = brandSlug.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const hash = createHash("sha256").update(productSlug).digest("hex").slice(0, 6).toUpperCase();
  return `PCZ-${cat}-${brand}-${hash}`;
}

async function seedProducts() {
  const flashSaleEndsAt = new Date(Date.now() + 3 * 60 * 60 * 1000);

  for (const item of products) {
    const category = await prisma.category.findUnique({
      where: { slug: item.categorySlug },
    });
    if (!category) {
      console.warn(`⚠ Bỏ qua ${item.slug}: không tìm thấy danh mục ${item.categorySlug}`);
      continue;
    }

    const brand = await prisma.brand.findUnique({ where: { slug: item.brandSlug } });

    const aiSearchText = [
      item.name,
      `Thương hiệu: ${brand?.name ?? ""}`,
      `Danh mục: ${category.name}`,
      item.shortDescription ?? "",
      item.shortSpecs.join("\n"),
    ]
      .filter(Boolean)
      .join("\n");

    const detail = productDetails[item.slug];

    const data = {
      name: item.name,
      categoryId: category.id,
      brandId: brand?.id ?? null,
      shortDescription: item.shortDescription,
      shortSpecs: item.shortSpecs,
      description: productDescriptions[item.slug],
      specifications: detail?.specifications.map(([label, value]) => ({ label, value })),
      sellingPrice: item.sellingPrice,
      originalPrice: item.originalPrice ?? null,
      ratingAvg: item.ratingAvg,
      ratingCount: item.ratingCount,
      soldCount: item.soldCount,
      inventoryQuantity: item.inventoryQuantity,
      stockStatus:
        item.inventoryQuantity > 0 ? StockStatus.IN_STOCK : StockStatus.OUT_OF_STOCK,
      warrantyMonths: item.warrantyMonths,
      status: ProductStatus.ACTIVE,
      isFeatured: item.isFeatured ?? false,
      isFlashSale: item.isFlashSale ?? false,
      flashSaleEndsAt: item.isFlashSale ? flashSaleEndsAt : null,
      flashSaleQuota: item.flashSaleQuota ?? null,
      promoTag: item.promoTag ?? null,
      promoTone: item.promoTone ?? null,
      giftNote: item.giftNote ?? null,
      aiSearchText,
      publishedAt: new Date(),
    };

    await prisma.product.upsert({
      where: { slug: item.slug },
      update: data,
      create: {
        ...data,
        slug: item.slug,
        sku: makeSku(item.categorySlug, item.brandSlug, item.slug),
        source: "SEED",
      },
    });
  }

  console.log(`✓ Sản phẩm: ${products.length} bản ghi`);
}

/* -------------------------------------------------------------------------- */
/*  Tài khoản quản trị                                                        */
/* -------------------------------------------------------------------------- */

async function seedAdmin() {
  // Mật khẩu mặc định: admin123 — ĐỔI NGAY sau khi chạy lần đầu.
  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "admin@pczone.vn" },
    update: { role: UserRole.ADMIN },
    create: {
      email: "admin@pczone.vn",
      passwordHash,
      fullName: "Quản trị viên PCZone",
      role: UserRole.ADMIN,
      emailVerifiedAt: new Date(),
    },
  });

  console.log("✓ Tài khoản admin: admin@pczone.vn / admin123 (nhớ đổi mật khẩu)");
}

/* -------------------------------------------------------------------------- */

async function main() {
  console.log("Bắt đầu seed dữ liệu PCZone...\n");
  await seedCategories();
  await seedBrands();
  await seedProducts();
  await seedAdmin();
  console.log("\nXong. Chạy `npm run db:studio` để xem dữ liệu.");
}

main()
  .catch((error) => {
    console.error("Seed thất bại:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
