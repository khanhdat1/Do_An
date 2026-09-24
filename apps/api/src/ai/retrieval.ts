import { parsePriceIntent, type PriceIntent } from "../search/price-intent.js";
import { rankBySimilarity } from "./embedding-engine.js";
import { getEmbeddingIndex } from "./embedding-store.js";
import { embed, isConfigured } from "./openai-client.js";

export interface RetrievalOptions {
  limit?: number;
  /** Ngưỡng cosine similarity tối thiểu để coi là "liên quan" — bắt đầu bằng một con số thận trọng,
   * cần tinh chỉnh lại bằng dữ liệu thật một khi có khoá OpenAI thật để thử. */
  minScore?: number;
}

export interface RetrievedProduct {
  productId: string;
  score: number;
}

export interface RetrievalResult {
  products: RetrievedProduct[];
  /** Cụm giá tách được từ câu hỏi (nếu có) — bên gọi tự quyết định có lọc theo đó hay không */
  priceIntent: PriceIntent | null;
}

const DEFAULT_LIMIT = 20;
const DEFAULT_MIN_SCORE = 0.15;

/**
 * Truy hồi sản phẩm liên quan tới một câu hỏi tự nhiên bằng embedding — hàm DUY NHẤT dùng chung cho
 * AI Search (Đợt 1), AI Chat (Đợt 2), AI Build PC (Đợt 4), không trùng lặp logic giữa các đợt.
 *
 * Trả mảng RỖNG (không ném lỗi) khi chưa cấu hình OpenAI hoặc câu hỏi rỗng sau khi cắt cụm giá — để
 * AI Search tự lùi về tìm kiếm từ khoá một cách êm ái, đúng nguyên tắc "thiếu cấu hình không hỏng
 * phần còn lại" đã áp dụng cho VNPay/OAuth/Resend.
 *
 * CHỈ trả về id + điểm liên quan — không phải nguồn để hiển thị giá/tồn kho/ảnh (chỉ mục có thể cũ
 * tới 15 phút). Bên gọi luôn phải đọc lại dữ liệu thật từ DB theo id trước khi hiển thị hay đưa cho AI.
 */
export async function retrieveProducts(query: string, opts: RetrievalOptions = {}): Promise<RetrievalResult> {
  const priceIntent = parsePriceIntent(query);
  // Cụm giá ("dưới 30 triệu") không mang ý nghĩa ngữ nghĩa cho embedding — cắt ra trước khi nhúng,
  // giữ lại đúng phần mô tả sản phẩm thật sự cần tìm.
  const searchText = (priceIntent?.rest || query).trim();

  if (!isConfigured() || !searchText) return { products: [], priceIntent };

  const [queryVector, index] = await Promise.all([embed(searchText), getEmbeddingIndex()]);
  const ranked = rankBySimilarity(queryVector, index.docs, opts.limit ?? DEFAULT_LIMIT);
  const minScore = opts.minScore ?? DEFAULT_MIN_SCORE;

  return { products: ranked.filter((item) => item.score >= minScore), priceIntent };
}
