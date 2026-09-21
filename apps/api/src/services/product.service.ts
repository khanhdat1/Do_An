import { prisma, ProductStatus, type Prisma } from "@pczone/db";
import {
  productDetailInclude,
  productInclude,
  toProductDetailDto,
  toProductDto,
} from "../mappers/product.mapper.js";
import type { Paginated, ProductDetailDto, ProductDto } from "../types/dto.js";

export interface ListProductsParams {
  /** Slug danh mục (lá hoặc cha — cha sẽ lấy cả danh mục con) */
  category?: string;
  /** Slug thương hiệu; nhiều hãng cách nhau dấu phẩy: "asus,msi" */
  brand?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  /** true = chỉ sản phẩm còn hàng (tồn kho trừ số đang giữ chỗ vẫn dương) */
  inStock?: boolean;
  featured?: boolean;
  flashSale?: boolean;
  sort?: "newest" | "price-asc" | "price-desc" | "best-selling" | "rating";
  page: number;
  pageSize: number;
}

/** Chỉ sản phẩm ACTIVE mới được hiện ra ngoài. DRAFT là hàng crawler chờ duyệt. */
export const PUBLIC_FILTER = { status: ProductStatus.ACTIVE } satisfies Prisma.ProductWhereInput;

/**
 * Mỗi kiểu sắp xếp kèm khoá phụ `id`. Thiếu nó, các sản phẩm bằng nhau ở khoá chính (vd cùng
 * soldCount = 0, cùng giá) có thứ tự tuỳ ý giữa hai truy vấn, nên khi bấm sang trang 2 có thể
 * gặp lại sản phẩm đã thấy ở trang 1 và bỏ sót sản phẩm khác.
 */
const SORT_MAP: Record<
  NonNullable<ListProductsParams["sort"]>,
  Prisma.ProductOrderByWithRelationInput[]
> = {
  newest: [{ publishedAt: "desc" }, { id: "asc" }],
  "price-asc": [{ sellingPrice: "asc" }, { id: "asc" }],
  "price-desc": [{ sellingPrice: "desc" }, { id: "asc" }],
  "best-selling": [{ soldCount: "desc" }, { id: "asc" }],
  rating: [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { id: "asc" }],
};

/** "asus, msi,," -> ["asus", "msi"] */
function splitSlugs(value: string): string[] {
  return [...new Set(value.split(",").map((slug) => slug.trim()).filter(Boolean))];
}

/**
 * Trả về slug của danh mục và toàn bộ danh mục con của nó.
 * Nhờ vậy `?category=linh-kien` lấy được cả CPU, VGA, RAM...
 */
async function resolveCategorySlugs(slug: string): Promise<string[]> {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: { children: { include: { children: true } } },
  });

  if (!category) return [];

  const slugs = [category.slug];
  for (const child of category.children) {
    slugs.push(child.slug);
    for (const grandChild of child.children) {
      slugs.push(grandChild.slug);
    }
  }
  return slugs;
}

async function buildWhere(
  params: ListProductsParams,
): Promise<Prisma.ProductWhereInput> {
  const where: Prisma.ProductWhereInput = { ...PUBLIC_FILTER };

  if (params.category) {
    const slugs = await resolveCategorySlugs(params.category);
    // Danh mục không tồn tại -> trả rỗng thay vì trả tất cả
    where.category = { slug: { in: slugs.length ? slugs : ["__none__"] } };
  }

  if (params.brand) {
    const brands = splitSlugs(params.brand);
    if (brands.length > 0) where.brand = { slug: { in: brands } };
  }

  // available > 0  <=>  reservedQuantity < inventoryQuantity (so sánh hai cột bằng field reference)
  if (params.inStock) {
    where.reservedQuantity = { lt: prisma.product.fields.inventoryQuantity };
  }

  if (params.featured) where.isFeatured = true;

  if (params.flashSale) {
    where.isFlashSale = true;
    // Chỉ lấy đợt sale chưa kết thúc
    where.OR = [{ flashSaleEndsAt: null }, { flashSaleEndsAt: { gt: new Date() } }];
  }

  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    where.sellingPrice = {
      ...(params.minPrice !== undefined ? { gte: params.minPrice } : {}),
      ...(params.maxPrice !== undefined ? { lte: params.maxPrice } : {}),
    };
  }

  if (params.search) {
    // `contains` đủ dùng ở quy mô đồ án. Khi dữ liệu lớn, đổi sang
    // fulltext search (schema đã khai báo @@fulltext trên name + shortDescription).
    where.AND = [
      {
        OR: [
          { name: { contains: params.search } },
          { shortDescription: { contains: params.search } },
        ],
      },
    ];
  }

  return where;
}

export async function listProducts(
  params: ListProductsParams,
): Promise<Paginated<ProductDto>> {
  const where = await buildWhere(params);
  const orderBy = SORT_MAP[params.sort ?? "newest"];

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      include: productInclude,
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
  ]);

  return {
    items: rows.map(toProductDto),
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export async function getProductBySlug(slug: string): Promise<ProductDetailDto | null> {
  const product = await prisma.product.findFirst({
    where: { slug, ...PUBLIC_FILTER },
    include: productDetailInclude,
  });

  if (!product) return null;

  // Đếm lượt xem. Không await để không làm chậm response.
  void prisma.product
    .update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);

  return toProductDetailDto(product);
}

/** Sản phẩm bán chạy nhất trong N ngày gần đây (dùng cho "Top bán chạy trong tuần") */
export async function getBestSellers(limit: number): Promise<ProductDto[]> {
  const rows = await prisma.product.findMany({
    where: PUBLIC_FILTER,
    orderBy: { soldCount: "desc" },
    include: productInclude,
    take: limit,
  });
  return rows.map(toProductDto);
}
