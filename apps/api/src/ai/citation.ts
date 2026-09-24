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

export interface CitationCandidate {
  productId: string;
  name: string;
}

/** Trả về id của các ứng viên mà nội dung trả lời thật sự nhắc tới, giữ nguyên thứ tự đầu vào */
export function findCitedProductIds(responseText: string, candidates: CitationCandidate[]): string[] {
  const responseCompact = compact(responseText);
  if (!responseCompact) return [];

  return candidates
    .filter((candidate) => {
      const terms = tokenize(candidate.name).filter((term) => term.length >= MIN_TERM_LENGTH);
      if (terms.length === 0) return false;

      const matched = terms.filter((term) => responseCompact.includes(term));
      const threshold = Math.min(MIN_MATCHED_TOKENS, terms.length);
      return matched.length >= threshold && matched.length / terms.length >= MIN_MATCH_RATIO;
    })
    .map((candidate) => candidate.productId);
}
