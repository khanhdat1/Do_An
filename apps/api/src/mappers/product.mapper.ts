import type { Prisma } from "@pczone/db";
import type {
  BreadcrumbDto,
  ProductDetailDto,
  ProductDto,
  SpecRowDto,
  StockInfoDto,
  Tone,
} from "../types/dto.js";
import { MAX_QUANTITY_PER_LINE } from "../utils/limits.js";

/**
 * Ảnh được phép hiển thị ra ngoài: bỏ ảnh `needsReview` (còn watermark của shop
 * khác, hoặc so khớp model chưa chắc chắn — xem ProductImage trong schema.prisma),
 * ảnh chính đứng đầu rồi tới thứ tự `position`.
 */
const publicImages = {
  where: { needsReview: false },
  orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
} satisfies Prisma.Product$imagesArgs;

const categoryChain = {
  include: { parent: { include: { parent: true } } },
} satisfies Prisma.CategoryDefaultArgs;

/**
 * Kiểu Product kèm quan hệ mà mapper cần.
 * Dùng `satisfies` để TypeScript tự kiểm tra query và mapper khớp nhau —
 * quên `include` một quan hệ là lỗi biên dịch, không phải lỗi lúc chạy.
 */
export const productInclude = {
  category: categoryChain,
  brand: true,
  images: { ...publicImages, take: 1 },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

/** Trang chi tiết cần đủ bộ ảnh cho gallery, không chỉ ảnh đầu tiên */
export const productDetailInclude = {
  category: categoryChain,
  brand: true,
  images: publicImages,
} satisfies Prisma.ProductInclude;

export type ProductDetailRow = Prisma.ProductGetPayload<{
  include: typeof productDetailInclude;
}>;

const VALID_TONES: Tone[] = ["amber", "green", "blue", "red", "slate"];

/** Prisma Decimal -> number. Giá VNĐ không có phần thập phân nên an toàn. */
function toNumber(value: Prisma.Decimal | null): number | undefined {
  return value === null ? undefined : Number(value);
}

/**
 * Dựng đường dẫn danh mục từ gốc tới lá: ["linh-kien", "vga"].
 * Schema cho phép cây nhiều tầng; PCZone dùng tối đa 3 tầng nên
 * `productInclude` lấy sẵn 2 cấp cha là đủ.
 */
export function buildCategoryPath(category: ProductWithRelations["category"]): string[] {
  return buildBreadcrumb(category).map((crumb) => crumb.slug);
}

/** Cùng đường dẫn với `buildCategoryPath` nhưng kèm tên để hiện breadcrumb */
function buildBreadcrumb(category: ProductWithRelations["category"]): BreadcrumbDto[] {
  const path: BreadcrumbDto[] = [{ slug: category.slug, name: category.name }];

  const parent = category.parent;
  if (parent) {
    path.unshift({ slug: parent.slug, name: parent.name });
    if (parent.parent) {
      path.unshift({ slug: parent.parent.slug, name: parent.parent.name });
    }
  }

  return path;
}

/**
 * Sinh thông tin tồn kho cho thanh tiến trình Flash Sale.
 * `note` là dòng chữ bên phải: "Gần cháy hàng", "Còn 5 suất"...
 */
function buildStockInfo(product: ProductWithRelations): StockInfoDto | undefined {
  const available = product.inventoryQuantity - product.reservedQuantity;

  // Flash Sale: tiến trình tính trên số suất của đợt sale
  if (product.isFlashSale && product.flashSaleQuota) {
    const sold = Math.min(product.soldCount, product.flashSaleQuota);
    const remaining = Math.max(0, product.flashSaleQuota - sold);
    return {
      sold,
      total: product.flashSaleQuota,
      note:
        remaining === 0
          ? "Hết suất"
          : remaining <= 3
            ? `Còn ${remaining} suất`
            : remaining <= 10
              ? "Sắp hết hàng"
              : "Gần cháy hàng",
      urgent: remaining <= 10,
    };
  }

  // Sản phẩm thường: tiến trình theo tồn kho còn lại
  if (product.soldCount > 0) {
    const total = product.soldCount + Math.max(0, available);
    return {
      sold: product.soldCount,
      total,
      note: available <= 0 ? "Hết hàng" : available <= 10 ? "Sắp hết hàng" : "Sẵn hàng",
      urgent: available <= 10,
    };
  }

  return undefined;
}

/** Lấy mảng shortSpecs từ cột JSON, lọc bỏ giá trị không phải chuỗi. */
export function readAllShortSpecs(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Thẻ sản phẩm chỉ đủ chỗ cho 3 chip thông số đầu tiên */
function readSpecs(value: Prisma.JsonValue | null): string[] {
  return readAllShortSpecs(value).slice(0, 3);
}

/**
 * Đọc cột `specifications` thành các dòng của bảng thông số.
 *
 * Chấp nhận hai dạng vì có hai nguồn dữ liệu:
 * - Mảng `[{ "label": "...", "value": "..." }]` — giữ đúng thứ tự, dùng cho dữ liệu nhập tay / seed.
 * - Object `{ "Chipset": "Intel B760" }` — crawler ghi dạng này. Lưu ý MySQL không giữ
 *   thứ tự khoá của kiểu JSON (nó tự sắp xếp), nên thứ tự với dạng này không kiểm soát được.
 */
export function readSpecifications(value: Prisma.JsonValue | null): SpecRowDto[] {
  const rows: SpecRowDto[] = [];

  const push = (label: unknown, raw: unknown) => {
    if (typeof label !== "string") return;
    if (typeof raw !== "string" && typeof raw !== "number") return;
    const cleanLabel = label.trim();
    const cleanValue = String(raw).trim();
    if (cleanLabel && cleanValue) rows.push({ label: cleanLabel, value: cleanValue });
  };

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        push(item.label, item.value);
      }
    }
  } else if (value && typeof value === "object") {
    for (const [label, raw] of Object.entries(value)) push(label, raw);
  }

  return rows;
}

export function toProductDto(product: ProductWithRelations): ProductDto {
  const oldPrice = toNumber(product.originalPrice);
  const price = Number(product.sellingPrice);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    summary: product.shortDescription ?? undefined,
    specs: readSpecs(product.shortSpecs),
    price,
    // Chỉ trả giá gốc khi thực sự cao hơn giá bán, tránh hiện "-0%"
    oldPrice: oldPrice && oldPrice > price ? oldPrice : undefined,
    rating: Number(product.ratingAvg),
    reviewCount: product.ratingCount,
    image: product.images[0]?.url ?? undefined,
    categorySlug: product.category.slug,
    categoryName: product.category.name,
    categoryPath: buildCategoryPath(product.category),
    brand: product.brand?.name ?? undefined,
    tag: product.promoTag
      ? {
          label: product.promoTag,
          // promoTone lưu dạng chuỗi tự do trong DB — chỉ nhận giá trị hợp lệ
          tone: VALID_TONES.find((tone) => tone === product.promoTone) ?? "amber",
        }
      : undefined,
    gift: product.giftNote ?? undefined,
    stock: buildStockInfo(product),
    inStock: product.inventoryQuantity - product.reservedQuantity > 0,
  };
}

export function toProductDetailDto(product: ProductDetailRow): ProductDetailDto {
  const available = Math.max(0, product.inventoryQuantity - product.reservedQuantity);

  return {
    ...toProductDto(product),
    sku: product.sku,
    images: product.images.map((image) => ({
      url: image.url,
      alt: image.alt ?? product.name,
    })),
    highlights: readAllShortSpecs(product.shortSpecs),
    description: product.description?.trim() || undefined,
    specifications: readSpecifications(product.specifications),
    warrantyMonths: product.warrantyMonths ?? undefined,
    maxQuantity: Math.min(available, MAX_QUANTITY_PER_LINE),
    breadcrumb: buildBreadcrumb(product.category),
  };
}
