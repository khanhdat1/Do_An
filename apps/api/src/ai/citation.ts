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
import { compact, isModelTerm, mergeUnits, normalize, tokenize } from "../search/text.js";

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

/**
 * Số dính đơn vị đo ("16gb", "512gb", "165hz", "15.6inch"): thông số chung của rất nhiều sản phẩm,
 * không phải mã model — câu trả lời nhắc "16GB" của máy này không phải bằng chứng đã nhắc máy kia.
 */
const MEASURE_TERM = /^\d+(\.\d+)?(gb|tb|mb|gbps|hz|khz|ghz|mhz|w|wh|mm|cm|inch|kg|mah|ms|nit|nits)$/;

/**
 * Mã model trong tên: có chữ số, đủ dài, không phải thông số đo lường, không phải số thập phân trần
 * ("15.6") — "9700x", "9800x3d", "15arp10e", "83je01agvn", "g16", "5060ti", "4060". Lấy trên TOÀN BỘ tên
 * (không chỉ 8 token đầu như `tokenize`) vì mã CPU/GPU hay nằm cuối tên dài của crawler.
 */
function modelCodes(name: string): string[] {
  const words = mergeUnits(normalize(name).split(" ").filter(Boolean));
  return [...new Set(words.filter((word) => word.length >= MIN_TERM_LENGTH && (isModelTerm(word) || /^\d+$/.test(word)) && !MEASURE_TERM.test(word)))];
}

/**
 * Các dạng mã có thể có trong câu trả lời, so NGUYÊN TỪ chứ không so chuỗi con: so chuỗi con thì
 * "9800x3d" chứa "9800x", "5060ti" chứa "5060" — nhắc bản X3D/Ti vẫn bị tính là nhắc bản thường. Gộp
 * thêm hai từ liền nhau ("RTX 4060" ↔ tên ghi "RTX4060") và bỏ tiền tố chữ ("RTX4060" ↔ tên ghi "RTX 4060",
 * "RTX4070 Ti" ↔ "4070 Ti").
 */
function responseCodeForms(responseText: string): Set<string> {
  const words = mergeUnits(normalize(responseText).split(" ").filter(Boolean));
  const forms = new Set<string>();
  const add = (form: string) => {
    forms.add(form);
    const withoutPrefix = form.replace(/^[a-z]+(?=\d)/, "");
    if (withoutPrefix !== form) forms.add(withoutPrefix);
  };
  words.forEach((word, index) => {
    add(word);
    if (index + 1 < words.length) add(word + words[index + 1]);
  });
  return forms;
}

/**
 * Khớp nguyên mã, hoặc câu trả lời viết tắt bỏ phần ĐUÔI SỐ của mã ("14IWC" cho "14IWC11"). Đuôi có chữ
 * thì không tính: "9950X" không phải viết tắt của "9950X3D", "5060" không phải của "5060Ti".
 */
function mentionsCode(code: string, forms: Set<string>): boolean {
  if (forms.has(code)) return true;
  for (const form of forms) {
    if (form.length >= 4 && isModelTerm(form) && code.startsWith(form) && /^\d+$/.test(code.slice(form.length))) return true;
  }
  return false;
}

function isStrictSubset(small: Set<string>, large: Set<string>): boolean {
  if (small.size >= large.size) return false;
  for (const item of small) if (!large.has(item)) return false;
  return true;
}

export interface CitationCandidate {
  productId: string;
  name: string;
}

/**
 * Trả về id của các ứng viên mà nội dung trả lời thật sự nhắc tới, giữ nguyên thứ tự đầu vào.
 *
 * Ba lớp lọc, lớp sau chỉ loại bớt chứ không thêm:
 * 1. Tỉ lệ token đặc trưng khớp (như cũ) — chịu được việc AI diễn đạt lại tên ngắn gọn.
 * 2. Ứng viên có mã model đặc trưng thì BẮT BUỘC câu trả lời nhắc ít nhất một mã đó. Chỉ có lớp 1 thì
 *    hãng + dòng máy là đủ khớp: gặp thực tế trả lời nhắc "Lenovo LOQ Essential 15ARP10E" mà trích cả
 *    "Lenovo LOQ 15IRX10 83JE01AGVN" (chung "lenovo"/"loq"), nhắc "Ryzen 7 9700X" mà trích cả "Ryzen 7
 *    9800X3D" (chung "amd"/"ryzen").
 * 3. Hai ứng viên cùng qua, bằng chứng của một bên nằm gọn trong bằng chứng của bên kia (trả lời nhắc
 *    "LOQ Essential 15ARP10E": bản "LOQ 15ARP10E" thường chỉ khớp lenovo/loq/15arp10e, bản Essential khớp
 *    thêm "essential") thì giữ bên được nhắc cụ thể hơn.
 */
export function findCitedProductIds(responseText: string, candidates: CitationCandidate[]): string[] {
  const responseCompact = compact(responseText);
  if (!responseCompact) return [];
  const responseForms = responseCodeForms(responseText);

  const analysed = candidates.map((candidate) => ({
    candidate,
    terms: tokenize(candidate.name).filter((term) => term.length >= MIN_TERM_LENGTH),
    codes: modelCodes(candidate.name),
  }));

  const documentFrequency = new Map<string, number>();
  for (const { terms, codes } of analysed) {
    for (const term of new Set([...terms, ...codes])) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }
  const threshold = commonTermThreshold(candidates.length);
  const isDistinctive = (term: string) => (documentFrequency.get(term) ?? 0) < threshold;

  const cited = analysed.flatMap(({ candidate, terms, codes }) => {
    const distinctiveTerms = terms.filter(isDistinctive);
    if (distinctiveTerms.length === 0) return [];

    const matched = distinctiveTerms.filter((term) => responseCompact.includes(term));
    const matchThreshold = Math.min(MIN_MATCHED_TOKENS, distinctiveTerms.length);
    if (matched.length < matchThreshold || matched.length / distinctiveTerms.length < MIN_MATCH_RATIO) return [];

    const distinctiveCodes = codes.filter(isDistinctive);
    const matchedCodes = distinctiveCodes.filter((code) => mentionsCode(code, responseForms));
    if (distinctiveCodes.length > 0 && matchedCodes.length === 0) return [];

    // Mã thì lấy kết quả so nguyên từ ở trên, không lấy kết quả so chuỗi con của lớp 1
    const evidence = new Set([...matched.filter((term) => !codes.includes(term)), ...matchedCodes]);
    return [{ productId: candidate.productId, evidence }];
  });

  return cited.filter((item) => !cited.some((other) => other !== item && isStrictSubset(item.evidence, other.evidence))).map((item) => item.productId);
}
