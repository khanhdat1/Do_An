/**
 * Bộ lọc của trang danh mục nằm hết trên URL (?brand=asus,msi&minPrice=3000000&sort=price-asc&page=2)
 * thay vì trong state của trình duyệt. Nhờ vậy: gửi link cho người khác là ra đúng kết quả đang
 * xem, bấm Back quay lại đúng bộ lọc trước, và trang vẫn render được ở phía server.
 *
 * File chỉ có hàm thuần, dùng được cả ở Server Component lẫn Client Component.
 */

export const SORT_OPTIONS = [
  { value: "best-selling", label: "Bán chạy nhất" },
  { value: "newest", label: "Mới nhất" },
  { value: "price-asc", label: "Giá thấp → cao" },
  { value: "price-desc", label: "Giá cao → thấp" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export const DEFAULT_SORT: SortKey = "best-selling";

/** 12 chia hết cho 2, 3, 4: lưới 2 cột (mobile), 3 cột (tablet) và 4 cột (desktop) luôn đầy hàng */
export const CATEGORY_PAGE_SIZE = 12;

/** Tên các tham số trên URL mà bộ lọc quản lý (trừ `page`, luôn reset khi đổi bộ lọc) */
export const FILTER_PARAMS = ["brand", "minPrice", "maxPrice", "inStock"] as const;

export interface CategoryQuery {
  brands: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock: boolean;
  sort: SortKey;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function readInt(value: string | string[] | undefined): number | undefined {
  const text = firstValue(value);
  if (text === undefined || text.trim() === "") return undefined;
  const number = Number(text);
  return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
}

/** Đọc `searchParams` của Next thành bộ lọc đã kiểm tra: giá trị lạ trên URL rơi về mặc định, không gây lỗi */
export function parseCategoryQuery(raw: RawParams): CategoryQuery {
  const brands = [
    ...new Set(
      (firstValue(raw.brand) ?? "")
        .split(",")
        .map((slug) => slug.trim())
        .filter(Boolean),
    ),
  ].slice(0, 20);

  const minPrice = readInt(raw.minPrice);
  const maxPrice = readInt(raw.maxPrice);

  return {
    brands,
    minPrice,
    // Người dùng gõ ngược (từ 9 triệu đến 3 triệu): bỏ cận trên thay vì trả về danh sách rỗng khó hiểu
    maxPrice: minPrice !== undefined && maxPrice !== undefined && maxPrice < minPrice ? undefined : maxPrice,
    inStock: firstValue(raw.inStock) === "true",
    sort: SORT_OPTIONS.find((option) => option.value === firstValue(raw.sort))?.value ?? DEFAULT_SORT,
    page: Math.max(1, readInt(raw.page) ?? 1),
  };
}

/** Dựng lại tham số URL từ bộ lọc (bỏ giá trị mặc định, không gồm `page`) — dùng cho liên kết phân trang */
export function toSearchParams(query: CategoryQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.brands.length > 0) params.set("brand", query.brands.join(","));
  if (query.minPrice !== undefined) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) params.set("maxPrice", String(query.maxPrice));
  if (query.inStock) params.set("inStock", "true");
  if (query.sort !== DEFAULT_SORT) params.set("sort", query.sort);
  return params;
}

/** Số bộ lọc đang bật (không tính sắp xếp và trang), để hiện con số trên nút "Bộ lọc" */
export function countActiveFilters(query: Pick<CategoryQuery, "brands" | "minPrice" | "maxPrice" | "inStock">): number {
  return (
    query.brands.length +
    (query.minPrice !== undefined || query.maxPrice !== undefined ? 1 : 0) +
    (query.inStock ? 1 : 0)
  );
}

/* -------------------------------------------------------------------------- */
/*  Khoảng giá gợi ý                                                          */
/* -------------------------------------------------------------------------- */

export interface PriceBracket {
  label: string;
  /** Cận dưới; undefined = không giới hạn */
  min?: number;
  /** Cận trên; undefined = không giới hạn */
  max?: number;
}

/** Làm tròn về bội của nửa bậc lớn: 905.000 → 900.000, 2,7 triệu → 2,5 triệu, 8,2 triệu → 8 triệu */
function niceRound(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude / 2;
  return Math.max(step, Math.round(value / step) * step);
}

/** 2_500_000 → "2,5 triệu"; 900_000 → "900 nghìn" */
function shortMoney(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1).replace(".", ",")} triệu`;
  }
  return `${Math.round(value / 1000)} nghìn`;
}

/**
 * Chia khoảng giá của danh mục thành tối đa 4 mức "tròn". Chia theo cấp số nhân chứ không chia đều:
 * giá phần cứng lệch mạnh (RAM từ 300 nghìn tới 25 triệu), chia đều thì gần như mọi sản phẩm rơi
 * vào mức đầu tiên.
 */
export function buildPriceBrackets(range: { min: number; max: number } | null): PriceBracket[] {
  if (!range || range.min <= 0 || range.max <= range.min * 1.5) return [];

  const ratio = range.max / range.min;
  const cuts = [1, 2, 3]
    .map((index) => niceRound(range.min * ratio ** (index / 4)))
    .filter((cut, index, all) => cut > range.min && cut < range.max && all.indexOf(cut) === index);

  if (cuts.length === 0) return [];

  // Các mức nửa mở [a, b): sản phẩm đúng bằng mốc chỉ thuộc mức phía trên, không lọt vào hai mức
  const brackets: PriceBracket[] = [{ label: `Dưới ${shortMoney(cuts[0])}`, max: cuts[0] - 1 }];
  for (let index = 0; index < cuts.length - 1; index++) {
    brackets.push({
      label: `${shortMoney(cuts[index])} – ${shortMoney(cuts[index + 1])}`,
      min: cuts[index],
      max: cuts[index + 1] - 1,
    });
  }
  brackets.push({ label: `Trên ${shortMoney(cuts[cuts.length - 1])}`, min: cuts[cuts.length - 1] });

  return brackets;
}
