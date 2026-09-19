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
    shortDescription: "Tấm nền QD-OLED • HDR10+ • USB-C 65W",
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
    shortDescription: "Tương thích Intel XMP 3.0 & AMD EXPO • Led RGB",
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

    const data = {
      name: item.name,
      categoryId: category.id,
      brandId: brand?.id ?? null,
      shortDescription: item.shortDescription,
      shortSpecs: item.shortSpecs,
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
