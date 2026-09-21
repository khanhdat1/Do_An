/**
 * Tên sản phẩm, thương hiệu và mã định danh cho bộ dữ liệu demo.
 *
 * Tên gốc trên nguồn dài và lộn xộn: "Bộ vi xử lý AMD Ryzen 5 7500F / 3.7GHz Boost 5.0GHz / 6 nhân
 * 12 luồng / 38MB / AM5 (Tray)", "Laptop gaming Acer Aspire 7 A715-59G-59RD (Core 5-210H/ RTX 3050 4GB/
 * 16GB/ 512GB/ 15.6" FHD/ Win 11)". Phần thông số đó đã có ở bảng thông số và dòng mô tả ngắn, nên
 * tên hiển thị chỉ giữ phần nhận diện: loại hàng + hãng + dòng + mã máy.
 */
import { createHash } from "node:crypto";
import type { CatalogItem } from "../gearvn/snapshot.js";
import { toSlug } from "../utils.js";
import { Attrs } from "./attributes.js";

export interface BrandInfo {
  name: string;
  slug: string;
}

/**
 * Hãng hay gặp. Thứ tự quan trọng: mẫu hẹp (ROG) đứng trước mẫu rộng (ASUS). Không có NVIDIA/AMD/Intel
 * ở đây: tên card đồ hoạ luôn chứa "GeForce"/"Radeon"/"Arc" nhưng hãng bán là đối tác (ASUS, MSI...).
 */
const BRANDS: { name: string; match: RegExp }[] = [
  { name: "ASUS ROG", match: /\brog\b/i },
  { name: "ASUS", match: /\basus\b|\btuf\b/i },
  { name: "Acer", match: /\bacer\b|\bpredator\b/i },
  { name: "Dell", match: /\bdell\b/i },
  // Đứng trước HP: nguồn ghi "HP HYPERX Cloud…" nhưng thương hiệu bán hàng là HyperX
  { name: "HyperX", match: /\bhyperx\b/i },
  { name: "HP", match: /\bhp\b/i },
  { name: "Lenovo", match: /\blenovo\b/i },
  { name: "MSI", match: /\bmsi\b/i },
  { name: "GIGABYTE", match: /\bgigabyte\b|\baorus\b/i },
  { name: "Samsung", match: /\bsamsung\b/i },
  { name: "LG", match: /\blg\b/i },
  { name: "ViewSonic", match: /\bviewsonic\b/i },
  { name: "BenQ", match: /\bbenq\b/i },
  { name: "AOC", match: /\baoc\b/i },
  { name: "KOORUI", match: /\bkoorui\b/i },
  { name: "VSP", match: /\bvsp\b/i },
  { name: "E-Dra", match: /\be-?dra\b/i },
  { name: "Corsair", match: /\bcorsair\b/i },
  { name: "Kingston", match: /\bkingston\b/i },
  { name: "Kingmax", match: /\bkingmax\b/i },
  { name: "TeamGroup", match: /\bt-?group\b|\bteam\s?group\b|\bt-force\b/i },
  { name: "Crucial", match: /\bcrucial\b/i },
  { name: "Klevv", match: /\bklevv\b/i },
  { name: "SSTC", match: /\bsstc\b/i },
  { name: "SanDisk", match: /\bsandisk\b/i },
  { name: "Zotac", match: /\bzotac\b/i },
  { name: "Sparkle", match: /\bsparkle\b/i },
  { name: "Colorful", match: /\bcolorful\b/i },
  { name: "ASRock", match: /\basrock\b/i },
  { name: "Cooler Master", match: /\bcooler\s?master\b/i },
  { name: "FSP", match: /\bfsp\b/i },
  { name: "Lian Li", match: /\blian\s?li\b/i },
  { name: "NZXT", match: /\bnzxt\b/i },
  { name: "Deepcool", match: /\bdeepcool\b/i },
  { name: "Thermaltake", match: /\bthermaltake\b/i },
  { name: "Jonsbo", match: /\bjonsbo\b/i },
  { name: "HYTE", match: /\bhyte\b/i },
  { name: "Xigmatek", match: /\bxigmatek\b/i },
  { name: "Logitech", match: /\blogitech\b/i },
  { name: "Razer", match: /\brazer\b/i },
  { name: "AKKO", match: /\bakko\b/i },
  { name: "AULA", match: /\baula\b/i },
  { name: "Keychron", match: /\bkeychron\b/i },
  { name: "Veekos", match: /\bveekos\b/i },
  { name: "HyperWork", match: /\bhyperwork\b/i },
  { name: "Rapoo", match: /\brapoo\b/i },
  { name: "SteelSeries", match: /\bsteelseries\b/i },
  { name: "DareU", match: /\bdare-?u\b/i },
  { name: "Edifier", match: /\bedifier\b/i },
  { name: "Microlab", match: /\bmicrolab\b/i },
  { name: "Sony", match: /\bsony\b/i },
  { name: "Warrior", match: /\bwarrior\b/i },
  { name: "Cougar", match: /\bcougar\b/i },
  { name: "AKRacing", match: /\bak\s?racing\b/i },
  { name: "DXRacer", match: /\bdxracer\b/i },
  { name: "Sihoo", match: /\bsihoo\b/i },
  { name: "SoundPeats", match: /\bsound\s?peats\b/i },
  { name: "Onikuma", match: /\bonikuma\b/i },
  // Nguồn ghi hãng "AERO" cho loa Acoustic Energy; loa Mitchell Acoustics không có hãng trên nguồn
  { name: "Acoustic Energy", match: /\bacoustic energy\b/i },
  { name: "Mitchell Acoustics", match: /\bmitchell acoustic/i },
];

/** Hãng trong tên phần cứng lõi: chỉ dùng cho CPU, nơi Intel/AMD chính là hãng bán */
const CHIP_MAKERS: { name: string; match: RegExp }[] = [
  { name: "AMD", match: /\bamd\b|\bryzen\b/i },
  { name: "Intel", match: /\bintel\b|\bcore\b/i },
];

/** Phần tên trước dấu ngoặc đầu tiên: thông số trong ngoặc của laptop ("Ryzen 7…/ RTX 3050…") không phải tên hãng */
const beforeParenthesis = (name: string) => name.split("(")[0];

export function resolveBrand(item: CatalogItem): BrandInfo | null {
  let name: string | undefined;

  if (item.category.startsWith("pc-")) {
    name = "PCZone";
  } else if (item.category === "cpu") {
    name = CHIP_MAKERS.find((maker) => maker.match.test(item.name))?.name;
  } else {
    const head = beforeParenthesis(item.name);
    name = BRANDS.find((brand) => brand.match.test(head))?.name;
  }

  // Không nhận ra từ tên thì tin hãng nguồn ghi, trừ khi nguồn không biết ("Không thương hiệu")
  if (!name && item.brand && !/không thương hiệu/i.test(item.brand)) {
    name = BRANDS.find((brand) => brand.match.test(item.brand ?? ""))?.name ?? item.brand.trim();
  }

  return name ? { name, slug: toSlug(name) } : null;
}

/* -------------------------------------------------------------------------- */
/*  Tên hiển thị                                                              */
/* -------------------------------------------------------------------------- */

/** Chữ hoa/thường chuẩn của tên hãng bên trong tên sản phẩm (nguồn viết "Asus", "Gigabyte", "Msi"...) */
const CANONICAL_CASE = ["ASUS", "GIGABYTE", "MSI", "AOC", "LG", "BenQ", "ViewSonic", "KOORUI", "AKKO", "AULA", "SSTC", "VSP", "HP", "ZOTAC", "NZXT", "FSP", "HYTE", "RAM", "SSD", "HyperX", "DXRacer", "AKRacing", "SteelSeries", "DareU", "SoundPeats", "Warrior", "Sihoo", "Edifier", "Microlab"];

/**
 * Lỗi cách viết lặp lại trong tên của nguồn: HyperX ghi kèm "HP" (chủ sở hữu), một dòng ghế bị gõ nhầm chữ I
 * hoa thành chữ l thường, "CoolerMaster" viết liền trong khi hãng viết "Cooler Master".
 */
const NAME_FIXES: [RegExp, string][] = [
  [/(?<![\p{L}\p{N}])HP\s+HyperX(?![\p{L}\p{N}])/giu, "HyperX"],
  [/(?<![\p{L}\p{N}])lmmortal(?![\p{L}\p{N}])/gu, "Immortal"],
  [/(?<![\p{L}\p{N}])CoolerMaster(?![\p{L}\p{N}])/gu, "Cooler Master"],
];

/** Đầu tên theo danh mục: viết đúng một kiểu để danh sách nhìn đều */
const PREFIXES: Record<string, [RegExp, string][]> = {
  ram: [[/^ram\b/i, "RAM"]],
  ssd: [[/^ổ\s*cứng\s*ssd\b/i, "Ổ cứng SSD"]],
  // "chủ" kết thúc bằng chữ có dấu nên không dùng \b (chỉ hiểu ASCII)
  mainboard: [[/^bo\s*mạch\s*chủ(?![\p{L}\p{N}])/iu, "Bo mạch chủ"]],
  case: [[/^vỏ\s*(máy\s*tính|case)\b/i, "Vỏ case"]],
  psu: [[/^nguồn(\s*máy\s*tính)?\b/i, "Nguồn máy tính"]],
  vga: [[/^card\s*màn\s*hình\b/i, "Card màn hình"]],
  "laptop-gaming": [[/^laptop\s*gaming\b/i, "Laptop gaming"]],
  "ban-phim": [[/^bàn\s*phím\b/i, "Bàn phím"]],
  chuot: [[/^chuột(?![\p{L}\p{N}])/iu, "Chuột"]],
  "tai-nghe": [[/^tai\s*nghe\b/i, "Tai nghe"]],
  loa: [[/^loa\b/i, "Loa"]],
  ghe: [[/^ghế(?![\p{L}\p{N}])/iu, "Ghế"]],
  ban: [[/^bàn\b/i, "Bàn"]],
};

/**
 * Card đồ hoạ của bộ PC, đọc từ tên nguồn ("PC GVN Intel i5-12400F/ VGA RTX 3050 (Main H)"): bảng
 * thông số của các bộ PC cao cấp chỉ có CPU, mainboard, RAM, SSD nên card chỉ còn nằm trong tên.
 */
function gpuFromName(name: string): string | undefined {
  const match = name.match(/\b((?:RTX|GTX|RX|Arc)\s*[A-Z]?\d{3,4}\s*(?:Ti|XT|SUPER)?)\b/i);
  if (!match) return undefined;
  return match[1]
    .replace(/\s+/g, " ")
    .replace(/(\d)(Ti|XT)\b/i, "$1 $2")
    .replace(/^arc\b/i, "Arc")
    .trim();
}

function shortCpu(cpu: string): string {
  return cpu
    .replace(/^intel\s+/i, "")
    .replace(/^amd\s+/i, "")
    .replace(/\bprocessor\s+/i, "")
    .replace(/\bcore\s+i(\d)/i, "i$1")
    .replace(/^I(\d)/, "i$1")
    .trim();
}

const squash = (value: string) => value.replace(/[\s-]+/g, "").toLowerCase();

/**
 * CPU và card đồ hoạ của một bộ PC. Tên máy trên nguồn là thứ người bán cam kết, còn bảng thông số đôi
 * khi ghi sai (vd tên "Ultra 7 265F" nhưng bảng ghi "265KF"), nên tên là chuẩn: bảng thông số chỉ được
 * dùng khi nó khớp tên (để lấy cách viết đầy đủ hơn như "Intel Core i5-12400F", "RTX 3050 6GB").
 */
export function pcParts(item: CatalogItem): { cpu?: string; gpu?: string } {
  const attrs = new Attrs(item.attributes);

  const cpuAttr = attrs.get(/^CPU$/);
  const cpuTitle = item.name.match(/^PC\s+GVN\s+(?:x\s+\w+\s+)?((?:Intel|AMD)[^/]*?)\s*\//i)?.[1]?.trim();
  const cpu = (
    cpuTitle && cpuAttr && squash(cpuAttr).includes(squash(shortCpu(cpuTitle))) ? cpuAttr : cpuTitle ?? cpuAttr
  )
    ?.replace(/^Intel\s+(i[3579]-)/i, "Intel Core $1") // tên nguồn viết "Intel i5-12400F", tên đầy đủ là "Intel Core i5-12400F"
    .replace(/\bCore I([3579]-)/, "Core i$1"); // bảng thông số viết hoa nhầm "Core I7-14700F"

  const gpuAttr = attrs.get(/^Card đồ họa$/);
  const gpuTitle = gpuFromName(item.name);
  const gpu = gpuTitle && gpuAttr && squash(gpuAttr).includes(squash(gpuTitle)) ? gpuAttr : gpuTitle ?? gpuAttr;

  return { cpu, gpu };
}

function pcName(item: CatalogItem): string {
  const { cpu, gpu: gpuFull } = pcParts(item);
  // Tên máy luôn ghi card theo cách viết chuẩn của tên nguồn ("RTX 5060 Ti", "RX 6500 XT", "Arc B580"), không lấy
  // từ bảng thông số vì ở đó có chỗ ghi "GeForce RTX 5060 8GB", "Intel Arc B580 12GB", "RTX 5060Ti"
  const gpu = gpuFromName(item.name) ?? gpuFull?.replace(/\s+\d+\s*GB$/i, "").replace(/^(geforce|intel|amd|radeon)\s+/i, "");
  const kind = item.category === "pc-workstation" ? "Workstation" : "Gaming";

  if (cpu && gpu) return `PC ${kind} PCZone ${shortCpu(cpu)} ${gpu}`;

  // Máy AI/mini không có card rời trong tên: giữ tên nguồn, chỉ thay nhãn cửa hàng
  return item.name.replace(/^PC\s+GVN\s*(x\s*)?/i, `PC ${kind} PCZone `).replace(/\s+/g, " ").trim();
}

function cpuName(name: string): string {
  const head = name.split(" / ")[0];
  const suffix = /\(tray\)/i.test(name) ? " Tray" : /\(box\)/i.test(name) ? " Box" : "";
  return `${head.replace(/^bộ\s*vi\s*xử\s*lý\s+/i, "CPU ")}${suffix}`;
}

export function displayName(item: CatalogItem): string {
  if (item.category.startsWith("pc-")) return pcName(item);

  let name = item.name;
  if (item.category === "cpu") name = cpuName(name);

  name = name
    // Thông số tóm tắt trong ngoặc ("(Core 5/ RTX 3050/ 16GB…)") và mã linh kiện ("(GV-N5060WF2OC-8GD)").
    // Giữ lại "(DDR5)", "(Tray)", "(650W)": đó là thông tin cho người mua, không phải mã kho.
    .replace(/\s*\([^()]*\/[^()]*\)/g, "")
    .replace(/\s*\((?![^)]*\b(?:DDR[345]|Tray|Box)\b)(?!\d+\s*W\))[A-Z0-9][A-Z0-9\-. ]{4,}\)/g, "")
    // Ngoặc bị cắt cụt ở cuối tên: "(GV-N506TWF2MAX OC-8GD"
    .replace(/\s*\([^)]*$/, "")
    .replace(/\s*-\s*nhập khẩu chính hãng\s*$/i, "")
    // "(650W)" ở cuối khi tên đã có "650W" ở trên: nguồn ghi công suất hai lần
    .replace(/\b(\d{3,4})\s?W\b(.*?)\s*\(\1\s?W\)\s*$/i, "$1W$2")
    .replace(/\s+/g, " ")
    .trim();

  // "RTX 5070Ti", "RX 6500XT": nguồn hay viết liền hậu tố, chỗ khác lại viết cách ra — thống nhất có dấu cách
  if (item.category === "vga") name = name.replace(/(\d)(Ti|XT)\b/gi, "$1 $2");

  for (const [pattern, replacement] of PREFIXES[item.category] ?? []) {
    name = name.replace(pattern, replacement);
  }

  for (const word of CANONICAL_CASE) {
    name = name.replace(new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, "giu"), word);
  }

  for (const [pattern, replacement] of NAME_FIXES) name = name.replace(pattern, replacement);

  return name;
}

/* -------------------------------------------------------------------------- */
/*  Mã định danh                                                              */
/* -------------------------------------------------------------------------- */

/** Cùng quy tắc với seed.ts và crawler: PCZ-<DANHMUC>-<HÃNG>-<HASH> */
export function makeSku(categorySlug: string, brandSlug: string | undefined, productSlug: string): string {
  const cat = categorySlug.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const brand = (brandSlug ?? "khac").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const hash = createHash("sha256").update(productSlug).digest("hex").slice(0, 6).toUpperCase();
  return `PCZ-${cat}-${brand}-${hash}`;
}

/** Số giả lập ổn định từ một chuỗi: cùng chuỗi luôn ra cùng số trong [0, 1). Dùng cho tồn kho, số đã bán. */
export function stableFraction(seed: string): number {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 8);
  return parseInt(hex, 16) / 0x100000000;
}

/** Chọn một phương án ổn định theo seed: cùng sản phẩm luôn ra cùng câu văn, sản phẩm khác nhau ra câu khác nhau */
export function pickVariant<T>(seed: string, options: readonly T[]): T {
  return options[Math.floor(stableFraction(seed) * options.length)];
}
