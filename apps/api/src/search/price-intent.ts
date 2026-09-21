/**
 * Hiểu ý định về giá trong câu tìm kiếm: "laptop gaming dưới 30 triệu", "chuột từ 500k đến 2 triệu",
 * "màn hình 27 inch khoảng 5 triệu", "ssd 1tb 2-3 triệu".
 *
 * Cụm giá được cắt ra khỏi câu và đổi thành bộ lọc khoảng giá; phần còn lại mới là từ khoá tìm sản phẩm. Nếu không
 * cắt, "dưới", "30", "triệu" sẽ bị coi là từ khoá bắt buộc và không sản phẩm nào chứa.
 *
 * Chỉ nhận cụm có ĐỦ manh mối là giá, vì nhiều thông số trông giống số tiền: "4k" là độ phân giải chứ không phải
 * 4.000đ, "16gb - 32gb" là dung lượng. Nên đơn vị "k" và số trần chỉ được hiểu là tiền khi đi sau từ chỉ giá
 * (dưới, trên, từ, khoảng...) hoặc thành một khoảng "a - b triệu"; còn "15 triệu" / "15tr" luôn là tiền.
 */
import { fold } from "./text.js";

export interface PriceIntent {
  min?: number;
  max?: number;
  /** Nhãn hiện cho người dùng: "Dưới 30 triệu", "Từ 10 triệu đến 20 triệu" */
  label: string;
  /** Phần câu tìm kiếm còn lại sau khi cắt cụm giá (giữ nguyên dấu, đã gọn khoảng trắng) */
  rest: string;
}

const NUMBER = String.raw`(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)`;
const UNIT = String.raw`(trieu|tr|nghin|ngan|k|dong|d|vnd)`;
const START = String.raw`(?<![a-z0-9])`;
const END = String.raw`(?![a-z0-9])`;

const MULTIPLIER: Record<string, number> = { trieu: 1_000_000, tr: 1_000_000, nghin: 1_000, ngan: 1_000, k: 1_000, dong: 1, d: 1, vnd: 1 };

/** "1.500.000" → 1500000 (chấm ngăn nghìn), "1,5" → 1.5 */
function toNumber(text: string): number {
  return /^\d{1,3}(\.\d{3})+$/.test(text) ? Number(text.replace(/\./g, "")) : Number(text.replace(",", "."));
}

/** Số tiền (đồng). Không có đơn vị thì chỉ nhận khi con số đã đủ lớn để là đồng ("30" có thể là 30 triệu hay 30 inch) */
function amount(numberText: string, unit: string | undefined): number | null {
  const value = toNumber(numberText);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (unit) return Math.round(value * MULTIPLIER[unit]);
  return value >= 10_000 ? Math.round(value) : null;
}

/** 30_000_000 → "30 triệu", 2_500_000 → "2,5 triệu", 500_000 → "500 nghìn" */
function money(value: number): string {
  if (value >= 1_000_000) {
    const millions = Math.round((value / 1_000_000) * 10) / 10;
    return `${String(millions).replace(".", ",")} triệu`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)} nghìn`;
  return `${value}đ`;
}

/** Làm tròn đến nghìn: khoảng quanh 15 triệu → 12.000.000 – 18.000.000, không lẻ tới từng đồng */
const roundThousand = (value: number) => Math.round(value / 1_000) * 1_000;

type Built = { min?: number; max?: number; label: string } | null;

interface Rule {
  pattern: RegExp;
  build: (match: RegExpExecArray) => Built;
}

/** Hai đầu của một khoảng: đơn vị ghi ở một đầu áp cho cả hai ("10 - 20 triệu"), đảo lại nếu gõ ngược */
function range(low: string, lowUnit: string | undefined, high: string, highUnit: string | undefined): Built {
  const a = amount(low, lowUnit ?? highUnit);
  const b = amount(high, highUnit ?? lowUnit);
  if (a === null || b === null) return null;
  const [min, max] = a <= b ? [a, b] : [b, a];
  return { min, max, label: `Từ ${money(min)} đến ${money(max)}` };
}

const RULES: Rule[] = [
  // từ 10 đến 20 triệu · từ 500k tới 2 triệu
  {
    pattern: new RegExp(`${START}(?:tu|from)\\s+${NUMBER}\\s*${UNIT}?\\s*(?:den|toi|to|-|~)\\s*${NUMBER}\\s*${UNIT}?${END}`),
    build: (m) => range(m[1], m[2], m[3], m[4]),
  },
  // 10-20 triệu · 10 tr - 20 tr (đầu sau bắt buộc có đơn vị tiền: "16gb - 32gb" không phải giá)
  {
    pattern: new RegExp(`${START}${NUMBER}\\s*${UNIT}?\\s*(?:-|~|den)\\s*${NUMBER}\\s*${UNIT}${END}`),
    build: (m) => range(m[1], m[2], m[3], m[4]),
  },
  // dưới 30 triệu · tối đa 500k · < 2tr
  {
    pattern: new RegExp(`(?:${START}(?:duoi|nho hon|toi da|khong qua|it hon|under|below|max)|<=?)\\s*${NUMBER}\\s*${UNIT}?${END}`),
    build: (m) => {
      const max = amount(m[1], m[2]);
      return max === null ? null : { max, label: `Dưới ${money(max)}` };
    },
  },
  // trên 20 triệu · tối thiểu 1tr · > 5 triệu
  {
    pattern: new RegExp(`(?:${START}(?:tren|lon hon|toi thieu|it nhat|over|above|min)|>=?)\\s*${NUMBER}\\s*${UNIT}?${END}`),
    build: (m) => {
      const min = amount(m[1], m[2]);
      return min === null ? null : { min, label: `Trên ${money(min)}` };
    },
  },
  // từ 10 triệu (không có "đến")
  {
    pattern: new RegExp(`${START}(?:tu|from)\\s+${NUMBER}\\s*${UNIT}?${END}`),
    build: (m) => {
      const min = amount(m[1], m[2]);
      return min === null ? null : { min, label: `Từ ${money(min)}` };
    },
  },
  // khoảng 15 triệu · tầm 15tr · ~15 triệu
  {
    pattern: new RegExp(`(?:${START}(?:khoang|tam|gan|around|about)|~)\\s*${NUMBER}\\s*${UNIT}?${END}`),
    build: (m) => {
      const centre = amount(m[1], m[2]);
      if (centre === null) return null;
      return { min: roundThousand(centre * 0.8), max: roundThousand(centre * 1.2), label: `Khoảng ${money(centre)}` };
    },
  },
  // "15 triệu", "15tr" đứng một mình: ngân sách quanh mức đó. Chỉ triệu/tr, không nhận "k" vì "4k" là độ phân giải
  {
    pattern: new RegExp(`${START}${NUMBER}\\s*(trieu|tr)${END}`),
    build: (m) => {
      const centre = amount(m[1], m[2]);
      if (centre === null) return null;
      return { min: roundThousand(centre * 0.8), max: roundThousand(centre * 1.2), label: `Khoảng ${money(centre)}` };
    },
  },
];

/** Tìm cụm giá trong câu tìm kiếm; `null` nếu không có (hoặc có số nhưng chưa đủ manh mối là tiền) */
export function parsePriceIntent(query: string): PriceIntent | null {
  const original = query.normalize("NFC");
  // `fold` giữ nguyên độ dài nên vị trí khớp trên chuỗi không dấu cũng là vị trí trên chuỗi gốc
  const text = fold(original);

  for (const rule of RULES) {
    const match = rule.pattern.exec(text);
    if (!match) continue;

    const built = rule.build(match);
    if (!built) continue;

    const rest = `${original.slice(0, match.index)} ${original.slice(match.index + match[0].length)}`.replace(/\s+/g, " ").trim();
    return { ...built, rest };
  }

  return null;
}
