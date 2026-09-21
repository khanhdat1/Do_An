/**
 * Xử lý chữ cho tìm kiếm tiếng Việt: bỏ dấu, tách từ khoá, khoảng cách sửa lỗi gõ.
 *
 * Người dùng gõ "ban phim co", "BÀN PHÍM CƠ" hay "bàn phím cơ" đều phải ra cùng một kết quả, và cả tên sản phẩm
 * trong DB cũng có đủ kiểu dấu, nên mọi so khớp đều diễn ra trên dạng đã chuẩn hoá ở đây (không phụ thuộc collation
 * của MySQL).
 */

/**
 * Một ký tự → ký tự không dấu, chữ thường, ĐÚNG MỘT đơn vị UTF-16. Giữ độ dài để vị trí trong chuỗi đã bỏ dấu
 * trỏ đúng vào chuỗi gốc (dùng khi cắt cụm giá ra khỏi câu tìm kiếm mà vẫn giữ nguyên dấu của phần còn lại).
 */
function foldUnit(unit: string): string {
  if (unit === "đ" || unit === "Đ") return "d";
  // "ầ" → "a" + dấu; lấy chữ cái gốc. Ký tự không tách được (chữ Hán, emoji...) giữ nguyên.
  return (unit.normalize("NFD")[0] ?? unit).toLowerCase();
}

/** Chữ thường, bỏ dấu tiếng Việt (cả đ), GIỮ NGUYÊN độ dài và mọi ký tự khác (dấu cách, dấu câu, số) */
export function fold(text: string): string {
  return text.normalize("NFC").split("").map(foldUnit).join("");
}

/**
 * Dạng để so khớp: không dấu, chữ thường, mọi đoạn ký tự không phải chữ/số thành một dấu cách.
 * Ngoại lệ: dấu chấm hoặc phẩy nằm GIỮA hai chữ số được giữ (thành dấu chấm): "15,6" và "15.6" đều là "15.6", còn
 * "1.000.000" giữ nguyên, để số thập phân không bị tách thành hai từ "15" và "6".
 */
export function normalize(text: string): string {
  return fold(text)
    .replace(/[^a-z0-9]+/g, (run, offset: number, whole: string) => {
      const isDecimalMark = (run === "." || run === ",") && /\d/.test(whole[offset - 1] ?? "") && /\d/.test(whole[offset + 1] ?? "");
      return isDecimalMark ? "." : " ";
    })
    .trim();
}

/** Bỏ dấu cách và dấu chấm: "rtx 5070 ti" → "rtx5070ti", để "rtx5070ti" và "RTX 5070 Ti" khớp nhau */
export function compact(text: string): string {
  return normalize(text).replace(/[ .]/g, "");
}

/** Từ đệm khi viết cả câu ("laptop cho sinh viên", "tôi muốn mua chuột"): bỏ đi chứ không bắt sản phẩm phải chứa */
const STOP_WORDS = new Set(["cho", "cua", "va", "voi", "la", "nhung", "cac", "mot", "can", "tim", "mua", "toi", "muon"]);

/**
 * Đơn vị / hậu tố dính liền với con số ngay trước nó: "32 gb" → "32gb", "5070 ti" → "5070ti". Tên sản phẩm ghi cả
 * hai kiểu ("32GB", "16 GB", "5070 Ti", "5070Ti"); ghép lại thì so khớp trên dạng liền (xem `isModelTerm`).
 */
const UNIT_SUFFIXES = new Set(["gb", "tb", "mb", "gbps", "hz", "khz", "ghz", "mhz", "w", "wh", "mm", "cm", "inch", "kg", "ti", "xt", "xtx", "super"]);

function mergeUnits(words: string[]): string[] {
  const merged: string[] = [];
  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    const next = words[index + 1];
    if (next !== undefined && /^\d+(\.\d+)?$/.test(word) && UNIT_SUFFIXES.has(next)) {
      merged.push(word + next);
      index++;
    } else {
      merged.push(word);
    }
  }
  return merged;
}

export const MAX_TERMS = 8;
const MAX_TERM_LENGTH = 40;

/** Tách câu tìm kiếm thành các từ khoá: không dấu, bỏ từ đệm, ghép "32 gb", không trùng, tối đa MAX_TERMS từ */
export function tokenize(query: string): string[] {
  const words = normalize(query)
    .split(" ")
    .filter(Boolean)
    .map((word) => word.slice(0, MAX_TERM_LENGTH));

  return [...new Set(mergeUnits(words).filter((word) => !STOP_WORDS.has(word)))].slice(0, MAX_TERMS);
}

/**
 * Từ khoá kiểu mã hàng ("5070ti", "rtx5070", "7800x3d", "240hz", "32gb"): có cả chữ lẫn số. Loại này được so cả trên
 * dạng viết liền (không dấu cách) vì tên sản phẩm lúc ghi "RTX 5070 Ti", lúc ghi "RTX5070Ti".
 */
export function isModelTerm(term: string): boolean {
  return /[a-z]/.test(term) && /\d/.test(term);
}

/**
 * Khoảng cách sửa lỗi gõ (thêm / bớt / đổi một chữ, hoặc đổi chỗ hai chữ liền nhau đều tính là 1).
 * Trả về `limit + 1` khi vượt `limit` để nơi gọi không phải tính tiếp.
 */
export function editDistance(a: string, b: string, limit: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;

  let previousPrevious: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let row = 1; row <= a.length; row++) {
    const current = [row];
    let rowMin = row;
    for (let column = 1; column <= b.length; column++) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      let value = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + cost);
      if (row > 1 && column > 1 && a[row - 1] === b[column - 2] && a[row - 2] === b[column - 1]) {
        value = Math.min(value, previousPrevious[column - 2] + 1);
      }
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return limit + 1;
    previousPrevious = previous;
    previous = current;
  }

  return Math.min(previous[b.length], limit + 1);
}

/**
 * Chữ thường, GIỮ dấu, mọi đoạn ký tự không phải chữ/số thành một dấu cách. Dùng để ưu tiên đúng dấu: bỏ dấu thì
 * "cơ" (bàn phím cơ), "có" (có dây) và "cỡ" thành một, nhưng ai gõ có dấu thì thường muốn đúng chữ đó.
 */
export function normalizeKeepMarks(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Từ khoá không dấu → dạng người dùng gõ CÓ dấu ("co" → "cơ"); chỉ gồm các từ thực sự có dấu */
export function accentedForms(query: string): Map<string, string> {
  const forms = new Map<string, string>();
  for (const word of normalizeKeepMarks(query).split(" ")) {
    const folded = fold(word);
    if (word !== folded && !forms.has(folded)) forms.set(folded, word);
  }
  return forms;
}
