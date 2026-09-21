/**
 * Xử lý chữ ở phía giao diện cho tìm kiếm: bỏ dấu để tô sáng đúng chữ khớp và tách từ khoá gần giống bên API
 * (`apps/api/src/search/text.ts`). Chỉ phục vụ HIỂN THỊ; việc khớp và xếp hạng thật sự do API làm.
 */

/** Một ký tự → ký tự không dấu, chữ thường, ĐÚNG MỘT đơn vị UTF-16 (nên vị trí trên chuỗi đã bỏ dấu trỏ đúng chuỗi gốc) */
function foldUnit(unit: string): string {
  if (unit === "đ" || unit === "Đ") return "d";
  return (unit.normalize("NFD")[0] ?? unit).toLowerCase();
}

/** Chữ thường, bỏ dấu tiếng Việt, GIỮ NGUYÊN độ dài chuỗi */
export function fold(text: string): string {
  return text.normalize("NFC").split("").map(foldUnit).join("");
}

/** Từ khoá của một câu đang gõ: không dấu, tách theo mọi ký tự không phải chữ/số (giữ dấu chấm giữa hai chữ số) */
export function queryTerms(query: string): string[] {
  const words = fold(query)
    .replace(/(\d)\.(?=\d)/g, "$1_")
    .split(/[^a-z0-9_]+/)
    .map((word) => word.replace(/_/g, "."))
    .filter(Boolean);
  return [...new Set(words)];
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

const isWordChar = (char: string | undefined) => char !== undefined && /[a-z0-9]/.test(char);

/**
 * Chia `text` thành các đoạn, đánh dấu đoạn khớp một từ khoá ở ĐẦU TỪ (giống cách API khớp): tô "Chuột" khi tìm "chuot"
 * hay "chuột", không tô chữ "chuot" nằm giữa một từ khác. Không dấu nên "co" cũng tô cả "cơ" và "có".
 */
export function highlightParts(text: string, terms: string[]): HighlightPart[] {
  const usable = terms.filter((term) => term.length > 0);
  if (usable.length === 0 || text === "") return [{ text, match: false }];

  // `fold` giữ độ dài chỉ khi chuỗi đã ở dạng NFC; text từ DB đã như vậy, nhưng chuẩn hoá lại cho chắc và dùng chính
  // bản đó để cắt
  const source = text.normalize("NFC");
  const folded = fold(source);
  const marked = new Array<boolean>(source.length).fill(false);

  for (const term of usable) {
    let from = 0;
    for (;;) {
      const at = folded.indexOf(term, from);
      if (at === -1) break;
      if (!isWordChar(folded[at - 1])) marked.fill(true, at, at + term.length);
      from = at + 1;
    }
  }

  const parts: HighlightPart[] = [];
  let start = 0;
  for (let index = 1; index <= source.length; index++) {
    if (index === source.length || marked[index] !== marked[start]) {
      parts.push({ text: source.slice(start, index), match: marked[start] });
      start = index;
    }
  }
  return parts;
}
