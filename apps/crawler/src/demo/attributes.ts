/**
 * Đọc bảng thông số thô của nguồn thành giá trị gọn, nhất quán để dựng bảng thông số, chip và mô tả.
 *
 * Cùng một thông tin nhưng nguồn ghi mỗi sản phẩm mỗi kiểu: "4.2 Ghz", "4.2GHz", "125 w", "24 MB KB",
 * "1Gbps Gb/s", "Intel® Core™ Ultra"... Việc làm sạch nằm hết ở đây để các nơi khác chỉ lo nội dung.
 */
import type { ProductAttribute } from "../gearvn/rsc.js";

/** Làm sạch một giá trị thông số: đơn vị viết đúng, bỏ ký hiệu thương mại và đơn vị bị lặp */
export function cleanValue(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[®™]/g, "")
    .replace(/\s+/g, " ")
    // "Nintendo Switch..." → "Nintendo Switch": dấu ba chấm của nguồn chỉ là chữ thừa và làm câu ghép thành ".."
    .replace(/\s*\.{2,}/g, "")
    .replace(/(\d)\s*ghz\b/gi, "$1 GHz")
    .replace(/(\d)\s*mhz\b/gi, "$1 MHz")
    .replace(/(\d)\s*w\b/g, "$1 W")
    .replace(/(\d)\s+%/g, "$1%")
    // "24 MB KB": nguồn ghép nhầm hai đơn vị, lấy đơn vị đứng ngay sau số
    .replace(/(\d)\s*MB\s*KB\b/gi, "$1 MB")
    // "1Gbps Gb/s", "2.5Gbps Gb/s": đơn vị lặp
    .replace(/(\d(?:\.\d+)?\s*Gbps)\s*Gb\/s/gi, "$1")
    .replace(/\s*;\s*/g, ", ")
    // "( 3.3 GHz" và "42 Wh ,": khoảng trắng thừa quanh ngoặc và dấu phẩy
    .replace(/\(\s+/g, "(")
    .replace(/\s+([),])/g, "$1")
    // Nguồn hay kết thúc giá trị bằng dấu chấm; giữ lại thì câu văn ghép sau đó thành ".."
    .replace(/^[\s,;]+|[\s,;.]+$/g, "");
}

/** Phần đầu của giá trị nhiều ý ("NVIDIA GeForce RTX 5070 8GB; Sức mạnh AI 798 TOPS..." → phần trước dấu ; hoặc ,) */
export function firstPart(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const head = value.split(/\s*[;]\s*|,\s(?=[A-ZÀ-Ỹ])/u)[0]?.trim();
  return head || undefined;
}

/** Số đầu tiên trong chuỗi: "6000 MHz" → 6000; "1,35 V" → 1.35 */
export function firstNumber(value: string | undefined): number | undefined {
  const match = value?.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return undefined;
  const number = Number(match[1].replace(",", "."));
  return Number.isFinite(number) ? number : undefined;
}

/** Dung lượng (GB) từ chuỗi "1000 GB", "2 TB", "512GB", "1024 GB" */
export function toGigabytes(value: string | undefined): number | undefined {
  const match = value?.match(/(\d+(?:[.,]\d+)?)\s*(TB|GB)/i);
  if (!match) return undefined;
  const number = Number(match[1].replace(",", "."));
  return /TB/i.test(match[2]) ? number * 1000 : number;
}

/** 2000 → "2 TB"; 1000 và 1024 → "1 TB"; 512 → "512 GB" */
export function formatCapacity(gigabytes: number): string {
  if (gigabytes >= 900) {
    // Nguồn ghi 1000/2000 (thập phân) hoặc 1024/2048 (nhị phân) tuỳ sản phẩm: cả hai đều là 1 TB, 2 TB
    const terabytes = gigabytes / (gigabytes % 1024 === 0 ? 1024 : 1000);
    return `${Number.isInteger(terabytes) ? terabytes : terabytes.toFixed(1).replace(".", ",")} TB`;
  }
  return `${gigabytes} GB`;
}

/** Đọc bảng thuộc tính theo nhãn. Mẫu (RegExp) khớp nhãn; mẫu đứng trước được ưu tiên. */
export class Attrs {
  private readonly rows: { label: string; value: string }[];

  constructor(attributes: ProductAttribute[]) {
    this.rows = attributes
      .map((attribute) => ({ label: attribute.label.trim(), value: cleanValue(attribute.value) }))
      .filter((row) => row.value !== "");
  }

  get(...patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
      const row = this.rows.find((candidate) => pattern.test(candidate.label));
      if (row) return row.value;
    }
    return undefined;
  }

  /** Giá trị "Có"/"Không" thành boolean; không có thông tin thì undefined */
  flag(...patterns: RegExp[]): boolean | undefined {
    const value = this.get(...patterns);
    if (value === undefined) return undefined;
    // Lookahead Unicode thay cho \b: \b của JS chỉ hiểu chữ ASCII nên "Có" (kết thúc bằng "ó") không bao giờ khớp
    if (/^(có|yes|true)(?![\p{L}\p{N}])/iu.test(value)) return true;
    if (/^(không|no|false)(?![\p{L}\p{N}])/iu.test(value)) return false;
    return undefined;
  }
}
