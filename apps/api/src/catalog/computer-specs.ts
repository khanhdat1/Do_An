// Đọc thông số của máy tính hoàn chỉnh (laptop, PC lắp sẵn) từ Product.specifications để làm bộ lọc ở trang danh mục.
// Cùng nguyên tắc với pc-build/spec-parser.ts: xác định, không dùng LLM; dòng nào không đọc chắc chắn được thì để null,
// không đoán theo hiểu biết bên ngoài (vd không suy "CPU dòng U thì chỉ có card tích hợp").
import type { Prisma } from "@pczone/db";
import { makeLookup, parseGb } from "../pc-build/spec-parser.js";
import { fold } from "../search/text.js";

export type CpuBrand = "intel" | "amd" | "qualcomm" | "apple";

export const CPU_BRANDS: readonly { value: CpuBrand; label: string }[] = [
  { value: "intel", label: "Intel" },
  { value: "amd", label: "AMD" },
  { value: "qualcomm", label: "Qualcomm" },
  { value: "apple", label: "Apple" },
];

interface CpuLine {
  value: string;
  label: string;
  brand: CpuBrand;
}

const series = (prefix: string, label: string, brand: CpuBrand, tiers: string[]): CpuLine[] =>
  tiers.map((tier) => ({ value: `${prefix}${tier}`, label: `${label}${tier.toUpperCase()}`, brand }));

/** Mọi dòng CPU nhận ra được, theo đúng thứ tự hiện ở bộ lọc: theo hãng, rồi đời cũ → mới, rồi phân khúc thấp → cao */
export const CPU_LINES: readonly CpuLine[] = [
  { value: "celeron", label: "Intel Celeron", brand: "intel" },
  { value: "pentium", label: "Intel Pentium", brand: "intel" },
  ...series("core-i", "Intel Core i", "intel", ["3", "5", "7", "9"]),
  ...series("core-", "Intel Core ", "intel", ["3", "5", "7"]),
  ...series("core-ultra-", "Intel Core Ultra ", "intel", ["3", "5", "7", "9", "x7", "x9"]),
  { value: "athlon", label: "AMD Athlon", brand: "amd" },
  ...series("ryzen-", "AMD Ryzen ", "amd", ["3", "5", "7", "9"]),
  ...series("ryzen-ai-", "AMD Ryzen AI ", "amd", ["5", "7", "9"]),
  { value: "ryzen-ai-max", label: "AMD Ryzen AI Max", brand: "amd" },
  { value: "threadripper", label: "AMD Ryzen Threadripper", brand: "amd" },
  { value: "snapdragon-x", label: "Snapdragon X", brand: "qualcomm" },
  { value: "snapdragon-x2", label: "Snapdragon X2", brand: "qualcomm" },
  ...series("apple-m", "Apple M", "apple", ["1", "2", "3", "4", "5"]),
];

const CPU_LINE_BY_VALUE = new Map(CPU_LINES.map((line) => [line.value, line]));

/**
 * Dòng CPU: "Intel Core i7-13620H" → "core-i7", "Intel Core Ultra 5-125H" → "core-ultra-5", "Intel Core 5 210H" → "core-5",
 * "AMD Ryzen AI MAX+ 392" → "ryzen-ai-max". Thứ tự kiểm tra quan trọng: "Core Ultra 7" phải thử trước "Core 7",
 * "Ryzen AI 7" trước "Ryzen 7". Ra dòng không có trong CPU_LINES (vd "Core Ultra 8") thì trả null.
 */
export function detectCpuLine(raw: string | null): string | null {
  if (!raw) return null;
  const text = fold(raw);
  const value = (() => {
    let match = /\bcore\s*ultra\s*(x?[3579])\b/.exec(text);
    if (match) return `core-ultra-${match[1]}`;
    match = /\bcore\s*i([3579])\b/.exec(text) ?? /\bi([3579])\s*-\s*\d{4,5}/.exec(text);
    if (match) return `core-i${match[1]}`;
    match = /\bcore\s*([357])\b/.exec(text);
    if (match) return `core-${match[1]}`;
    if (/\bceleron\b/.test(text)) return "celeron";
    if (/\bpentium\b/.test(text)) return "pentium";
    if (/\bryzen\s*ai\s*max\b/.test(text)) return "ryzen-ai-max";
    match = /\bryzen\s*ai\s*([579])\b/.exec(text);
    if (match) return `ryzen-ai-${match[1]}`;
    if (/\bthreadripper\b/.test(text)) return "threadripper";
    match = /\bryzen\s*([3579])\b/.exec(text);
    if (match) return `ryzen-${match[1]}`;
    if (/\bathlon\b/.test(text)) return "athlon";
    match = /\bsnapdragon\s*(x2|x)\b/.exec(text);
    if (match) return `snapdragon-${match[1]}`;
    match = /\bapple\s*m([1-5])\b/.exec(text);
    if (match) return `apple-m${match[1]}`;
    return null;
  })();
  return value && CPU_LINE_BY_VALUE.has(value) ? value : null;
}

export function cpuLineLabel(value: string): string {
  return CPU_LINE_BY_VALUE.get(value)?.label ?? value;
}

/** Hãng CPU: lấy theo dòng nếu nhận ra dòng, không thì theo tên hãng ghi trong dòng thông số */
export function detectCpuBrand(raw: string | null): CpuBrand | null {
  const line = detectCpuLine(raw);
  if (line) return CPU_LINE_BY_VALUE.get(line)?.brand ?? null;
  if (!raw) return null;
  const text = fold(raw);
  if (/\bintel\b/.test(text)) return "intel";
  if (/\bamd\b/.test(text)) return "amd";
  if (/\b(qualcomm|snapdragon)\b/.test(text)) return "qualcomm";
  if (/\bapple\b/.test(text)) return "apple";
  return null;
}

/**
 * Dung lượng RAM lắp sẵn (GB): "16GB DDR5 4800MHz (2 x 8GB, nâng cấp tối đa 32GB)" → 16, "2 x 8GB DDR4" → 16.
 * Chỉ đọc cụm GB ĐẦU TIÊN (cụm sau thường là "nâng cấp tối đa"); ngoài 2–512 GB coi như đọc sai.
 */
export function parseRamGb(raw: string | null): number | null {
  // Số thanh không được dính sau chữ cái: "LPDDR5X 16GB" không phải "5 x 16GB"
  const match = raw ? /(?:(?<![a-z\d])(\d+)\s*x\s*)?(?<!\d)(\d+)\s*GB/i.exec(raw) : null;
  if (!match) return null;
  const total = Number(match[2]) * (match[1] ? Number(match[1]) : 1);
  return total >= 2 && total <= 512 ? total : null;
}

/** Đồ hoạ tích hợp trong CPU — một lựa chọn chung, không tách theo tên (Intel Graphics, Radeon 840M, Adreno...) */
export const INTEGRATED_GPU = "tich-hop";

const GPU_SUFFIX_LABEL: Record<string, string> = { ti: "Ti", super: "SUPER", "ti super": "Ti SUPER", xt: "XT", xtx: "XTX", gre: "GRE" };

/**
 * Card đồ hoạ: "NVIDIA GeForce RTX 4070 Ti SUPER 16GB" → "rtx-4070-ti-super", "AMD Radeon RX 6500M" → "rx-6500m",
 * "Intel Arc B580 12GB" → "arc-b580", "Intel UHD Graphics" / "AMD Radeon 840M Graphics" → "tich-hop".
 * Máy có cả card rời lẫn tích hợp ("GeForce RTX 5050 8GB GDDR7 AMD Radeon Graphics") tính theo card rời.
 */
export function detectGpu(raw: string | null): string | null {
  if (!raw) return null;
  const text = fold(raw);

  let match = /\b(rtx|gtx)\s*-?\s*(\d{3,4})(?:\s*(ti\s*super|ti|super))?\b/.exec(text);
  if (match) return [match[1], match[2], ...(match[3] ? match[3].split(/\s+/) : [])].join("-");
  match = /\bmx\s*(\d{3})\b/.exec(text);
  if (match) return `mx-${match[1]}`;

  match = /\brx\s*(\d{3,4})(?:\s*(xtx|xt|gre)|([ms]))?\b/.exec(text);
  if (match) return match[2] ? `rx-${match[1]}-${match[2]}` : `rx-${match[1]}${match[3] ?? ""}`;

  // "Intel Arc B390 GPU (đồ họa tích hợp)" — Arc mã A/B có cả bản tích hợp lẫn card rời, nên dòng ghi rõ "tích hợp" thắng
  if (/tich hop|integrated|onboard/.test(text)) return INTEGRATED_GPU;
  // Arc rời ghi kèm bộ nhớ riêng ("Arc B580 12GB") hoặc là bản laptop đuôi M ("Arc A370M"); có mã mà không rõ thì không đoán
  match = /\barc\s*([ab]\d{3})(m?)\b/.exec(text);
  if (match) return match[2] || /\d+\s*gb\b/.test(text) ? `arc-${match[1]}${match[2]}` : null;

  // "Intel Graphics", "Iris Xe", "Intel Arc 130T", "Radeon 840M", "Radeon 8060S Graphics", "Qualcomm Adreno"
  if (/\b(graphics|iris|uhd|adreno|arc)\b|\bradeon\s*\d{3,4}[ms]\b/.test(text)) return INTEGRATED_GPU;
  return null;
}

/** Nhãn hiển thị của một giá trị `detectGpu` */
export function gpuLabel(value: string): string {
  if (value === INTEGRATED_GPU) return "Đồ họa tích hợp";
  const [family, model, ...suffix] = value.split("-");
  const tail = suffix.length > 0 ? ` ${GPU_SUFFIX_LABEL[suffix.join(" ")] ?? suffix.join(" ").toUpperCase()}` : "";
  if (family === "rtx" || family === "gtx") return `GeForce ${family.toUpperCase()} ${model ?? ""}${tail}`;
  if (family === "mx") return `GeForce MX${model ?? ""}`;
  if (family === "rx") return `Radeon RX ${(model ?? "").toUpperCase()}${tail}`;
  if (family === "arc") return `Intel Arc ${(model ?? "").toUpperCase()}`;
  return value;
}

/** Khoá sắp xếp: NVIDIA → AMD → Intel → tích hợp; trong một hãng theo số model, rồi bản thường → Ti → SUPER → Ti SUPER */
export function gpuSortKey(value: string): [number, number, number] {
  if (value === INTEGRATED_GPU) return [9, 0, 0];
  const [family, model = "", ...suffix] = value.split("-");
  const rank = { rtx: 0, gtx: 0, mx: 0, rx: 1, arc: 2 }[family] ?? 8;
  const number = Number(model.replace(/\D/g, "")) || 0;
  const tail = ["", "ti", "super", "ti super", "gre", "xt", "xtx"].indexOf(suffix.join(" "));
  return [rank, number, tail < 0 ? 9 : tail];
}

/** Thông số đã chuẩn hoá của một máy; null = không có dòng đó hoặc không đọc được */
export interface ComputerSpecs {
  cpuBrand: CpuBrand | null;
  cpuLine: string | null;
  ramGb: number | null;
  gpu: string | null;
  storageGb: number | null;
}

/** Nhãn dòng thông số theo từng nguồn dữ liệu (crawler laptop ghi "CPU", crawler PC ghi "Bộ vi xử lý (CPU)"...) */
const CPU_LABELS = ["CPU", "Bộ vi xử lý (CPU)", "Bộ vi xử lý", "Vi xử lý"];
const RAM_LABELS = ["RAM", "Bộ nhớ RAM"];
const GPU_LABELS = ["Card đồ họa", "Card đồ họa (VGA)", "VGA", "Card màn hình"];
const STORAGE_LABELS = ["Ổ cứng", "Ổ cứng SSD", "SSD", "Lưu trữ"];

/** Không bao giờ ném lỗi với dữ liệu xấu — đọc không được thì các trường là null */
export function parseComputerSpecs(specifications: Prisma.JsonValue | null): ComputerSpecs {
  const get = makeLookup(specifications);
  const cpu = get(...CPU_LABELS);
  const storageGb = parseGb(get(...STORAGE_LABELS));
  return {
    cpuBrand: detectCpuBrand(cpu),
    cpuLine: detectCpuLine(cpu),
    ramGb: parseRamGb(get(...RAM_LABELS)),
    gpu: detectGpu(get(...GPU_LABELS)),
    storageGb: storageGb !== null && storageGb > 0 ? storageGb : null,
  };
}
