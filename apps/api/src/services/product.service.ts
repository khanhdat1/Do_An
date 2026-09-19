import { prisma, ProductStatus, type Prisma } from "@pczone/db";
import { productInclude, toProductDto } from "../mappers/product.mapper.js";
import type { Paginated, ProductDto } from "../types/dto.js";

export interface ListProductsParams {
  /** Slug danh mục (lá hoặc cha — cha sẽ lấy cả danh mục con) */
  category?: string;
  brand?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  featured?: boolean;
  flashSale?: boolean;
  sort?: "newest" | "price-asc" | "price-desc" | "best-selling" | "rating";
  page: number;
  pageSize: number;
}

/** Chỉ sản phẩm ACTIVE mới được hiện ra ngoài. DRAFT là hàng crawler chờ duyệt. */
const PUBLIC_FILTER = { status: ProductStatus.ACTIVE } satisfies Prisma.ProductWhereInput;

const SORT_MAP: Record<
  NonNullable<ListProductsParams["sort"]>,
  Prisma.ProductOrderByWithRelationInput
> = {
  newest: { publishedAt: "desc" },
  "price-asc": { sellingPrice: "asc" },
  "price-desc": { sellingPrice: "desc" },
  "best-selling": { soldCount: "desc" },
  rating: { ratingAvg: "desc" },
};

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
    where.brand = { slug: params.brand };
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

export async function getProductBySlug(slug: string): Promise<ProductDto | null> {
  const product = await prisma.product.findFirst({
    where: { slug, ...PUBLIC_FILTER },
    include: productInclude,
  });

  if (!product) return null;

  // Đếm lượt xem. Không await để không làm chậm response.
  void prisma.product
    .update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);

  return toProductDto(product);
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
