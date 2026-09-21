/**
 * Tham số của trang tìm kiếm nằm hết trên URL, như trang danh mục (xem lib/category-query.ts):
 *   /tim-kiem?q=laptop+gaming&category=laptop-gaming&brand=asus,msi&minPrice=...&inStock=true&sort=price-asc&page=2
 * Gửi link cho người khác là ra đúng kết quả, bấm Back về đúng bộ lọc trước, và trang render được ở phía server.
 *
 * File chỉ có hàm thuần, dùng được cả ở Server Component lẫn Client Component.
 */
import { SORT_OPTIONS, parseCategoryQuery, type CategoryQuery } from "@/lib/category-query";

/** Cùng cỡ trang với trang danh mục: 12 chia hết cho 2, 3, 4 cột nên lưới luôn đầy hàng */
export const SEARCH_PAGE_SIZE = 12;

/** Câu tìm kiếm dài hơn vô nghĩa và chỉ tốn công API; cắt ở đây thay vì để API từ chối */
export const MAX_QUERY_LENGTH = 100;

export const SEARCH_SORT_OPTIONS = [{ value: "relevance", label: "Liên quan nhất" }, ...SORT_OPTIONS] as const;

export type SearchSortKey = (typeof SEARCH_SORT_OPTIONS)[number]["value"];

export const DEFAULT_SEARCH_SORT: SearchSortKey = "relevance";

export interface SearchQuery extends Omit<CategoryQuery, "sort"> {
  /** Câu tìm kiếm, đã gọn khoảng trắng; rỗng nếu chưa nhập gì */
  q: string;
  /** Slug danh mục (lá hoặc cha) đang lọc */
  category?: string;
  sort: SearchSortKey;
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Gọn khoảng trắng và cắt độ dài: "  laptop   gaming " → "laptop gaming" */
export function cleanQuery(text: string | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

/** Đọc `searchParams` của Next thành bộ lọc đã kiểm tra: giá trị lạ trên URL rơi về mặc định, không gây lỗi */
export function parseSearchQuery(raw: RawParams): SearchQuery {
  // Kiểu sắp xếp đọc riêng bên dưới: `parseCategoryQuery` chỉ biết các kiểu của trang danh mục, không biết "relevance"
  const { brands, minPrice, maxPrice, inStock, page } = parseCategoryQuery(raw);
  const category = first(raw.category)?.trim();

  return {
    brands,
    minPrice,
    maxPrice,
    inStock,
    page,
    q: cleanQuery(first(raw.q)),
    category: category && /^[a-z0-9-]{1,100}$/.test(category) ? category : undefined,
    sort: SEARCH_SORT_OPTIONS.find((option) => option.value === first(raw.sort))?.value ?? DEFAULT_SEARCH_SORT,
  };
}

/** Dựng lại tham số URL từ bộ lọc (bỏ giá trị mặc định, không gồm `page`) — dùng cho liên kết phân trang */
export function toSearchPageParams(query: SearchQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.brands.length > 0) params.set("brand", query.brands.join(","));
  if (query.minPrice !== undefined) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) params.set("maxPrice", String(query.maxPrice));
  if (query.inStock) params.set("inStock", "true");
  if (query.sort !== DEFAULT_SEARCH_SORT) params.set("sort", query.sort);
  return params;
}

/** Địa chỉ trang tìm kiếm cho một câu: "/tim-kiem?q=ban+phim+co" */
export function searchHref(q: string): string {
  const text = cleanQuery(q);
  return text ? `/tim-kiem?${new URLSearchParams({ q: text }).toString()}` : "/tim-kiem";
}
