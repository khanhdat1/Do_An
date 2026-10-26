/**
 * Phần THUẦN (không DB, không mạng) của AI Chat: dựng câu truy hồi từ vài tin nhắn gần nhất, mang khoảng giá
 * sang câu hỏi tiếp nối, tóm tắt thông số và dựng system prompt — tách khỏi ai-chat.service.ts để kiểm thử được.
 *
 * Vì sao phải dựng câu truy hồi: trước đây chỉ nhúng đúng câu hiện tại. Gặp thực tế khi chấm: hỏi "laptop gaming
 * tầm 25 triệu" rồi "Còn con nào rẻ hơn chút không?" — câu thứ hai không có chữ nào về sản phẩm, truy hồi ra lung
 * tung, AI khẳng định sai "laptop gaming đều từ 26 triệu trở lên" dù kho có ASUS TUF Gaming A15 giá 24.490.000đ.
 */
import { NO_DATA } from "../mappers/pc-build.mapper.js";
import { formatMoneyLabel, parsePriceIntent } from "../search/price-intent.js";
import { fold, normalizeKeepMarks, tokenize } from "../search/text.js";
import type { SpecRowDto } from "../types/dto.js";
import { formatPrice } from "../utils/format.js";

/** Khoảng giá dùng để lọc ứng viên TRƯỚC khi lấy top-k (xem productIdsInPriceRange ở ai-search.service.ts) */
export interface ChatPriceFilter {
  min?: number;
  max?: number;
  /** Mức khách nêu khi chỉ có một con số ("tầm 25 triệu") — để "rẻ hơn" / "đắt hơn" biết lấy mốc nào */
  target?: number;
  /** Khách nêu ngân sách ("ngân sách 30 triệu", "tối đa 30 triệu"): `max` đúng bằng mức đó, không nới thêm */
  budgetCeiling?: boolean;
  label: string;
}

/**
 * "ngân sách 30 triệu", "mình chỉ có 30 triệu": con số khách nêu là TRẦN. Bộ đọc giá dùng chung với tìm kiếm hiểu một con số
 * đứng một mình là "khoảng" và nới ±20% — đúng cho tìm kiếm, nhưng trợ lý từng vì vậy gợi ý mẫu 32.990.000đ và 33.490.000đ cho
 * khách nói "ngân sách 30 triệu" (câu H01 của bộ đánh giá). "tối đa"/"không quá" thì bộ đọc giá đã hiểu là "dưới" sẵn rồi.
 */
const BUDGET_CEILING_CUE = /\b(ngan sach|budget|chi co)\b/;

export interface ChatRetrievalQuery {
  /** Văn bản đem đi nhúng: các câu cùng chủ đề gần nhất, đã cắt cụm giá */
  text: string;
  priceFilter: ChatPriceFilter | null;
  /** Câu hiện tại phải dựa vào câu trước mới hiểu được */
  isFollowUp: boolean;
}

/** Số câu tối đa (kể cả câu hiện tại) gộp vào một câu truy hồi — nhiều hơn thì vector bị "loãng" chủ đề */
const MAX_TOPIC_MESSAGES = 3;

/**
 * Từ hội thoại không mang nghĩa sản phẩm. So trên dạng GIỮ DẤU để "cũng" không bị nhầm với "cứng" (ổ cứng) —
 * kèm cả dạng không dấu cho người gõ không dấu, trừ những dạng trùng với từ sản phẩm.
 */
const FOLLOW_UP_WORDS = new Set([
  "còn", "con", "nào", "nao", "cái", "cai", "chiếc", "chiec", "máy", "mẫu", "mau", "loại", "loai", "bản", "dòng", "sản", "phẩm",
  "rẻ", "re", "hơn", "hon", "đắt", "dat", "mắc", "xịn", "xin", "mạnh", "manh", "tốt", "tot", "ngon", "đẹp", "dep", "bền", "ben", "nhẹ",
  "chút", "chut", "xíu", "xiu", "tí", "ti", "ít", "nhiều", "nhieu", "nhất", "nhat",
  "không", "khong", "ko", "k", "hông", "có", "co", "thì", "thi", "sao", "vậy", "vay", "thế", "the", "nhé", "nhe", "nha", "nhỉ", "nhi",
  "ạ", "à", "a", "ơi", "oi", "hả", "ha", "bạn", "ban", "mình", "minh", "em", "anh", "chị", "chi", "shop", "ad",
  "gì", "gi", "khác", "khac", "nữa", "nua", "thêm", "them", "được", "duoc", "đc", "dc", "giá", "gia", "tiền", "tien",
  "này", "nay", "đó", "kia", "ấy", "đấy", "nó", "lại", "lai", "hay", "rồi", "roi", "chưa", "chua", "xem", "gợi", "goi", "ý",
  "tư", "vấn", "giúp", "giup", "hỏi", "hoi", "chọn", "chon", "nên", "nen", "ok", "oke", "vâng", "dạ", "da", "ừ", "thử", "thu",
  "mấy", "bao", "tầm", "khoảng", "với", "voi", "cho", "là", "la", "và", "va", "một", "mot", "ra", "đi", "di",
]);

/** Từ chỉ trỏ ("con đó", "máy này", "nó") — chỉ so dạng có dấu: "do"/"no" không dấu trùng quá nhiều từ khác */
const REFERENCE_WORDS = new Set(["đó", "đấy", "này", "kia", "ấy", "nó", "trên"]);

type RelativePrice = "cheaper" | "pricier";

function relativePrice(text: string): RelativePrice | null {
  const folded = fold(text);
  if (/\b(re hon|thap hon|mem hon|it tien hon|tiet kiem hon|gia thap hon)\b/.test(folded)) return "cheaper";
  if (/\b(dat hon|mac hon|cao cap hon|xin hon|gia cao hon|nhieu tien hon)\b/.test(folded)) return "pricier";
  return null;
}

function toFilter(min: number | undefined, max: number | undefined): ChatPriceFilter | null {
  if (min !== undefined && max !== undefined) return { min, max, label: `Từ ${formatMoneyLabel(min)} đến ${formatMoneyLabel(max)}` };
  if (max !== undefined) return { max, label: `Dưới ${formatMoneyLabel(max)}` };
  if (min !== undefined) return { min, label: `Trên ${formatMoneyLabel(min)}` };
  return null;
}

/**
 * Dịch khoảng giá theo "rẻ hơn" / "đắt hơn":
 * - Khách nêu một mức ("tầm 25 triệu" = 20–30 triệu): lấy nửa dưới/nửa trên quanh mức đó — "rẻ hơn chút" thành
 *   20–25 triệu (đúng ca ASUS TUF Gaming A15 giá 24.490.000đ bị bỏ sót).
 * - Còn lại (một khoảng, hoặc đã dịch một lần): xuống dưới sàn / lên trên trần — "rẻ hơn nữa" sau 20–25 triệu
 *   thành dưới 20 triệu.
 * - Ngân sách ("ngân sách 30 triệu" = 24–30 triệu) vốn đã là nửa dưới: "rẻ hơn" thành dưới 24 triệu, "đắt hơn" thành
 *   trên 30 triệu.
 */
export function shiftPriceFilter(base: ChatPriceFilter | null, direction: RelativePrice | null): ChatPriceFilter | null {
  if (!base || !direction) return base;
  if (direction === "cheaper") {
    // Ngân sách đã là nửa dưới quanh mức khách nêu, "rẻ hơn" phải xuống dưới sàn
    return base.target !== undefined && !base.budgetCeiling ? toFilter(base.min, base.target) : toFilter(undefined, base.min ?? base.max);
  }
  // Mức đã là trần (khách nêu ngân sách) thì "đắt hơn" là trên mức đó, không còn trần nào nữa
  const ceiling = base.max !== undefined && base.target !== undefined && base.max > base.target ? base.max : undefined;
  return base.target !== undefined ? toFilter(base.target, ceiling) : toFilter(base.max ?? base.min, undefined);
}

interface TurnAnalysis {
  /** Câu đã cắt cụm giá */
  text: string;
  price: ChatPriceFilter | null;
  contentWords: number;
  hasReference: boolean;
  relative: RelativePrice | null;
}

function priceOf(message: string, intent: ReturnType<typeof parsePriceIntent>): ChatPriceFilter | null {
  if (!intent) return null;
  if (intent.target !== undefined && BUDGET_CEILING_CUE.test(fold(message))) {
    return { min: intent.min, max: intent.target, target: intent.target, budgetCeiling: true, label: `Ngân sách tối đa ${formatMoneyLabel(intent.target)}` };
  }
  return { min: intent.min, max: intent.max, target: intent.target, label: intent.label };
}

function analyseTurn(message: string): TurnAnalysis {
  const intent = parsePriceIntent(message);
  const text = (intent ? intent.rest : message).trim();
  const words = normalizeKeepMarks(text).split(" ").filter(Boolean);
  return {
    text,
    price: priceOf(message, intent),
    // tokenize() để bỏ từ đệm sẵn có của bộ tìm kiếm; so FOLLOW_UP_WORDS trên dạng giữ dấu
    contentWords: words.filter((word) => !FOLLOW_UP_WORDS.has(word) && tokenize(word).length > 0).length,
    hasReference: words.some((word) => REFERENCE_WORDS.has(word)),
    relative: relativePrice(text),
  };
}

/**
 * Dựng câu truy hồi cho lượt chat hiện tại. `previousUserMessages`: tin nhắn NGƯỜI DÙNG trước đó, MỚI NHẤT TRƯỚC.
 *
 * Đi lần lượt từ câu cũ tới câu mới, mỗi câu:
 * - Tự đủ nghĩa (có từ chỉ sản phẩm, không chỉ trỏ, không "rẻ hơn/đắt hơn") → mở chủ đề mới, chỉ dùng chính nó.
 *   Tránh kéo "laptop gaming tầm 25 triệu" sang câu "chuột gaming nào tốt?" — vừa loãng vector vừa lọc chuột theo
 *   giá laptop.
 * - Câu tiếp nối → gộp với các câu trước cùng chủ đề (tối đa MAX_TOPIC_MESSAGES câu).
 * Khoảng giá: câu có giá riêng thì dùng giá đó; câu tiếp nối KHÔNG có từ sản phẩm riêng ("còn con nào nữa không?")
 * hoặc có "rẻ hơn/đắt hơn" thì mang khoảng giá của lượt trước sang (dịch theo hướng rẻ/đắt); còn lại thì bỏ lọc giá.
 */
export function buildChatRetrievalQuery(message: string, previousUserMessages: readonly string[]): ChatRetrievalQuery {
  let topic: string[] = [];
  let price: ChatPriceFilter | null = null;
  let isFollowUp = false;

  for (const turn of [...previousUserMessages].reverse().concat(message).map(analyseTurn)) {
    isFollowUp = topic.length > 0 && (turn.contentWords === 0 || turn.hasReference || turn.relative !== null);
    topic = isFollowUp ? [...topic, turn.text].slice(-MAX_TOPIC_MESSAGES) : [turn.text];

    const inheritsPrice = isFollowUp && (turn.contentWords === 0 || turn.relative !== null);
    price = turn.price ?? (inheritsPrice ? shiftPriceFilter(price, turn.relative) : null);
  }

  return { text: topic.filter(Boolean).join("\n"), priceFilter: price, isFollowUp };
}

/** Giới hạn phần thông số của MỖI sản phẩm trong prompt — 8 ứng viên × ~400 ký tự, đủ trả lời mà không phình prompt */
export const PROMPT_SPEC_CHAR_LIMIT = 400;
const SPEC_VALUE_CHAR_LIMIT = 80;

export interface PromptSpecSource {
  /** Thông số đã chuẩn hoá từ ProductSpec (keySpecs) — đáng tin nhất, đưa lên đầu */
  keySpecs: SpecRowDto[];
  /** shortSpecs đầy đủ (không chỉ 3 chip đầu như thẻ sản phẩm) */
  highlights: string[];
  /** Bảng thông số gốc của sản phẩm */
  specifications: SpecRowDto[];
}

/**
 * Gộp thông số thành một dòng ngắn cho prompt: keySpecs → điểm nổi bật → bảng thông số, bỏ trùng, bỏ dòng
 * "Chưa có dữ liệu" (để AI nói thật là không có dữ liệu thay vì đọc lại câu đó), cắt ở ranh giới một mục.
 */
export function summarizeSpecs(source: PromptSpecSource, maxChars = PROMPT_SPEC_CHAR_LIMIT): string {
  const clip = (value: string) => (value.length > SPEC_VALUE_CHAR_LIMIT ? `${value.slice(0, SPEC_VALUE_CHAR_LIMIT - 1)}…` : value);
  const entries = [
    ...source.keySpecs.filter((row) => row.value !== NO_DATA).map((row) => `${row.label}: ${row.value}`),
    ...source.highlights,
    ...source.specifications.map((row) => `${row.label}: ${clip(row.value)}`),
  ];

  const seen = new Set<string>();
  let summary = "";
  for (const entry of entries) {
    const key = fold(entry).replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const next = summary ? `${summary}; ${entry}` : entry;
    if (next.length > maxChars) {
      if (!summary) summary = `${entry.slice(0, maxChars - 1)}…`;
      break;
    }
    summary = next;
  }
  return summary;
}

export interface ChatPromptProduct {
  name: string;
  categoryName: string;
  price: number;
  inStock: boolean;
  /** Đã qua summarizeSpecs() */
  specs: string;
}

export function buildChatSystemPrompt(candidates: ChatPromptProduct[], priceFilter: ChatPriceFilter | null): string {
  const productLines = candidates.length
    ? candidates
        .map((p) => `- ${p.name} (${p.categoryName}) — ${formatPrice(p.price)} — ${p.inStock ? "Còn hàng" : "Hết hàng"}${p.specs ? ` — Thông số: ${p.specs}` : ""}`)
        .join("\n")
    : "Hiện không tìm thấy sản phẩm nào trong kho đủ liên quan tới câu hỏi này.";

  const priceNote = priceFilter
    ? `\n\nDanh sách trên đã được lọc theo khoảng giá "${priceFilter.label}" (khách nêu trong câu hỏi hoặc đang hỏi tiếp từ câu trước) — sản phẩm ngoài khoảng giá này không có trong danh sách, không có nghĩa là PCZone không bán.${
        priceFilter.budgetCeiling && priceFilter.max !== undefined
          ? ` Khách đã nêu ngân sách tối đa ${formatPrice(priceFilter.max)}: không gợi ý, không khuyên "cố thêm tiền" để mua sản phẩm nào đắt hơn mức này trừ khi khách hỏi.`
          : ""
      }`
    : "";

  return `Bạn là trợ lý AI tư vấn mua sắm của PCZone — cửa hàng PC gaming, laptop, linh kiện và gaming gear.

Nguyên tắc bắt buộc:
- Chỉ được nhắc đến sản phẩm có trong danh sách "Sản phẩm tham khảo" bên dưới — đó là dữ liệu THẬT lấy trực tiếp từ kho PCZone ngay lúc bạn trả lời. Tuyệt đối không tự bịa thêm sản phẩm, mẫu mã, giá hay thông số nào khác, kể cả khi bạn nghĩ mình biết về chúng.
- Danh sách này CHỈ LÀ MỘT PHẦN nhỏ kho hàng, lọc riêng cho câu hỏi hiện tại — không phải toàn bộ những gì PCZone có. Nếu danh sách trống hoặc không có sản phẩm nào thật sự phù hợp, chỉ được nói là "trong kết quả tìm kiếm hiện tại chưa thấy sản phẩm phù hợp" — TUYỆT ĐỐI không khẳng định chắc chắn rằng PCZone không kinh doanh hay không có mặt hàng/danh mục đó (bạn không có đủ căn cứ để khẳng định điều này), và không suy luận rộng ra rằng cả một loại linh kiện/danh mục là không có chỉ vì lượt tìm kiếm này không thấy. Gợi ý khách hỏi cụ thể hơn hoặc thử lại thay vì cố gợi ý đại khái cho có.
- TUYỆT ĐỐI không khẳng định giá thấp nhất/cao nhất của cả một danh mục hay dòng sản phẩm (kiểu "laptop gaming bên mình đều từ 26 triệu trở lên", "rẻ nhất là ...", "không có con nào dưới ...") — danh sách không đại diện cho cả kho. Chỉ so sánh giá giữa các sản phẩm có trong danh sách; nếu khách muốn rẻ hơn/đắt hơn mà danh sách không có, mời khách nêu cụ thể mức giá mong muốn.
- KHÔNG nói tổng số sản phẩm hay số lựa chọn mà PCZone có (kiểu "PCZone có 3 lựa chọn mainboard", "bên mình chỉ có 2 mẫu", "đây là tất cả") — danh sách chỉ là vài sản phẩm gần với câu hỏi nhất, kho có thể còn nhiều mẫu khác. Hãy nói "mình gợi ý vài mẫu sau" hoặc "trong các mẫu mình tìm được".
- Luôn nêu đúng giá và tình trạng còn/hết hàng như trong danh sách, không tự làm tròn hay đoán.
- Khi khách hỏi thông số (kích thước, chiều dài card, socket, số khe RAM, công suất...), chỉ dùng phần "Thông số" đi kèm từng sản phẩm bên dưới; thông số nào không có ở đó thì nói rõ là chưa có dữ liệu, không đoán.
- Khi nhắc tới một sản phẩm, ghi tên kèm đúng mã model như trong danh sách (vd "Ryzen 7 9700X", "LOQ Essential 15ARP10E") để khách tra đúng sản phẩm.
- Bạn không có dữ liệu thời gian thực về đơn hàng, vận chuyển hay nhân viên hỗ trợ — nếu khách hỏi những việc này, trả lời trung thực là bạn không có thông tin đó, hướng khách tới trang "Tra cứu đơn hàng" hoặc tổng đài PCZone.
- Trả lời ngắn gọn, tự nhiên như một tư vấn viên thật, không liệt kê thông số dài dòng nếu khách không hỏi. Chỉ dùng định dạng đơn giản: **in đậm** và gạch đầu dòng "- ".
- Luôn trả lời bằng tiếng Việt.

Sản phẩm tham khảo (giá và tồn kho cập nhật ngay lúc này):
${productLines}${priceNote}`;
}
