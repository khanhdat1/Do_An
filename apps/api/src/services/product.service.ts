import { prisma, ProductStatus, type Prisma } from "@pczone/db";
import {
  productDetailInclude,
  productInclude,
  toProductDetailDto,
  toProductDto,
} from "../mappers/product.mapper.js";
import { computerFacetRows, computerRowsInCategories } from "../catalog/computer-spec-index.js";
import {
  componentFacetValues,
  componentSpecWhere,
  computeFacetGroups,
  facetProfileOf,
  idsMatching,
  parseSpecSelections,
  SPEC_FACET_COLUMNS,
  type FacetProfile,
  type FacetRow,
  type SpecSelections,
} from "../catalog/spec-filters.js";
import { searchProductIds } from "../search/product-ids.js";
import type { Paginated, ProductDetailDto, ProductDto, ProductFacetsDto } from "../types/dto.js";

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
  /**
   * Bộ lọc thông số (`?socket=AM5&ramType=DDR5`, xem catalog/spec-filters.ts). Chỉ có tác dụng khi có `category`, và chỉ
   * với các nhóm thuộc loại hàng của danh mục đó.
   */
  specs?: SpecSelections;
  sort?: "newest" | "price-asc" | "price-desc" | "best-selling" | "rating";
  page: number;
  pageSize: number;
}

/** Tham số của `GET /api/products/facets`: cùng bộ lọc với danh sách, trừ phần sắp xếp/phân trang */
export type ProductFacetsParams = Pick<ListProductsParams, "category" | "brand" | "search" | "minPrice" | "maxPrice" | "inStock" | "specs">;

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

interface CategoryScope {
  /** Id của danh mục và toàn bộ danh mục con của nó: `?category=linh-kien` lấy được cả CPU, VGA, RAM... */
  ids: string[];
  /** Loại hàng của cả nhánh, quyết định bộ lọc thông số nào dùng được; null = không có */
  profile: FacetProfile | null;
}

/** null khi slug không tồn tại */
async function resolveCategoryScope(slug: string): Promise<CategoryScope | null> {
  const node = { id: true, componentType: true } as const;
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { ...node, children: { select: { ...node, children: { select: node } } } },
  });

  if (!category) return null;

  const nodes = [category, ...category.children.flatMap((child) => [child, ...child.children])];
  return { ids: nodes.map((item) => item.id), profile: facetProfileOf(nodes.map((item) => item.componentType)) };
}

/**
 * Điều kiện của bộ lọc thông số. Linh kiện: lọc thẳng trên các cột của `ProductSpec` (có index theo componentType).
 * Laptop/PC: thông số nằm trong cột JSON nên lấy id các máy khớp từ bản đệm (catalog/computer-spec-index.ts).
 */
async function specConditions(scope: CategoryScope, raw: SpecSelections | undefined): Promise<Prisma.ProductWhereInput[]> {
  if (!scope.profile || !raw) return [];
  const selections = parseSpecSelections(scope.profile, raw);
  if (Object.keys(selections).length === 0) return [];

  if (scope.profile.kind === "component") {
    const spec = componentSpecWhere(scope.profile.type, selections);
    return spec ? [{ spec: { is: spec } }] : [];
  }

  const ids = idsMatching(await computerRowsInCategories(scope.ids), selections);
  return [{ id: { in: ids.length > 0 ? ids : ["__none__"] } }];
}

/** `scope` = danh mục đã tra sẵn (undefined khi không lọc theo danh mục, null khi slug không tồn tại) */
async function buildWhere(
  params: Omit<ListProductsParams, "sort" | "page" | "pageSize">,
  scope: CategoryScope | null | undefined,
): Promise<Prisma.ProductWhereInput> {
  const where: Prisma.ProductWhereInput = { ...PUBLIC_FILTER };

  if (params.category) {
    // Danh mục không tồn tại -> trả rỗng thay vì trả tất cả
    where.categoryId = { in: scope ? scope.ids : ["__none__"] };
    const conditions = scope ? await specConditions(scope, params.specs) : [];
    if (conditions.length > 0) where.AND = conditions;
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
    // Cùng bộ máy với trang tìm kiếm (không phân biệt dấu, từ đồng nghĩa...): xem search/engine.ts.
    // Danh sách này vẫn tự sắp xếp theo `sort`; thứ tự theo độ liên quan chỉ có ở /api/search.
    const ids = await searchProductIds(params.search);
    where.id = { in: ids.length > 0 ? ids : ["__none__"] };
  }

  return where;
}

export async function listProducts(
  params: ListProductsParams,
): Promise<Paginated<ProductDto>> {
  const scope = params.category ? await resolveCategoryScope(params.category) : undefined;
  const where = await buildWhere(params, scope);
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

/** Giá trị lọc của mọi sản phẩm đang bán trong nhánh danh mục — để biết nhóm nào đủ tin cậy và có những lựa chọn nào */
async function loadFacetRows(profile: FacetProfile, where: Prisma.ProductWhereInput): Promise<FacetRow[]> {
  if (profile.kind === "component") {
    const rows = await prisma.product.findMany({ where, select: { id: true, spec: { select: SPEC_FACET_COLUMNS } } });
    return rows.map((row) => ({ id: row.id, values: componentFacetValues(profile.type, row.spec) }));
  }
  const rows = await prisma.product.findMany({ where, select: { id: true } });
  return computerFacetRows(rows.map((row) => row.id));
}

/**
 * Các nhóm lọc thông số của một danh mục và số sản phẩm của từng lựa chọn, tính theo các bộ lọc đang bật
 * (xem `computeFacetGroups`). Danh mục không có bộ lọc thông số trả `groups: []`.
 */
export async function getProductFacets(params: ProductFacetsParams): Promise<ProductFacetsDto> {
  const scope = params.category ? await resolveCategoryScope(params.category) : null;
  if (!scope?.profile) return { groups: [] };
  const { profile } = scope;

  const hasOtherFilters =
    params.brand !== undefined || params.search !== undefined || params.inStock === true || params.minPrice !== undefined || params.maxPrice !== undefined;

  const [rows, matching] = await Promise.all([
    loadFacetRows(profile, { ...PUBLIC_FILTER, categoryId: { in: scope.ids } }),
    // Không bật bộ lọc nào khác thì mọi sản phẩm của danh mục đều được đếm, khỏi tốn thêm một truy vấn
    hasOtherFilters
      ? buildWhere({ ...params, specs: undefined }, scope).then((where) => prisma.product.findMany({ where, select: { id: true } }))
      : null,
  ]);

  const selections = parseSpecSelections(profile, params.specs ?? {});
  const baseIds = matching ? new Set(matching.map((row) => row.id)) : null;
  return { groups: computeFacetGroups(profile, rows, baseIds, selections) };
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
