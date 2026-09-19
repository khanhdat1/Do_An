import type { Prisma } from "@pczone/db";
import type { ProductDto, StockInfoDto, Tone } from "../types/dto.js";

/**
 * Kiểu Product kèm quan hệ mà mapper cần.
 * Dùng Prisma.validator để TypeScript tự kiểm tra query và mapper khớp nhau —
 * quên `include` một quan hệ là lỗi biên dịch, không phải lỗi lúc chạy.
 */
export const productInclude = {
  category: { include: { parent: { include: { parent: true } } } },
  brand: true,
  images: {
    where: { isPrimary: true },
    take: 1,
    orderBy: { position: "asc" },
  },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
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
function buildCategoryPath(category: ProductWithRelations["category"]): string[] {
  const path = [category.slug];

  const parent = category.parent;
  if (parent) {
    path.unshift(parent.slug);
    if (parent.parent) {
      path.unshift(parent.parent.slug);
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
function readSpecs(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, 3);
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
