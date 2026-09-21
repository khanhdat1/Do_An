/**
 * Các dòng của hộp gợi ý ở ô tìm kiếm. Dựng thành một danh sách phẳng, đúng thứ tự hiện trên màn hình, để phím mũi tên
 * chỉ cần đi theo chỉ số trong danh sách và Enter biết phải mở địa chỉ nào.
 *
 * File chỉ có hàm thuần.
 */
import { popularSearches } from "@/lib/data/search";
import { searchHref } from "@/lib/search-query";
import type { CategoryFacet, SearchSuggestions, SuggestProduct } from "@/types";

export type SuggestRow =
  | { kind: "product"; id: string; href: string; product: SuggestProduct }
  | { kind: "category"; id: string; href: string; category: CategoryFacet }
  | { kind: "brand"; id: string; href: string; brand: CategoryFacet; search: string }
  /** "Xem tất cả kết quả cho ...": luôn là dòng cuối khi đang gõ, cũng là việc Enter làm khi chưa chọn dòng nào */
  | { kind: "all"; id: string; href: string; search: string; total: number | null }
  | { kind: "recent"; id: string; href: string; search: string }
  | { kind: "popular"; id: string; href: string; search: string };

/** Ô còn trống hoặc mới gõ một ký tự thì chưa gợi ý sản phẩm: một chữ cái khớp gần hết cửa hàng */
export const MIN_SUGGEST_LENGTH = 2;

const POPULAR_SHOWN = 6;

/**
 * Dòng khi đang gõ `query`: sản phẩm khớp nhất, danh mục, hãng rồi "Xem tất cả". `data` có thể là gợi ý của câu gõ
 * trước (đang chờ câu mới); `fresh` = `data` đúng là của `query`, lúc đó mới hiện tổng số kết quả.
 */
export function queryRows(query: string, data: SearchSuggestions | null, fresh: boolean): SuggestRow[] {
  const rows: SuggestRow[] = [];

  for (const product of data?.products ?? []) {
    rows.push({ kind: "product", id: `product:${product.slug}`, href: `/san-pham/${product.slug}`, product });
  }
  for (const category of data?.categories ?? []) {
    rows.push({ kind: "category", id: `category:${category.slug}`, href: `/danh-muc/${category.slug}`, category });
  }
  for (const brand of data?.brands ?? []) {
    rows.push({ kind: "brand", id: `brand:${brand.slug}`, href: searchHref(brand.name), brand, search: brand.name });
  }

  rows.push({
    kind: "all",
    id: "all",
    href: searchHref(query),
    search: query,
    total: fresh && data && data.total > 0 ? data.total : null,
  });
  return rows;
}

/** Dòng khi ô còn trống: các câu đã tìm gần đây rồi các câu phổ biến */
export function idleRows(recent: string[]): SuggestRow[] {
  return [
    ...recent.map((search): SuggestRow => ({ kind: "recent", id: `recent:${search}`, href: searchHref(search), search })),
    ...popularSearches
      .slice(0, POPULAR_SHOWN)
      .map((search): SuggestRow => ({ kind: "popular", id: `popular:${search}`, href: searchHref(search), search })),
  ];
}

export interface SuggestGroup {
  kind: SuggestRow["kind"];
  items: { row: SuggestRow; index: number }[];
}

/** Gom các dòng liền nhau cùng loại thành một nhóm (mỗi nhóm có tiêu đề riêng), giữ chỉ số của từng dòng trong danh sách gốc */
export function groupRows(rows: SuggestRow[]): SuggestGroup[] {
  const groups: SuggestGroup[] = [];
  rows.forEach((row, index) => {
    const last = groups[groups.length - 1];
    if (last && last.kind === row.kind) last.items.push({ row, index });
    else groups.push({ kind: row.kind, items: [{ row, index }] });
  });
  return groups;
}

/** Chữ cần điền vào ô khi chọn dòng này, hoặc `undefined` nếu dòng dẫn tới một trang (sản phẩm, danh mục) */
export function searchTextOf(row: SuggestRow): string | undefined {
  return "search" in row ? row.search : undefined;
}
