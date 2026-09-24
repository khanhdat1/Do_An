/**
 * Xác định AI Chat đã thật sự nhắc tới sản phẩm nào trong câu trả lời — tính hẳn ở SERVER, không tin
 * bất cứ gì model tự khai báo (cùng nguyên tắc `retrieval.ts` đã áp dụng cho AI Search).
 *
 * Không so nguyên cụm: tên sản phẩm trong catalog rất dài
 * ("Laptop Gaming Asus ROG Strix G16 G614JV-N3200W (Intel Core i7-13650HX...)"),
 * AI trả lời tự nhiên sẽ diễn đạt lại ngắn gọn ("con ROG Strix G16 dùng RTX 4060") chứ không lặp
 * nguyên văn — so nguyên cụm sẽ gần như không bao giờ khớp. Dùng lại `tokenize`/`compact` đã có ở bộ
 * tìm kiếm từ khoá (gấp dấu tiếng Việt, bỏ từ đệm, gộp đơn vị dính số như "16gb") để so theo TỈ LỆ
 * token khớp thay vì so nguyên chuỗi.
 */
import { compact, tokenize } from "../search/text.js";

/**
 * Token dưới 3 ký tự (số lẻ như "3", đơn vị rời) bị loại trước khi so khớp — quá ngắn nên rất dễ
 * khớp NHẦM vào một con số bất kỳ nằm đâu đó trong một câu trả lời dài (đo được thực tế: token "3"
 * của tên "...IdeaPad Slim 3..." khớp nhầm vào chuỗi "i7-13650HX" của một sản phẩm khác hoàn toàn).
 */
const MIN_TERM_LENGTH = 3;

/**
 * Số token khớp tối thiểu VÀ tỉ lệ khớp tối thiểu — cả hai cùng phải đạt, tránh một token chung
 * chung (vd "laptop") khiến một tên ngắn bị coi là khớp dù thực ra không liên quan.
 *
 * Tỉ lệ đo được thực tế với tên sản phẩm dài thật trong catalog (`tokenize()` cắt còn tối đa 8 token
 * ĐẦU tiên): một câu trả lời diễn đạt lại tự nhiên, chỉ nhắc phần thương hiệu/model đặc trưng ("ROG
 * Strix G16") mà bỏ qua các từ chung ("Laptop", "Gaming") hoặc mã SKU cuối tên, chỉ khớp được ~35-40%
 * số token — ngưỡng 60% (con số phác thảo ban đầu) sẽ loại nhầm chính ca "diễn đạt lại" mà cách làm
 * này cần chứng minh là xử lý được. Hạ xuống 0.3, vẫn đủ cao để loại các câu chỉ khớp 1 từ chung
 * chung (~13-17% trong cùng phép đo).
 */
const MIN_MATCHED_TOKENS = 2;
const MIN_MATCH_RATIO = 0.3;

/**
 * Token xuất hiện ở PHẦN LỚN ứng viên trong CÙNG một lượt truy hồi không phân biệt được sản phẩm nào —
 * gặp thực tế: catalog PC lắp ráp đặt tên kiểu "PC Gaming PCZone i5-12400F RTX 3050", nên "pc"/
 * "gaming"/"pczone" nằm trong hầu hết tên ứng viên mỗi khi hỏi về PC. Câu trả lời chỉ cần nhắc tên
 * cửa hàng ("PCZone chưa có...") hoặc từ chung ("PC hay chuột gaming") — không hề nêu tên SẢN PHẨM
 * nào — vẫn đủ khớp 2-3 token chung đó ở NHIỀU ứng viên cùng lúc, trích dẫn sai hàng loạt sản phẩm
 * chưa từng được nhắc tới. Loại các token này TRƯỚC khi so khớp: nếu token xuất hiện ở từ một nửa số
 * ứng viên trở lên, nó không mang tính phân biệt, không tính là bằng chứng đã nhắc tới sản phẩm đó.
 */
function commonTermThreshold(candidateCount: number): number {
  return Math.max(2, Math.ceil(candidateCount * 0.5));
}

export interface CitationCandidate {
  productId: string;
  name: string;
}

/** Trả về id của các ứng viên mà nội dung trả lời thật sự nhắc tới, giữ nguyên thứ tự đầu vào */
export function findCitedProductIds(responseText: string, candidates: CitationCandidate[]): string[] {
  const responseCompact = compact(responseText);
  if (!responseCompact) return [];

  const tokenized = candidates.map((candidate) => ({
    candidate,
    terms: tokenize(candidate.name).filter((term) => term.length >= MIN_TERM_LENGTH),
  }));

  const documentFrequency = new Map<string, number>();
  for (const { terms } of tokenized) {
    for (const term of new Set(terms)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }
  const threshold = commonTermThreshold(candidates.length);
  const isDistinctive = (term: string) => (documentFrequency.get(term) ?? 0) < threshold;

  return tokenized
    .filter(({ terms }) => {
      const distinctiveTerms = terms.filter(isDistinctive);
      if (distinctiveTerms.length === 0) return false;

      const matched = distinctiveTerms.filter((term) => responseCompact.includes(term));
      const matchThreshold = Math.min(MIN_MATCHED_TOKENS, distinctiveTerms.length);
      return matched.length >= matchThreshold && matched.length / distinctiveTerms.length >= MIN_MATCH_RATIO;
    })
    .map(({ candidate }) => candidate.productId);
}
