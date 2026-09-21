/**
 * Khung chung để dựng nội dung một sản phẩm demo: bảng thông số, chip, dòng mô tả ngắn và bài mô tả dài.
 *
 * Mỗi danh mục có một hàm dựng riêng (components.ts, devices.ts) trả về `Draft`: đủ dữ kiện đã chuẩn hoá
 * nhưng chưa định dạng. `assemble` biến Draft thành bài mô tả theo quy ước của apps/web/lib/description.ts.
 *
 * Toàn bộ chữ do PCZone tự viết dựa trên thông số kỹ thuật (là sự kiện, không phải văn bản của nguồn).
 * Câu nào cần một thông số mà sản phẩm không có thì được bỏ đi, không bao giờ in "undefined" hay đoán.
 */
import type { CatalogItem } from "../../gearvn/snapshot.js";
import type { Attrs } from "../attributes.js";

/** Kết quả của biểu thức `giá_trị && "câu văn"`: số 0 và false cũng là "không có gì" */
export type Maybe = string | undefined | false | null | 0;

export interface SpecRow {
  label: string;
  value: string;
}

export interface Section {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface Ctx {
  item: CatalogItem;
  /** Tên hiển thị đã làm sạch */
  name: string;
  brand: string | null;
  a: Attrs;
  /** Khoá ổn định của sản phẩm, để chọn phương án câu văn cố định cho mỗi sản phẩm */
  seed: string;
}

export interface Draft {
  /** Các ý trong ngoặc của tiêu đề bài mô tả: "6 nhân 12 luồng", "Socket AM5"... */
  titleParts: Maybe[];
  intro: string;
  sections: Section[];
  /** Đoạn "Dành cho ai" (chưa có câu bảo hành, do assemble thêm) */
  audience: string;
  /** Bảng thông số theo thứ tự hiển thị; dòng thiếu giá trị bị bỏ */
  specs: [label: string, value: string | undefined][];
  /** 2–3 chip ngắn đầu tiên hiện trên thẻ sản phẩm, phần sau là ý dài hiện ở trang chi tiết */
  chips: Maybe[];
  /** Dòng mô tả ngắn dưới tên sản phẩm; các ý ghép bằng " • " */
  summary: Maybe[];
  warrantyMonths?: number;
  /** Chú thích thay cho mặc định của ảnh trong mô tả (vd ảnh PC lắp ráp chỉ là ảnh minh hoạ) */
  imageCaption?: string;
}

/** Bỏ phần tử rỗng, giữ đúng kiểu string */
export const compact = (items: Maybe[]): string[] =>
  items.filter((item): item is string => typeof item === "string" && item.trim() !== "");

/** Ghép các câu có nội dung thành một đoạn */
export const paragraph = (...sentences: Maybe[]): string => compact(sentences).join(" ");

/**
 * Tên sản phẩm khi đứng GIỮA câu: tên bắt đầu bằng danh từ chung viết hoa ("Bo mạch chủ ASUS…", "Laptop gaming…")
 * thì hạ chữ đầu xuống cho đúng chính tả ("…, và bo mạch chủ ASUS… được thiết kế…"); tên bắt đầu bằng từ viết tắt
 * (CPU, RAM, PC) giữ nguyên.
 */
export const midSentence = (name: string): string =>
  /^(bo mạch chủ|card màn hình|ổ cứng|vỏ case|nguồn máy tính|màn hình|bàn phím|chuột|laptop)(?![\p{L}\p{N}])/iu.test(name)
    ? name.charAt(0).toLowerCase() + name.slice(1)
    : name;

/** "A, B và C" */
export function listVi(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} và ${items[items.length - 1]}`;
}

/** Số nguyên ở dạng ngắn cho tiêu đề: 6 → "6" */
export const n = (value: number | undefined): string | undefined => (value === undefined ? undefined : String(value));

/** Bỏ dấu chấm cuối câu để nối vào câu khác mà không bị "..": các giá trị nguồn đôi khi kết thúc bằng dấu chấm */
export const noDot = (value: string): string => value.replace(/[.\s]+$/, "");

/** Số tháng bảo hành từ "36 tháng", "5 năm" */
export function warrantyMonths(text: string | undefined, fallback: number): number {
  const match = text?.match(/(\d+)\s*(tháng|năm)/i);
  if (!match) return fallback;
  const value = Number(match[1]);
  return /năm/i.test(match[2]) ? value * 12 : value;
}

/** 36 → "36 tháng"; 60 → "5 năm (60 tháng)" cho dễ đọc */
export function warrantyText(months: number): string {
  return months >= 24 && months % 12 === 0 ? `${months / 12} năm (${months} tháng)` : `${months} tháng`;
}

/**
 * Dựng bài mô tả theo quy ước của apps/web/lib/description.ts:
 *   # tiêu đề · ## mục · - gạch đầu dòng · [ảnh N] chèn ảnh thứ N · dòng trống ngăn đoạn
 *
 * Ảnh: ảnh 1 đã nằm ở thư viện ảnh đầu trang nên bài mô tả dùng ảnh 2, 3, 4 xen giữa các mục. Nếu sản
 * phẩm có ít ảnh hơn, khối ảnh thừa tự bị bỏ khi hiển thị (xem ProductDescription).
 */
export function assemble(ctx: Ctx, draft: Draft): string {
  const months = draft.warrantyMonths ?? 12;
  const parts = compact(draft.titleParts);
  const lines: string[] = [`# ${ctx.name} Chính hãng${parts.length > 0 ? ` (${parts.join(", ")})` : ""}`, "", draft.intro, ""];

  const caption = draft.imageCaption ? `: ${draft.imageCaption}` : "";
  let image = 2;

  for (const section of draft.sections) {
    const body = compact(section.paragraphs ?? []);
    if (body.length === 0 && (section.bullets?.length ?? 0) === 0) continue;

    lines.push(`## ${section.heading}`, "");
    for (const text of body) lines.push(text, "");
    if (section.bullets && section.bullets.length > 0) {
      for (const bullet of section.bullets) lines.push(`- ${bullet}`);
      lines.push("");
    }

    if (image <= 4) {
      lines.push(`[ảnh ${image}${caption}]`, "");
      image++;
    }
  }

  lines.push(
    "## Dành cho ai?",
    "",
    paragraph(draft.audience, `Tại PCZone, sản phẩm là hàng chính hãng, bảo hành ${warrantyText(months)}.`),
  );

  return `${lines.join("\n")}\n`;
}

/** Bảng thông số cuối cùng: bỏ dòng thiếu giá trị, luôn có dòng bảo hành ở cuối */
export function finishSpecs(draft: Draft): SpecRow[] {
  const rows = draft.specs
    .filter((row): row is [string, string] => typeof row[1] === "string" && row[1].trim() !== "")
    .map(([label, value]) => ({ label, value: value.trim() }));

  if (draft.warrantyMonths) rows.push({ label: "Bảo hành", value: `${draft.warrantyMonths} tháng` });
  return rows;
}
