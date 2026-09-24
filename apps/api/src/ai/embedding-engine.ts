/**
 * Xếp hạng theo độ tương đồng cosine giữa embedding — hàm thuần, không đụng DB/mạng, kiểm thử được
 * bằng vector giả. Brute-force (so từng vector một) thay vì một cơ sở dữ liệu vector chuyên dụng
 * (Qdrant...) vì catalog chỉ ~436 sản phẩm — cùng lý lẽ bộ tìm kiếm từ khoá (search/engine.ts) đã áp
 * dụng cho tìm kiếm chữ: vài trăm tới vài nghìn sản phẩm thì tính trong bộ nhớ vừa nhanh vừa đơn giản.
 */

export interface EmbeddingDoc {
  productId: string;
  vector: number[];
}

export interface RankedMatch {
  productId: string;
  score: number;
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function magnitude(vector: number[]): number {
  return Math.sqrt(dot(vector, vector));
}

/** 1 = giống hệt hướng, 0 = không liên quan, -1 = ngược hướng. 0 nếu một trong hai vector rỗng/toàn số 0. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const denom = magnitude(a) * magnitude(b);
  return denom === 0 ? 0 : dot(a, b) / denom;
}

/** Xếp hạng toàn bộ tài liệu theo độ tương đồng với vector truy vấn, lấy `limit` kết quả cao nhất */
export function rankBySimilarity(query: number[], docs: EmbeddingDoc[], limit: number): RankedMatch[] {
  return docs
    .map((doc) => ({ productId: doc.productId, score: cosineSimilarity(query, doc.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
