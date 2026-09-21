import { prisma, Prisma, ComponentType, ProductStatus } from "@pczone/db";
import { createHash } from "node:crypto";
import { toSlug } from "./utils.js";
import type { ScrapedProduct } from "./types.js";

// Prisma Client dùng chung cho cả monorepo (xem packages/db)
export { prisma };

/*
 * Nguyên tắc: dữ liệu crawl từ KCCShop là NGUỒN THAM KHẢO, không phải dữ liệu
 * vận hành của PCZone (đúng như khuyến nghị trong README gốc của dự án).
 *
 * Do đó:
 *   - Giá crawl về ghi vào `refPrice`, KHÔNG ghi vào `sellingPrice`
 *   - Sản phẩm mới tạo ở trạng thái DRAFT, admin duyệt và đặt giá mới chuyển ACTIVE
 *   - Khi crawl lại, các trường do admin quản lý (giá bán, trạng thái, tồn kho,
 *     nổi bật) KHÔNG bị ghi đè — chỉ cập nhật phần nội dung lấy từ nguồn
 */

// ---------------------------------------------------------------------------
// Mã hàng (SKU)
// ---------------------------------------------------------------------------

const CATEGORY_CODES: Record<string, string> = {
  mainboard: "MB",
  cpu: "CPU",
  ram: "RAM",
  vga: "VGA",
  ssd: "SSD",
  case: "CASE",
  psu: "PSU",
};

const CATEGORY_COMPONENT_TYPES: Record<string, ComponentType> = {
  mainboard: ComponentType.MAINBOARD,
  cpu: ComponentType.CPU,
  ram: ComponentType.RAM,
  vga: ComponentType.VGA,
  ssd: ComponentType.SSD,
  case: ComponentType.CASE,
  psu: ComponentType.PSU,
};

/**
 * Sinh SKU ổn định: cùng một sản phẩm luôn cho ra cùng một mã, kể cả khi
 * crawl lại. Hậu tố là 6 ký tự đầu của SHA-256 trên slug — đủ để tránh trùng
 * mà vẫn đọc được.
 *
 *   PCZ-MB-ASROCK-7A3F91
 */
function makeSku(
  categorySlug: string,
  brand: string | null,
  productSlug: string
): string {
  const cat = CATEGORY_CODES[categorySlug] ?? "GEN";

  const brandCode = (brand ?? "NOBRAND")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8) || "NOBRAND";

  const hash = createHash("sha256")
    .update(productSlug)
    .digest("hex")
    .slice(0, 6)
    .toUpperCase();

  return `PCZ-${cat}-${brandCode}-${hash}`;
}

/**
 * Gộp sẵn văn bản cho tìm kiếm và sinh embedding, để module AI không phải
 * ghép chuỗi lại mỗi lần đồng bộ vector.
 */
function buildAiSearchText(data: ScrapedProduct): string {
  const specLines = Object.entries(data.specifications ?? {})
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  return [
    data.name,
    data.brand ? `Thương hiệu: ${data.brand}` : "",
    `Danh mục: ${data.category.name}`,
    data.shortSpecs.join("\n"),
    specLines,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 20000);
}

function toDecimal(value: number | null): Prisma.Decimal | null {
  return value === null ? null : new Prisma.Decimal(value);
}

// ---------------------------------------------------------------------------
// Ghi sản phẩm
// ---------------------------------------------------------------------------

export async function upsertProduct(data: ScrapedProduct) {
  const category = await prisma.category.upsert({
    where: { slug: data.category.slug },
    // Danh mục đã có (do seed tạo, tên hiển thị như "CPU – Vi xử lý") thì giữ nguyên: đổi tên theo
    // nguồn crawl sẽ làm menu và trang danh mục đổi chữ mỗi lần chạy crawler
    update: {},
    create: {
      name: data.category.name,
      slug: data.category.slug,
      // Nối danh mục với loại linh kiện để AI Build PC biết đường tra cứu
      componentType: CATEGORY_COMPONENT_TYPES[data.category.slug] ?? null,
    },
  });

  let brandId: string | null = null;
  if (data.brand) {
    const brand = await prisma.brand.upsert({
      where: { name: data.brand },
      update: {},
      create: { name: data.brand, slug: toSlug(data.brand) },
    });
    brandId = brand.id;
  }

  const sku = makeSku(data.category.slug, data.brand, data.slug);
  const aiSearchText = buildAiSearchText(data);

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.upsert({
      where: { sourceUrl: data.sourceUrl },

      /*
       * CẬP NHẬT — chỉ đụng vào phần nội dung đến từ nguồn crawl.
       * Cố ý KHÔNG có: sellingPrice, costPrice, status, isFeatured,
       * inventoryQuantity, stockStatus, sku. Đó là các trường admin quản lý;
       * ghi đè sẽ xoá mất công nhập liệu mỗi lần chạy crawler.
       */
      update: {
        name: data.name,
        slug: data.slug,
        refPrice: toDecimal(data.price),
        originalPrice: toDecimal(data.originalPrice),
        warrantyMonths: data.warrantyMonths,
        shortSpecs: data.shortSpecs as Prisma.InputJsonValue,
        specifications: (data.specifications ?? {}) as Prisma.InputJsonValue,
        description: data.description,
        aiSearchText,
        categoryId: category.id,
        brandId,
        scrapedAt: new Date(),
      },

      create: {
        name: data.name,
        slug: data.slug,
        sku,
        source: "KCCSHOP",
        sourceUrl: data.sourceUrl,

        // Giá crawl là giá THAM KHẢO. sellingPrice bắt buộc phải có giá trị
        // nên đặt 0; trạng thái DRAFT giữ sản phẩm không hiện ra trang bán
        // cho tới khi admin đặt giá thật.
        refPrice: toDecimal(data.price),
        originalPrice: toDecimal(data.originalPrice),
        sellingPrice: new Prisma.Decimal(0),
        status: ProductStatus.DRAFT,

        stockStatus: data.stockStatus,
        warrantyMonths: data.warrantyMonths,
        shortSpecs: data.shortSpecs as Prisma.InputJsonValue,
        specifications: (data.specifications ?? {}) as Prisma.InputJsonValue,
        description: data.description,
        aiSearchText,
        categoryId: category.id,
        brandId,
        scrapedAt: new Date(),
      },
    });

    /*
     * Ảnh: nếu sản phẩm đã có ảnh chính hãng (ASROCK/GIGABYTE/...) thì giữ
     * nguyên, không để ảnh KCCShop ghi đè.
     */
    const officialImage = await tx.productImage.findFirst({
      where: {
        productId: product.id,
        source: { not: null },
        NOT: { source: "KCCSHOP" },
      },
    });

    if (officialImage) {
      console.log(`  ✓ Giữ ảnh chính hãng: ${officialImage.source}`);
      return product;
    }

    await tx.productImage.deleteMany({ where: { productId: product.id } });

    if (data.images.length) {
      await tx.productImage.createMany({
        data: data.images.map((img, index) => ({
          productId: product.id,
          url: img.url,
          alt: img.alt ?? data.name,
          position: index,
          isPrimary: index === 0,
          source: "KCCSHOP",
          sourceUrl: data.sourceUrl,
        })),
        skipDuplicates: true,
      });
    }

    return product;
  });
}