/**
 * Đọc thông số laptop từ chính tên sản phẩm.
 *
 * Phần lớn trang laptop của GEARVN không có bảng thông số, nhưng tên luôn ghi các thông số quyết định mua
 * trong ngoặc, theo thứ tự cố định:
 *
 *   Laptop gaming ASUS ROG Strix G16 G614PM-TS147W (Ryzen 9-8940HX/ RTX 5060 8GB/ 16GB/ 512GB/ 16" WQXGA 300Hz/ Win 11)
 *                                                    CPU             GPU           RAM   SSD    màn hình            hệ điều hành
 *
 * Hàm này tách từng phần và viết lại thành các dòng thuộc tính cùng nhãn với bảng thông số của nguồn
 * ("CPU", "Card đồ họa", "Dung lượng RAM"...) để các bộ dựng nội dung không phải phân biệt hai nguồn.
 * Phần nào tên không ghi thì bỏ trống — không đoán, không lấy từ nơi khác thiếu tin cậy.
 */
import type { ProductAttribute } from "./rsc.js";

const attribute = (label: string, value: string): ProductAttribute => ({ label, value, highlight: false });

/** Nhóm trong ngoặc chứa thông số: có ít nhất ba dấu "/" ngăn các phần */
function specGroup(name: string): string[] | null {
  const groups = [...name.matchAll(/\(([^()]*)\)/g)].map((match) => match[1]).filter((group) => (group.match(/\//g) ?? []).length >= 2);
  const group = groups.at(-1);
  return group ? group.split("/").map((part) => part.trim()).filter(Boolean) : null;
}

/**
 * "Core 5-210H" → "Intel Core 5 210H"; "I7-13620H" → "Intel Core i7-13620H"; "Ryzen 9-8940HX" → "AMD Ryzen 9 8940HX".
 * Dạng không nhận ra được thì giữ nguyên chữ của nguồn.
 */
export function normalizeCpu(raw: string): string {
  const text = raw.replace(/[®™]/g, "").replace(/\s+/g, " ").trim();

  // Core i3/i5/i7/i9: đời cũ có model 4–5 chữ số (i7-13620H). Model 3 chữ số (i5-120U) là cách viết tắt
  // sai của dòng "Core 5 120U" nên viết lại theo tên thật.
  const intelI = text.match(/^(?:intel\s+)?(?:core\s+)?i([3579])[\s-]+(\d{3,5}[A-Z]*)$/i);
  if (intelI) {
    const model = intelI[2].toUpperCase();
    return /^\d{3}[A-Z]/.test(model) ? `Intel Core ${intelI[1]} ${model}` : `Intel Core i${intelI[1]}-${model}`;
  }

  // "Ultra 9-290HX Plus", "Ultra X9" (Panther Lake dùng chữ X trước số)
  const ultra = text.match(/^(?:intel\s+)?(?:core\s+)?ultra\s+(x?[3579])(?:[\s-]+(\w+))?(\s+plus)?$/i);
  if (ultra) return `Intel Core Ultra ${ultra[1].toUpperCase()}${ultra[2] ? ` ${ultra[2].toUpperCase()}` : ""}${ultra[3] ? " Plus" : ""}`;

  const core = text.match(/^(?:intel\s+)?core\s+([3579])(?:[\s-]+(\w+))?$/i);
  if (core) return `Intel Core ${core[1]}${core[2] ? ` ${core[2].toUpperCase()}` : ""}`;

  const ryzenMax = text.match(/^(?:amd\s+)?ryzen\s+ai\s+max\+?\s+(\d{3})$/i);
  if (ryzenMax) return `AMD Ryzen AI Max+ ${ryzenMax[1]}`;

  // Model 1–2 chữ số ("Ryzen 5 40") là tên bị cắt cụt ở nguồn: chỉ giữ dòng chip, không in con số vô nghĩa
  const ryzen = text.match(/^(?:amd\s+)?ryzen\s+(ai\s+)?([3579])(?:[\s-]+(\w+))?$/i);
  if (ryzen) {
    const model = ryzen[3] && !/^\d{1,2}$/.test(ryzen[3]) ? ` ${ryzen[3].toUpperCase()}` : "";
    return `AMD Ryzen ${ryzen[1] ? "AI " : ""}${ryzen[2]}${model}`;
  }

  // "QC X126100" là cách viết tắt của Snapdragon X X1-26-100
  const snapdragonShort = text.match(/^QC\s+X1(\d{2})(\d{3})$/i);
  if (snapdragonShort) return `Qualcomm Snapdragon X X1-${snapdragonShort[1]}-${snapdragonShort[2]}`;
  if (/^snapdragon\b/i.test(text)) return `Qualcomm ${text}`;

  return text;
}

/** "RTX 5060 8GB" → "NVIDIA GeForce RTX 5060 8GB"; "GeForce RTX™ 4050" → "NVIDIA GeForce RTX 4050"; Radeon → "AMD Radeon ..." */
export function normalizeGpu(raw: string): string | undefined {
  const text = raw.replace(/[®™]/g, "").replace(/\s+/g, " ").trim();
  const nvidia = text.match(/\b((?:RTX|GTX)\s*\d{4}(?:\s*(?:Ti|SUPER))?)(?:\s+Laptop)?(?:\s+(\d{1,2})\s*GB)?/i);
  if (nvidia) {
    const model = nvidia[1].replace(/\s+/g, " ").replace(/(RTX|GTX)(\d)/i, "$1 $2").replace(/\bti\b/i, "Ti").replace(/\bsuper\b/i, "SUPER");
    return `NVIDIA GeForce ${model.toUpperCase().replace("TI", "Ti")}${nvidia[2] ? ` ${nvidia[2]}GB` : ""}`;
  }
  const radeon = text.match(/\b(?:AMD\s+)?Radeon\s+((?:RX\s*)?\w+(?:\s*XT)?)(?:\s+(\d{1,2})\s*GB)?/i);
  if (radeon) return `AMD Radeon ${radeon[1].toUpperCase().startsWith("RX") ? radeon[1].toUpperCase().replace(/^RX\s*/, "RX ") : radeon[1]}${radeon[2] ? ` ${radeon[2]}GB` : ""}`;
  const arc = text.match(/\bIntel\s+Arc\s+(\w+)/i);
  if (arc) return `Intel Arc ${arc[1]}`;
  return undefined;
}

/** Nhãn độ phân giải trong tên → cách viết của bảng thông số. Chỉ thêm số điểm ảnh khi nhãn đó chỉ có một nghĩa. */
const RESOLUTIONS: [RegExp, string][] = [
  [/^WQUXGA/i, "WQUXGA (3840x2400)"],
  [/^WQXGA/i, "WQXGA (2560x1600)"],
  [/^WUXGA/i, "WUXGA (1920x1200)"],
  [/^(?:full\s*hd|fhd)(?!\+)/i, "Full HD (1920x1080)"],
  [/^FHD\+/i, "FHD+"],
  [/^QHD\+/i, "QHD+"],
  [/^QHD/i, "QHD"],
  [/^2\.5K/i, "2.5K"],
  [/^2\.8K/i, "2.8K"],
  [/^2K\+/i, "2K+"],
  [/^2K/i, "2K"],
  [/^3K/i, "3K"],
  [/^4K/i, "4K"],
];

interface Screen {
  size: string;
  resolution?: string;
  panel?: string;
  refresh?: string;
}

/** `16" WQXGA 300Hz`, `15.6" FHD IPS 144Hz`, `14" 3K OLED 120Hz`, `18" WQUXGA 4K IPS Mini LED 120Hz` */
function parseScreen(token: string): Screen | undefined {
  const match = token.match(/^(\d{2}(?:[.,]\d)?)\s*(?:["”″]|inch\b|in\b)\s*(.*)$/i);
  if (!match) return undefined;

  const size = Number(match[1].replace(",", "."));
  if (size < 10 || size > 20) return undefined;

  const rest = match[2];
  const resolutionToken = rest.split(/\s+/).find((word) => RESOLUTIONS.some(([pattern]) => pattern.test(word)));
  const resolution = resolutionToken ? RESOLUTIONS.find(([pattern]) => pattern.test(resolutionToken))?.[1] : undefined;
  const panels = [...rest.matchAll(/\b(IPS|OLED|Mini\s*LED|QLED|TN|VA)\b/gi)].map((panel) => panel[1].replace(/\s+/g, " ").replace(/mini\s*led/i, "Mini LED").toUpperCase().replace("MINI LED", "Mini LED"));
  const refresh = rest.match(/(\d{2,3})\s*Hz/i)?.[1];

  return {
    size: `${Number.isInteger(size) ? size : size.toFixed(1)} inch`,
    resolution,
    panel: panels.length > 0 ? [...new Set(panels)].join(" ") : undefined,
    refresh: refresh ? `${refresh} Hz` : undefined,
  };
}

function normalizeOs(token: string): string | undefined {
  const windows = token.match(/^win(?:dows)?\s*(10|11)\b/i);
  if (windows) return `Windows ${windows[1]}`;
  if (/^(free\s*)?dos$/i.test(token)) return "DOS (chưa kèm Windows)";
  if (/^mac\s*os/i.test(token)) return "macOS";
  return undefined;
}

const isGpuToken = (token: string) => /\b(rtx|gtx|geforce|radeon|arc)\b/i.test(token);
const isStorageToken = (token: string) => /^\d+(?:[.,]\d+)?\s*(?:GB|TB)\b/i.test(token) && !isGpuToken(token);

/**
 * Thông số đọc từ tên một laptop. Trả về mảng rỗng khi tên không có dạng "(CPU/…/RAM/SSD/…)" đủ tin cậy:
 * phải có CPU, RAM và SSD. Với laptop gaming nơi gọi còn nên kiểm tra có card đồ họa.
 *
 * `highlights` (dòng thông số ngắn ở trang danh sách) chỉ dùng khi tên bỏ sót card đồ họa hoặc cỡ màn hình.
 */
export function attributesFromLaptopTitle(name: string, highlights: string[] = []): ProductAttribute[] {
  const tokens = specGroup(name.normalize("NFC"));
  if (!tokens || tokens.length < 3) return [];

  const cpuToken = tokens[0];
  if (!/^(intel|amd|core|ultra|ryzen|i[3579][\s-]|qc\b|snapdragon|apple|m[1-9]\b)/i.test(cpuToken)) return [];

  const gpuToken = tokens.find(isGpuToken);
  const storage = tokens.filter(isStorageToken);
  // RAM đứng trước SSD; chỉ một dung lượng thì không biết là RAM hay SSD nên bỏ cả hai
  if (storage.length < 2) return [];
  const [ramToken, ssdToken] = storage;

  const ram = ramToken.match(/^(\d+)\s*GB/i);
  const ssd = ssdToken.match(/^(\d+(?:[.,]\d+)?)\s*(GB|TB)/i);
  if (!ram || !ssd) return [];
  // RAM laptop không lớn hơn 128 GB; nhỏ hơn 4 GB là nhầm token
  if (Number(ram[1]) < 4 || Number(ram[1]) > 128) return [];

  const screenToken = tokens.map(parseScreen).find((screen): screen is Screen => screen !== undefined);
  const osToken = tokens.map(normalizeOs).find((os): os is string => os !== undefined);

  const gpu =
    (gpuToken ? normalizeGpu(gpuToken) : undefined) ??
    normalizeGpu(highlights.find((highlight) => /^(RTX|GTX)\s*\d{4}/i.test(highlight)) ?? "");
  const size = screenToken?.size ?? highlights.map((highlight) => highlight.match(/^(\d{2}(?:\.\d)?)\s*inch$/i)?.[1]).find(Boolean);
  const ramType = ramToken.match(/\b(LPDDR[45]X?|DDR[45])\b/i)?.[1]?.toUpperCase();

  const attributes: (ProductAttribute | undefined)[] = [
    attribute("CPU", normalizeCpu(cpuToken)),
    gpu ? attribute("Card đồ họa", gpu) : undefined,
    attribute("Dung lượng RAM", `${ram[1]} GB`),
    ramType ? attribute("Loại RAM", ramType) : undefined,
    attribute("Dung lượng SSD", `${ssd[1].replace(",", ".")} ${ssd[2].toUpperCase()}`),
    size ? attribute("Kích thước màn hình", size.includes("inch") ? size : `${size} inch`) : undefined,
    screenToken?.resolution ? attribute("Độ phân giải", screenToken.resolution) : undefined,
    screenToken?.panel ? attribute("Tấm nền", screenToken.panel) : undefined,
    screenToken?.refresh ? attribute("Tần số quét", screenToken.refresh) : undefined,
    osToken ? attribute("Hệ điều hành", osToken) : undefined,
  ];

  return attributes.filter((entry): entry is ProductAttribute => entry !== undefined);
}
