/**
 * Bộ lọc theo thông số kỹ thuật ở trang danh mục (`?socket=AM5,LGA1851&ramType=DDR5`).
 *
 * Mỗi danh mục có một "hồ sơ" quyết định nhóm lọc nào áp dụng được:
 * - linh kiện Build PC (CPU, mainboard, RAM, VGA, SSD, nguồn): đọc bảng `ProductSpec` đã chuẩn hoá, lọc bằng SQL trên
 *   chính các cột đó;
 * - máy tính hoàn chỉnh (laptop, PC lắp sẵn — danh mục không gắn `componentType`): đọc thông số trích từ
 *   `Product.specifications` (catalog/computer-specs.ts).
 * Danh mục trộn nhiều loại linh kiện ("Linh kiện") hoặc loại không có nhóm lọc (vỏ case, màn hình, gear) không có bộ lọc thông số.
 *
 * Một nhóm chỉ hiện ra khi dữ liệu đủ tin cậy: ít nhất MIN_COVERAGE sản phẩm của danh mục đọc được giá trị và có từ 2
 * giá trị khác nhau trở lên — lọc trên một nhóm mà nửa danh mục không có dữ liệu sẽ âm thầm giấu mất các sản phẩm đó.
 *
 * File chỉ có hàm thuần (không gọi DB) để kiểm thử được: xem spec-filters.test.ts.
 */
import type { ComponentType, Prisma } from "@pczone/db";
import { BOARD_SIZES } from "../pc-build/spec-types.js";
import type { SpecFacetGroupDto } from "../types/dto.js";
import { CPU_BRANDS, CPU_LINES, cpuLineLabel, gpuLabel, gpuSortKey, type ComputerSpecs } from "./computer-specs.js";

/** Tên tham số trên URL của mọi nhóm lọc thông số (cùng tên giữa các danh mục khi cùng nghĩa: `storage`, `ram`) */
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

/** Giá trị đang chọn của từng nhóm; trong một nhóm là HOẶC, giữa các nhóm là VÀ */
export type SpecSelections = Partial<Record<SpecFilterKey, string[]>>;

/** Giá trị của MỘT sản phẩm ở từng nhóm; thiếu khoá = không có dữ liệu */
export type FacetValues = Partial<Record<SpecFilterKey, string>>;

export interface FacetRow {
  id: string;
  values: FacetValues;
}

/** Tỉ lệ sản phẩm tối thiểu của danh mục phải đọc được giá trị thì nhóm lọc mới hiện ra */
export const MIN_COVERAGE = 0.8;

/** Các cột `ProductSpec` mà bộ lọc linh kiện đọc */
export const SPEC_FACET_COLUMNS = {
  componentType: true,
  socket: true,
  chipset: true,
  formFactor: true,
  ramType: true,
  ramCapacity: true,
  vramGb: true,
  storageCapacityGb: true,
  storageInterface: true,
  psuWattage: true,
} satisfies Prisma.ProductSpecSelect;

export type SpecFacetRow = Prisma.ProductSpecGetPayload<{ select: typeof SPEC_FACET_COLUMNS }>;

interface FacetDef<Source> {
  key: SpecFilterKey;
  label: string;
  /** Giá trị của một sản phẩm; null = không có dữ liệu */
  read: (source: Source) => string | null;
  /** Một giá trị trên URL → dạng chuẩn để so sánh; null = bỏ qua */
  parse: (token: string) => string | null;
  labelOf: (value: string) => string;
  compare: (a: string, b: string) => number;
}

interface ComponentFacetDef extends FacetDef<SpecFacetRow> {
  /** Điều kiện SQL trên `ProductSpec` đúng bằng "read(row) thuộc values" — để danh sách khớp với con số đếm */
  where: (values: string[]) => Prisma.ProductSpecWhereInput;
}

type ComputerFacetDef = FacetDef<ComputerSpecs>;

/* -------------------------------------------------------------------------- */
/*  Dải giá trị                                                               */
/* -------------------------------------------------------------------------- */

interface Range {
  value: string;
  label: string;
  min: number;
  /** null = không giới hạn trên */
  max: number | null;
}

/** Mức dung lượng lưu trữ: hãng ghi 500 hay 512 GB, 960 hay 1000 GB cho cùng một phân khúc */
export const STORAGE_TIERS: readonly Range[] = [
  { value: "128", label: "120/128 GB", min: 120, max: 128 },
  { value: "256", label: "240/256 GB", min: 240, max: 256 },
  { value: "512", label: "500/512 GB", min: 480, max: 512 },
  { value: "1000", label: "1 TB", min: 960, max: 1024 },
  { value: "2000", label: "2 TB", min: 1920, max: 2048 },
  { value: "4000", label: "4 TB", min: 3840, max: 4096 },
  { value: "8000", label: "8 TB", min: 7680, max: 8192 },
];

/** Mức công suất nguồn: chọn nguồn là chọn "từ X W trở lên", nên lọc theo khoảng thay vì từng con số */
export const WATTAGE_BUCKETS: readonly Range[] = [
  { value: "duoi-600", label: "Dưới 600 W", min: 0, max: 599 },
  { value: "600-749", label: "600 – 749 W", min: 600, max: 749 },
  { value: "750-999", label: "750 – 999 W", min: 750, max: 999 },
  { value: "tu-1000", label: "Từ 1000 W", min: 1000, max: null },
];

function rangeOf(ranges: readonly Range[], amount: number | null): string | null {
  if (amount === null) return null;
  return ranges.find((range) => amount >= range.min && (range.max === null || amount <= range.max))?.value ?? null;
}

export const storageTierOf = (gb: number | null) => rangeOf(STORAGE_TIERS, gb);
export const wattageBucketOf = (watts: number | null) => rangeOf(WATTAGE_BUCKETS, watts);

function rangeWhere(ranges: readonly Range[], values: string[], column: "storageCapacityGb" | "psuWattage"): Prisma.ProductSpecWhereInput {
  const selected = ranges.filter((range) => values.includes(range.value));
  // Giá trị lạ trên URL: không khớp gì, như hãng không tồn tại
  if (selected.length === 0) return { id: { in: [] } };
  return {
    OR: selected.map((range): Prisma.ProductSpecWhereInput => {
      const bounds = { gte: range.min, ...(range.max === null ? {} : { lte: range.max }) };
      return column === "storageCapacityGb" ? { storageCapacityGb: bounds } : { psuWattage: bounds };
    }),
  };
}

/** "NVMe PCIe 4.0 x4" → "pcie4". Chỉ nhận đúng dạng mà spec-parser ghi ("[NVMe ]PCIe x.y…") để khớp với điều kiện SQL */
export function pcieGenOf(storageInterface: string | null): string | null {
  const match = storageInterface ? /^(?:nvme )?pcie ([345])\./i.exec(storageInterface) : null;
  return match ? `pcie${match[1]}` : null;
}

/* -------------------------------------------------------------------------- */
/*  Định nghĩa các nhóm                                                        */
/* -------------------------------------------------------------------------- */

const byText = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });
const byNumber = (a: string, b: string) => Number(a) - Number(b) || byText(a, b);
/** Theo thứ tự cho trước; giá trị ngoài danh sách (lạ trên URL) xếp cuối */
const byOrder = (order: readonly string[]) => (a: string, b: string) => {
  const rank = (value: string) => (order.includes(value) ? order.indexOf(value) : order.length);
  return rank(a) - rank(b) || byText(a, b);
};
const byRanges = (ranges: readonly Range[]) => byOrder(ranges.map((range) => range.value));

const SLUG = /^[a-z0-9.-]+$/;
const asUpper = (token: string) => (SLUG.test(token.toLowerCase()) ? token.toUpperCase() : null);
const asSlug = (token: string) => (SLUG.test(token.toLowerCase()) ? token.toLowerCase() : null);
const asPositiveInt = (token: string) => (/^\d{1,5}$/.test(token) && Number(token) > 0 ? String(Number(token)) : null);
/** Không phân biệt hoa thường nhưng trả đúng cách viết chuẩn: "matx" → "mATX" */
const oneOf = (values: readonly string[]) => (token: string) => values.find((value) => value.toLowerCase() === token.toLowerCase()) ?? null;
const gbLabel = (value: string) => `${value} GB`;
const rangeLabel = (ranges: readonly Range[]) => (value: string) => ranges.find((range) => range.value === value)?.label ?? value;

const BOARD_LABELS: Record<string, string> = { "E-ATX": "E-ATX", ATX: "ATX", mATX: "Micro-ATX", ITX: "Mini-ITX" };
const PCIE_GENS = ["3", "4", "5"];

const socket: ComponentFacetDef = {
  key: "socket",
  label: "Socket",
  read: (spec) => spec.socket,
  parse: asUpper,
  labelOf: (value) => value,
  compare: byText,
  where: (values) => ({ socket: { in: values } }),
};

const chipset: ComponentFacetDef = {
  key: "chipset",
  label: "Chipset",
  read: (spec) => spec.chipset,
  parse: asUpper,
  labelOf: (value) => value,
  compare: byText,
  where: (values) => ({ chipset: { in: values } }),
};

const formFactor: ComponentFacetDef = {
  key: "formFactor",
  label: "Kích thước",
  read: (spec) => spec.formFactor,
  parse: oneOf(BOARD_SIZES),
  labelOf: (value) => BOARD_LABELS[value] ?? value,
  compare: byOrder(BOARD_SIZES),
  where: (values) => ({ formFactor: { in: values } }),
};

const ramType: ComponentFacetDef = {
  key: "ramType",
  label: "Loại RAM",
  read: (spec) => spec.ramType,
  parse: asUpper,
  labelOf: (value) => value,
  compare: byText,
  where: (values) => ({ ramType: { in: values } }),
};

const ramCapacity: ComponentFacetDef = {
  key: "ram",
  label: "Dung lượng",
  read: (spec) => (spec.ramCapacity === null ? null : String(spec.ramCapacity)),
  parse: asPositiveInt,
  labelOf: gbLabel,
  compare: byNumber,
  where: (values) => ({ ramCapacity: { in: values.map(Number) } }),
};

const vram: ComponentFacetDef = {
  key: "vram",
  label: "Bộ nhớ (VRAM)",
  read: (spec) => (spec.vramGb === null ? null : String(spec.vramGb)),
  parse: asPositiveInt,
  labelOf: gbLabel,
  compare: byNumber,
  where: (values) => ({ vramGb: { in: values.map(Number) } }),
};

const ssdCapacity: ComponentFacetDef = {
  key: "storage",
  label: "Dung lượng",
  read: (spec) => storageTierOf(spec.storageCapacityGb),
  parse: oneOf(STORAGE_TIERS.map((tier) => tier.value)),
  labelOf: rangeLabel(STORAGE_TIERS),
  compare: byRanges(STORAGE_TIERS),
  where: (values) => rangeWhere(STORAGE_TIERS, values, "storageCapacityGb"),
};

const ssdInterface: ComponentFacetDef = {
  key: "interface",
  label: "Chuẩn kết nối",
  read: (spec) => pcieGenOf(spec.storageInterface),
  parse: oneOf(PCIE_GENS.map((gen) => `pcie${gen}`)),
  labelOf: (value) => `PCIe ${value.replace("pcie", "")}.0`,
  compare: byText,
  where: (values) => ({
    OR: values.flatMap((value) => {
      const gen = value.replace("pcie", "");
      return [{ storageInterface: { startsWith: `PCIe ${gen}.` } }, { storageInterface: { startsWith: `NVMe PCIe ${gen}.` } }];
    }),
  }),
};

const wattage: ComponentFacetDef = {
  key: "wattage",
  label: "Công suất",
  read: (spec) => wattageBucketOf(spec.psuWattage),
  parse: oneOf(WATTAGE_BUCKETS.map((bucket) => bucket.value)),
  labelOf: rangeLabel(WATTAGE_BUCKETS),
  compare: byRanges(WATTAGE_BUCKETS),
  where: (values) => rangeWhere(WATTAGE_BUCKETS, values, "psuWattage"),
};

/** Nhóm lọc theo loại linh kiện. Vỏ case chưa có: dữ liệu cỡ mainboard nó nhận còn thiếu ở đa số sản phẩm */
export const COMPONENT_FACETS: Partial<Record<ComponentType, readonly ComponentFacetDef[]>> = {
  CPU: [socket],
  MAINBOARD: [socket, chipset, formFactor, ramType],
  RAM: [ramType, ramCapacity],
  VGA: [vram],
  SSD: [ssdCapacity, ssdInterface],
  PSU: [wattage],
};

export const COMPUTER_FACETS: readonly ComputerFacetDef[] = [
  {
    key: "cpuBrand",
    label: "Hãng CPU",
    read: (specs) => specs.cpuBrand,
    parse: asSlug,
    labelOf: (value) => CPU_BRANDS.find((brand) => brand.value === value)?.label ?? value,
    compare: byOrder(CPU_BRANDS.map((brand) => brand.value)),
  },
  {
    key: "cpuLine",
    label: "Dòng CPU",
    read: (specs) => specs.cpuLine,
    parse: asSlug,
    labelOf: cpuLineLabel,
    compare: byOrder(CPU_LINES.map((line) => line.value)),
  },
  {
    key: "ram",
    label: "RAM",
    read: (specs) => (specs.ramGb === null ? null : String(specs.ramGb)),
    parse: asPositiveInt,
    labelOf: gbLabel,
    compare: byNumber,
  },
  {
    key: "gpu",
    label: "Card đồ họa",
    read: (specs) => specs.gpu,
    parse: asSlug,
    labelOf: gpuLabel,
    compare: (a, b) => {
      const [x, y] = [gpuSortKey(a), gpuSortKey(b)];
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || byText(a, b);
    },
  },
  {
    key: "storage",
    label: "Ổ cứng",
    read: (specs) => storageTierOf(specs.storageGb),
    parse: oneOf(STORAGE_TIERS.map((tier) => tier.value)),
    labelOf: rangeLabel(STORAGE_TIERS),
    compare: byRanges(STORAGE_TIERS),
  },
];

/* -------------------------------------------------------------------------- */
/*  Hồ sơ danh mục                                                             */
/* -------------------------------------------------------------------------- */

export type FacetProfile = { kind: "component"; type: ComponentType } | { kind: "computer" };

/**
 * Hồ sơ lọc của một danh mục, theo `componentType` của nó và mọi danh mục con:
 * không gắn loại nào → máy tính hoàn chỉnh; đúng một loại linh kiện có nhóm lọc → linh kiện đó; còn lại → không lọc.
 */
export function facetProfileOf(componentTypes: readonly (ComponentType | null)[]): FacetProfile | null {
  const types = [...new Set(componentTypes.filter((type): type is ComponentType => type !== null))];
  if (types.length === 0) return { kind: "computer" };
  const [type] = types;
  return types.length === 1 && COMPONENT_FACETS[type] ? { kind: "component", type } : null;
}

function defsOf(profile: FacetProfile): readonly FacetDef<never>[] {
  return profile.kind === "component" ? (COMPONENT_FACETS[profile.type] ?? []) : COMPUTER_FACETS;
}

/**
 * Giá trị trên URL (đã tách dấu phẩy) → giá trị chuẩn, chỉ giữ nhóm thuộc hồ sơ của danh mục: `?socket=AM5` ở trang
 * laptop bị bỏ qua thay vì làm danh sách rỗng. Giá trị đúng định dạng nhưng không có sản phẩm nào vẫn giữ (khớp 0 sản phẩm).
 */
export function parseSpecSelections(profile: FacetProfile, raw: SpecSelections): SpecSelections {
  const selections: SpecSelections = {};
  for (const def of defsOf(profile)) {
    const values = [...new Set((raw[def.key] ?? []).map((token) => def.parse(token.trim())).filter((value): value is string => value !== null))];
    if (values.length > 0) selections[def.key] = values;
  }
  return selections;
}

/** Điều kiện trên `ProductSpec` của các nhóm đang chọn; null khi không chọn nhóm nào */
export function componentSpecWhere(type: ComponentType, selections: SpecSelections): Prisma.ProductSpecWhereInput | null {
  const conditions = (COMPONENT_FACETS[type] ?? []).flatMap((def) => {
    const values = selections[def.key];
    return values && values.length > 0 ? [def.where(values)] : [];
  });
  // Kèm componentType để MySQL đi được các index (componentType, socket | ramType | psuWattage | formFactor)
  return conditions.length > 0 ? { componentType: type, AND: conditions } : null;
}

/** Giá trị lọc của một linh kiện; dòng spec của loại khác (danh mục vừa đổi, chưa đồng bộ lại) coi như chưa có dữ liệu */
export function componentFacetValues(type: ComponentType, spec: SpecFacetRow | null): FacetValues {
  const values: FacetValues = {};
  if (!spec || spec.componentType !== type) return values;
  for (const def of COMPONENT_FACETS[type] ?? []) {
    const value = def.read(spec);
    if (value !== null) values[def.key] = value;
  }
  return values;
}

export function computerFacetValues(specs: ComputerSpecs): FacetValues {
  const values: FacetValues = {};
  for (const def of COMPUTER_FACETS) {
    const value = def.read(specs);
    if (value !== null) values[def.key] = value;
  }
  return values;
}

/** Sản phẩm thoả mọi nhóm đang chọn (trừ nhóm `skip`, dùng khi đếm cho chính nhóm đó) */
export function matchesSelections(values: FacetValues, selections: SpecSelections, skip?: SpecFilterKey): boolean {
  for (const key of SPEC_FILTER_KEYS) {
    const selected = selections[key];
    if (key === skip || !selected || selected.length === 0) continue;
    const value = values[key];
    if (value === undefined || !selected.includes(value)) return false;
  }
  return true;
}

/**
 * Các nhóm lọc kèm số sản phẩm của từng lựa chọn.
 *
 * - Lựa chọn và độ tin cậy tính trên TOÀN BỘ sản phẩm đang bán của danh mục (`rows`), nên nhóm không tự biến mất
 *   hay đổi thứ tự khi người dùng lọc.
 * - Con số tính trên sản phẩm khớp các bộ lọc khác (`baseIds`: hãng, giá, còn hàng; null = mọi sản phẩm) và các nhóm
 *   thông số KHÁC: trong cùng một nhóm các giá trị là HOẶC, nên chọn "AM5" không làm "AM4" về 0.
 * - Nhóm không đủ tin cậy vẫn hiện nếu URL đang chọn giá trị của nó, để người dùng bỏ chọn được.
 */
export function computeFacetGroups(
  profile: FacetProfile,
  rows: readonly FacetRow[],
  baseIds: ReadonlySet<string> | null,
  selections: SpecSelections,
): SpecFacetGroupDto[] {
  const groups: SpecFacetGroupDto[] = [];

  for (const def of defsOf(profile)) {
    const selected = selections[def.key] ?? [];
    const known = new Set<string>();
    let covered = 0;
    for (const row of rows) {
      const value = row.values[def.key];
      if (value === undefined) continue;
      covered++;
      known.add(value);
    }

    const reliable = rows.length > 0 && covered / rows.length >= MIN_COVERAGE && known.size >= 2;
    if (!reliable && selected.length === 0) continue;

    const counts = new Map<string, number>();
    for (const row of rows) {
      const value = row.values[def.key];
      if (value === undefined || (baseIds && !baseIds.has(row.id)) || !matchesSelections(row.values, selections, def.key)) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    const options = [...new Set([...known, ...selected])].sort(def.compare);
    groups.push({
      key: def.key,
      label: def.label,
      options: options.map((value) => ({ value, label: def.labelOf(value), count: counts.get(value) ?? 0 })),
    });
  }

  return groups;
}

/** Id các máy khớp mọi nhóm đang chọn — với máy tính hoàn chỉnh, điều kiện lọc là danh sách id này */
export function idsMatching(rows: Iterable<FacetRow>, selections: SpecSelections): string[] {
  const ids: string[] = [];
  for (const row of rows) if (matchesSelections(row.values, selections)) ids.push(row.id);
  return ids;
}
