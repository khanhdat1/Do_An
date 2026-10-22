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

/**
 * Tham số của bộ lọc thông số kỹ thuật (?socket=AM5,LGA1851&ramType=DDR5), cùng tên với API
 * (apps/api/src/catalog/spec-filters.ts). Nhóm nào hiện ra, với lựa chọn nào, do `GET /api/products/facets` quyết định.
 */
export const SPEC_FILTER_KEYS = [
  "socket",
  "chipset",
  "formFactor",
  "ramType",
  "ram",
  "vram",
  "storage",
  "interface",
  "wattage",
  "cpuBrand",
  "cpuLine",
  "gpu",
] as const;

export type SpecFilterKey = (typeof SPEC_FILTER_KEYS)[number];

export function isSpecFilterKey(key: string): key is SpecFilterKey {
  return (SPEC_FILTER_KEYS as readonly string[]).includes(key);
}

/** Giá trị đang chọn của từng nhóm thông số; trong một nhóm là HOẶC, giữa các nhóm là VÀ */
export type SpecSelections = Partial<Record<SpecFilterKey, string[]>>;

/** Tên các tham số trên URL mà bộ lọc quản lý (trừ `page`, luôn reset khi đổi bộ lọc) */
export const FILTER_PARAMS = ["brand", "minPrice", "maxPrice", "inStock", ...SPEC_FILTER_KEYS] as const;

export interface CategoryQuery {
  brands: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock: boolean;
  specs: SpecSelections;
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

/** Đúng giới hạn API nhận (chữ, số, dấu chấm, gạch ngang; ≤ 24 ký tự; ≤ 12 giá trị một nhóm): giá trị khác bị bỏ, không làm API báo lỗi */
const SPEC_VALUE = /^[A-Za-z0-9.-]{1,24}$/;
const MAX_SPEC_VALUES = 12;

/** "AM5, lga1851,,<x>" → ["AM5", "lga1851"]; nhóm không còn giá trị nào thì không có khoá */
export function parseSpecSelections(raw: RawParams): SpecSelections {
  const specs: SpecSelections = {};
  for (const key of SPEC_FILTER_KEYS) {
    const values = [
      ...new Set(
        (firstValue(raw[key]) ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter((value) => SPEC_VALUE.test(value)),
      ),
    ].slice(0, MAX_SPEC_VALUES);
    if (values.length > 0) specs[key] = values;
  }
  return specs;
}

/** Bật/tắt một giá trị trong nhóm, giữ thứ tự đã chọn */
export function toggleSpecValue(selected: readonly string[] | undefined, value: string): string[] {
  const current = selected ?? [];
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

/**
 * Lựa chọn còn sản phẩm (hoặc đang chọn) lên trước, lựa chọn đã về 0 xuống cuối, giữ nguyên thứ tự API trong mỗi phần:
 * chọn hãng CPU "AMD" thì mấy dòng đầu (phần không bị "Xem thêm" giấu) là dòng CPU của AMD, không phải dòng Intel đã khoá.
 */
export function orderSpecOptions<T extends { value: string; count: number }>(options: readonly T[], selected: readonly string[]): T[] {
  const available = (option: T) => option.count > 0 || selected.includes(option.value);
  return [...options.filter(available), ...options.filter((option) => !available(option))];
}

/** Tham số gửi API: { socket: "AM5,LGA1851" } */
export function specQueryParams(specs: SpecSelections): Partial<Record<SpecFilterKey, string>> {
  const params: Partial<Record<SpecFilterKey, string>> = {};
  for (const key of SPEC_FILTER_KEYS) {
    const values = specs[key];
    if (values && values.length > 0) params[key] = values.join(",");
  }
  return params;
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
    specs: parseSpecSelections(raw),
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
  for (const [key, value] of Object.entries(specQueryParams(query.specs))) params.set(key, value);
  if (query.sort !== DEFAULT_SORT) params.set("sort", query.sort);
  return params;
}

/** Số bộ lọc đang bật (không tính sắp xếp và trang), để hiện con số trên nút "Bộ lọc". Mỗi giá trị thông số tính là một. */
export function countActiveFilters(
  query: Pick<CategoryQuery, "brands" | "minPrice" | "maxPrice" | "inStock"> & { specs?: SpecSelections },
): number {
  const specCount = Object.values(query.specs ?? {}).reduce((sum, values) => sum + (values?.length ?? 0), 0);
  return (
    query.brands.length +
    (query.minPrice !== undefined || query.maxPrice !== undefined ? 1 : 0) +
    (query.inStock ? 1 : 0) +
    specCount
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
