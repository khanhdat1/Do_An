// Đọc Product.specifications (bảng nhãn–giá trị crawler ghi theo template cố định) thành NormalizedSpec.
// Xác định, không dùng LLM; không đọc được thì để null — không đoán, không suy từ "hiểu biết bên ngoài".
import type { Prisma } from "@pczone/db";
import { readSpecifications } from "../mappers/product.mapper.js";
import { fold, normalize } from "../search/text.js";
import type { BuildSlot } from "./slots.js";
import { BOARD_SIZES, type BoardSize, emptySpec, type NormalizedSpec } from "./spec-types.js";

type Lookup = (...labels: string[]) => string | null;

/** So nhãn không dấu, không phân biệt hoa thường; truyền nhiều nhãn = thử lần lượt */
function makeLookup(specifications: Prisma.JsonValue | null): Lookup {
  const byLabel = new Map<string, string>();
  for (const row of readSpecifications(specifications)) {
    const key = normalize(row.label);
    if (!byLabel.has(key)) byLabel.set(key, row.value);
  }
  return (...labels) => {
    for (const label of labels) {
      const value = byLabel.get(normalize(label));
      if (value !== undefined) return value;
    }
    return null;
  };
}

function toNumber(text: string): number {
  return Number(text.replace(",", "."));
}

function matchNumber(pattern: RegExp, text: string | null): number | null {
  const match = text ? pattern.exec(text) : null;
  if (!match) return null;
  const value = toNumber(match[1]);
  return Number.isFinite(value) ? value : null;
}

/** "LGA 1700" → "LGA1700", "AM5" → "AM5"; tìm được cả trong câu dài ("... Processors (LGA1700) ...") */
export function normalizeSocket(raw: string | null): string | null {
  const match = raw ? /\bLGA\s*-?\s*(\d{3,4})\b|\b(AM[2-5])\b/i.exec(raw) : null;
  if (!match) return null;
  return match[1] ? `LGA${match[1]}` : match[2].toUpperCase();
}

/** "DDR5, 4 khe, tối đa 192 GB" / "DDR5-5200, tối đa 128GB" → "DDR5" */
export function normalizeRamType(raw: string | null): string | null {
  const match = raw ? /\bDDR\s*([3-5])\b/i.exec(raw) : null;
  return match ? `DDR${match[1]}` : null;
}

/** "AMD B650" / "- Intel ® B760" → "B650" / "B760" */
export function normalizeChipset(raw: string | null): string | null {
  const match = raw ? /\b([ABHQWXZ]\d{3}E?)\b/i.exec(raw) : null;
  return match ? match[1].toUpperCase() : null;
}

/** Nhận cả cách ghi lệch và lỗi gõ có thật trong dữ liệu: "M-ATX", "m-ATX", "Micro-TX", "Mini iTX" */
function boardSizeFromToken(token: string): BoardSize | null {
  const text = fold(token).replace(/[^a-z]/g, "");
  if (text.endsWith("itx")) return "ITX";
  if (text === "eatx") return "E-ATX";
  if (text === "matx" || text === "microatx" || text === "microtx") return "mATX";
  if (text === "atx") return "ATX";
  return null;
}

/** Cỡ của một mainboard: "Micro-ATX" → "mATX" */
export function normalizeBoardSize(raw: string | null): BoardSize | null {
  return raw ? boardSizeFromToken(raw.replace(/\(.*?\)/g, "")) : null;
}

/** Các cỡ mainboard vỏ case nhận, bỏ trùng, lớn → nhỏ: "ITX, Micro-ATX, ATX (khi …)" → ["ATX", "mATX", "ITX"] */
export function parseCaseFormFactors(raw: string | null): BoardSize[] | null {
  if (!raw) return null;
  const found = new Set<BoardSize>();
  for (const token of raw.replace(/\(.*?\)/g, "").split(",")) {
    const size = boardSizeFromToken(token);
    if (size) found.add(size);
  }
  return found.size > 0 ? BOARD_SIZES.filter((size) => found.has(size)) : null;
}

/** Số oát đầu tiên: "650 W" → 650, "750W trở lên" → 750, "125 W (tối đa 250 W)" → 125 */
export function parseWatts(raw: string | null): number | null {
  return matchNumber(/(\d{2,4})\s*W\b/i, raw);
}

/** "125 W (tối đa 250 W)" → { tdp: 125, max: 250 } */
export function parseCpuPower(raw: string | null): { tdp: number | null; max: number | null } {
  return { tdp: parseWatts(raw), max: raw ? matchNumber(/toi da\s*(\d{2,4})\s*w/, fold(raw)) : null };
}

/**
 * Thứ tự 3 chiều không cố định trong dữ liệu ("199 x 40 x 116 mm") nên lấy số lớn nhất, làm tròn lên
 * (dài hơn = kiểm tra chặt hơn). Ngoài 100–450 mm coi như đọc sai.
 */
export function parseGpuLengthMm(raw: string | null): number | null {
  if (!raw) return null;
  const numbers = [...raw.replace(/\(.*?\)/g, "").matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => toNumber(match[0]));
  if (numbers.length === 0) return null;
  const length = Math.ceil(Math.max(...numbers));
  return length >= 100 && length <= 450 ? length : null;
}

/** "3 quạt, 3.8 slot" → 3.8; "305 x 138 x 65mm (chiếm 3.25 khe)" → 3.3 (cột lưu 1 chữ số thập phân) */
export function parseSlotWidth(...sources: (string | null)[]): number | null {
  for (const source of sources) {
    if (!source) continue;
    const value = matchNumber(/(\d+(?:[.,]\d+)?)\s*slot/i, source) ?? matchNumber(/(\d+(?:[.,]\d+)?)\s*khe/, fold(source));
    if (value !== null && value >= 1 && value <= 5) return Math.round(value * 10) / 10;
  }
  return null;
}

/** Quy ra GB: "8 GB GDDR7" → 8, "1 TB" → 1000 */
export function parseGb(raw: string | null): number | null {
  const match = raw ? /(\d+(?:[.,]\d+)?)\s*(GB|TB)\b/i.exec(raw) : null;
  if (!match) return null;
  const value = toNumber(match[1]) * (match[2].toUpperCase() === "TB" ? 1000 : 1);
  return Number.isFinite(value) ? Math.round(value) : null;
}

/** Khoảng trống trong vỏ làm tròn xuống (nhỏ hơn = kiểm tra chặt hơn): "350 mm" → 350 */
export function parseMm(raw: string | null): number | null {
  const value = matchNumber(/(\d+(?:[.,]\d+)?)/, raw);
  return value !== null && value > 0 ? Math.floor(value) : null;
}

/** "NVMe PCIe Gen 4.0 x4" / "M.2 2280, NVMe 2.0 PCIe 4.0 x4" → "NVMe PCIe 4.0 x4" (cột chỉ 30 ký tự) */
export function normalizeStorageInterface(raw: string | null): string | null {
  if (!raw) return null;
  const pcie = /PCIe\s*(?:Gen\s*)?(\d)(?:\.(\d))?(?:\s*(x\d+))?/i.exec(raw);
  if (!pcie) return null;
  const nvme = /nvme/i.test(raw) ? "NVMe " : "";
  return `${nvme}PCIe ${pcie[1]}.${pcie[2] ?? "0"}${pcie[3] ? ` ${pcie[3].toLowerCase()}` : ""}`;
}

/** "M.2 2280", tìm được cả khi nằm lẫn trong dòng chuẩn kết nối */
export function normalizeStorageFormFactor(raw: string | null): string | null {
  const match = raw ? /M\.2\s*(\d{4})/i.exec(raw) : null;
  return match ? `M.2 ${match[1]}` : null;
}

function parseCpu(get: Lookup, spec: NormalizedSpec): void {
  spec.socket = normalizeSocket(get("Socket"));

  const cores = /(\d+)\s*nhan\s*[/,]\s*(\d+)\s*luong/.exec(fold(get("Số nhân / luồng") ?? ""));
  if (cores) {
    spec.cpuCores = Number(cores[1]);
    spec.cpuThreads = Number(cores[2]);
  }

  const clocks = fold(get("Xung nhịp") ?? "");
  spec.baseClock = matchNumber(/co ban\s*(\d+(?:[.,]\d+)?)/, clocks);
  spec.boostClock = matchNumber(/toi da\s*(\d+(?:[.,]\d+)?)/, clocks);

  const power = parseCpuPower(get("TDP"));
  spec.tdpWatts = power.tdp;
  if (power.max !== null) spec.extra.maxPowerW = power.max;

  const igpu = get("Đồ họa tích hợp");
  spec.hasIgpu = igpu === null ? null : !fold(igpu).startsWith("khong");

  // Chỉ tin dòng ghi rõ: bản "Box" chưa chắc có tản nhiệt (7800X3D Box vẫn không kèm)
  const cooler = fold(get("Tản nhiệt kèm theo") ?? "");
  if (cooler.startsWith("khong")) spec.extra.coolerIncluded = false;
  else if (cooler.startsWith("co")) spec.extra.coolerIncluded = true;

  spec.ramType = normalizeRamType(get("Bộ nhớ hỗ trợ"));
}

function parseMainboard(get: Lookup, spec: NormalizedSpec): void {
  spec.chipset = normalizeChipset(get("Chipset"));
  // Sản phẩm nguồn KCCSHOP (tiếng Anh) không có dòng "Socket" — socket nằm trong dòng "CPU"
  spec.socket = normalizeSocket(get("Socket")) ?? normalizeSocket(get("CPU"));
  spec.formFactor = normalizeBoardSize(get("Kích thước (form factor)"));

  const memory = get("Bộ nhớ");
  if (memory) {
    const folded = fold(memory);
    spec.ramType = normalizeRamType(memory);
    spec.ramSlots = matchNumber(/(\d+)\s*khe/, folded);
    spec.maxRamGb = matchNumber(/toi da\s*(\d+)\s*gb/, folded);
    return;
  }

  const memoryEn = get("Memory");
  spec.ramType = normalizeRamType(memoryEn);
  spec.ramSlots = matchNumber(/(\d+)\s*x\s*DDR\d\s*DIMM\s*Slots?/i, memoryEn);
  spec.maxRamGb = matchNumber(/max\.?\s*capacity[^:]*:\s*(\d+)\s*GB/i, memoryEn);
}

function parseRam(get: Lookup, spec: NormalizedSpec): void {
  spec.ramType = normalizeRamType(get("Loại RAM"));

  const capacity = get("Dung lượng");
  spec.ramCapacity = parseGb(capacity);

  const kit = capacity ? /(\d+)\s*x\s*\d+\s*GB/i.exec(capacity) : null;
  if (kit) spec.ramModules = Number(kit[1]);
  else if (fold(get("Chế độ kênh") ?? "").startsWith("single channel")) spec.ramModules = 1;

  spec.ramSpeed = matchNumber(/(\d{3,5})\s*(?:MHz|MT\/s)/i, get("Tốc độ (Bus)", "Tốc độ"));
}

function parseVga(get: Lookup, spec: NormalizedSpec): void {
  spec.vramGb = parseGb(get("Bộ nhớ"));
  spec.tdpWatts = parseWatts(get("Công suất (TDP)"));

  const recommended = parseWatts(get("Nguồn đề xuất", "Nguồn khuyến nghị"));
  if (recommended !== null) spec.extra.recommendedPsuW = recommended;

  spec.gpuPowerPins = get("Đầu cấp nguồn", "Nguồn cấp");

  const size = get("Kích thước card", "Kích thước");
  spec.gpuLengthMm = parseGpuLengthMm(size);
  spec.gpuSlotWidth = parseSlotWidth(get("Tản nhiệt"), size);
}

function parseSsd(get: Lookup, spec: NormalizedSpec): void {
  spec.storageCapacityGb = parseGb(get("Dung lượng"));
  const iface = get("Chuẩn kết nối");
  spec.storageInterface = normalizeStorageInterface(iface);
  spec.storageFormFactor = normalizeStorageFormFactor(get("Form factor")) ?? normalizeStorageFormFactor(iface);
}

function parsePsu(get: Lookup, spec: NormalizedSpec, name: string): void {
  const fromLabel = parseWatts(get("Công suất"));
  const fromName = parseWatts(name);

  if (fromLabel !== null && fromName !== null && fromLabel !== fromName) {
    spec.psuWattage = Math.min(fromLabel, fromName);
    spec.extra.notes = [`Công suất mâu thuẫn: thông số ghi ${fromLabel}W, tên ghi ${fromName}W — dùng ${spec.psuWattage}W (an toàn hơn)`];
  } else if (fromLabel !== null) {
    spec.psuWattage = fromLabel;
  } else if (fromName !== null) {
    spec.psuWattage = fromName;
    spec.extra.notes = [`Không có dòng "Công suất" — lấy ${fromName}W từ tên sản phẩm`];
  }

  spec.psuEfficiency = get("Chứng nhận hiệu suất");

  const wiring = fold(get("Kiểu dây") ?? "");
  spec.psuModular = wiring.includes("full") ? "Full" : wiring.includes("semi") ? "Semi" : wiring.includes("non") ? "Non" : null;

  const standard = get("Chuẩn nguồn") ?? "";
  spec.psuFormFactor = /sfx/i.test(standard) ? "SFX" : /atx/i.test(standard) ? "ATX" : null;
}

function parseCase(get: Lookup, spec: NormalizedSpec): void {
  spec.caseFormFactors = parseCaseFormFactors(get("Hỗ trợ bo mạch chủ"));
  spec.caseMaxGpuMm = parseMm(get("Độ dài VGA tối đa"));
  spec.caseMaxCoolerMm = parseMm(get("Chiều cao tản CPU tối đa"));
}

/** Không bao giờ ném lỗi với dữ liệu xấu — đọc không được thì các trường là null */
export function parseProductSpec(product: {
  componentType: BuildSlot;
  name: string;
  specifications: Prisma.JsonValue | null;
}): NormalizedSpec {
  const spec = emptySpec();
  const get = makeLookup(product.specifications);

  switch (product.componentType) {
    case "CPU":
      parseCpu(get, spec);
      break;
    case "MAINBOARD":
      parseMainboard(get, spec);
      break;
    case "RAM":
      parseRam(get, spec);
      break;
    case "VGA":
      parseVga(get, spec);
      break;
    case "SSD":
      parseSsd(get, spec);
      break;
    case "PSU":
      parsePsu(get, spec, product.name);
      break;
    case "CASE":
      parseCase(get, spec);
      break;
  }

  return spec;
}
