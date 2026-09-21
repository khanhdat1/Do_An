import { prisma } from "@pczone/db";
import { productInclude, toProductDto } from "../mappers/product.mapper.js";
import {
  buildFacets,
  filterMatches,
  matchQuery,
  sortMatches,
  suggestBrands,
  suggestCategories,
  type Filters,
  type ScoredDoc,
  type SearchSort,
} from "../search/engine.js";
import { getSearchIndex } from "../search/index-store.js";
import type { ProductDto, SearchResultDto, SearchSuggestDto } from "../types/dto.js";
import { PUBLIC_FILTER } from "./product.service.js";

export interface SearchParams {
  q: string;
  /** Slug danh mục (lá hoặc cha) */
  category?: string;
  /** Slug hãng; nhiều hãng cách nhau dấu phẩy */
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort: SearchSort;
  page: number;
  pageSize: number;
}

const splitSlugs = (value: string) => [...new Set(value.split(",").map((slug) => slug.trim()).filter(Boolean))];

/** Một câu `IN (...)` quá dài làm chậm MySQL; kho lớn thì chia nhỏ */
const ID_CHUNK = 1000;

/**
 * Giữ lại các sản phẩm CÒN HÀNG theo số liệu tồn kho hiện tại. Chỉ mục có cờ còn hàng nhưng nó có thể cũ tới một phút,
 * còn bộ lọc "chỉ hàng còn" phải đúng ngay lúc bấm (khách vừa mua hết mẫu cuối), nên hỏi lại DB — cùng điều kiện với
 * `inStock` của /api/products.
 */
async function keepAvailable(items: ScoredDoc[]): Promise<ScoredDoc[]> {
  const available = new Set<string>();
  for (let start = 0; start < items.length; start += ID_CHUNK) {
    const rows = await prisma.product.findMany({
      where: {
        id: { in: items.slice(start, start + ID_CHUNK).map((item) => item.doc.id) },
        reservedQuantity: { lt: prisma.product.fields.inventoryQuantity },
      },
      select: { id: true },
    });
    for (const row of rows) available.add(row.id);
  }
  return items.filter((item) => available.has(item.doc.id));
}

/** Đọc thẻ sản phẩm cho một trang kết quả từ DB (giá, ảnh, tồn kho luôn mới), giữ đúng thứ tự id; bỏ sản phẩm vừa bị ẩn */
async function loadProducts(ids: string[]): Promise<ProductDto[]> {
  if (ids.length === 0) return [];

  const rows = await prisma.product.findMany({
    where: { id: { in: ids }, ...PUBLIC_FILTER },
    include: productInclude,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toProductDto(row)] : [];
  });
}

export async function searchProducts(params: SearchParams): Promise<SearchResultDto> {
  const index = await getSearchIndex();
  const match = matchQuery(index, params.q);

  // Khoảng giá người dùng chọn trên giao diện luôn thắng cụm giá gõ trong câu ("dưới 30 triệu")
  const explicitPrice = params.minPrice !== undefined || params.maxPrice !== undefined;
  const intent = explicitPrice ? null : match.priceIntent;

  const filters: Filters = {
    category: params.category,
    brands: params.brand ? splitSlugs(params.brand) : undefined,
    minPrice: params.minPrice ?? intent?.min,
    maxPrice: params.maxPrice ?? intent?.max,
  };

  let list = filterMatches(match.matches, filters);
  if (params.inStock && list.length > 0) list = await keepAvailable(list);
  list = sortMatches(list, params.sort);

  const total = list.length;
  const start = (params.page - 1) * params.pageSize;
  const items = await loadProducts(list.slice(start, start + params.pageSize).map((item) => item.doc.id));

  return {
    items,
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
    query: params.q.trim(),
    terms: match.terms,
    corrections: match.corrections,
    ignoredTerms: match.ignored,
    relaxed: match.relaxed,
    priceIntent: intent
      ? { label: intent.label, minPrice: intent.min, maxPrice: intent.max, queryWithoutPrice: intent.rest }
      : undefined,
    facets: buildFacets(match.matches, filters),
  };
}

/**
 * Gợi ý khi gõ: vài sản phẩm khớp nhất, kèm danh mục và hãng có tên khớp câu đang gõ. Không có từ khoá thật
 * (đang gõ dở "dưới 5 triệu") thì chưa gợi ý gì.
 */
export async function suggestSearch(query: string, limit: number): Promise<SearchSuggestDto> {
  const index = await getSearchIndex();
  const match = matchQuery(index, query);

  if (!match.hasKeywords || match.terms.length === 0) {
    return { query: query.trim(), total: 0, terms: [], products: [], categories: [], brands: [] };
  }

  const list = filterMatches(match.matches, { minPrice: match.priceIntent?.min, maxPrice: match.priceIntent?.max });
  const products = await loadProducts(list.slice(0, limit).map((item) => item.doc.id));

  return {
    query: query.trim(),
    total: list.length,
    terms: match.terms,
    products: products.map((product) => ({
      slug: product.slug,
      name: product.name,
      price: product.price,
      oldPrice: product.oldPrice,
      image: product.image,
      categoryName: product.categoryName,
      brand: product.brand,
      categoryPath: product.categoryPath,
      inStock: product.inStock,
    })),
    categories: suggestCategories(index, match.terms, 3).map(({ slug, name, count }) => ({ slug, name, count })),
    brands: suggestBrands(index, match.terms, 3).map(({ slug, name, count }) => ({ slug, name, count })),
  };
}
