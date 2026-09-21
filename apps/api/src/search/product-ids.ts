import { matchQuery } from "./engine.js";
import { getSearchIndex } from "./index-store.js";

/**
 * Id các sản phẩm khớp một câu tìm kiếm (đã xếp theo độ liên quan). Dành cho `GET /api/products?search=`:
 * lọc theo cùng bộ máy với trang tìm kiếm, nên cũng không phân biệt dấu, hiểu từ đồng nghĩa...
 *
 * Nằm riêng khỏi search.service.ts vì product.service.ts gọi hàm này, còn search.service.ts lại dùng
 * product.service.ts — gộp chung sẽ thành vòng phụ thuộc.
 */
export async function searchProductIds(query: string): Promise<string[]> {
  const index = await getSearchIndex();
  return matchQuery(index, query).matches.map((item) => item.doc.id);
}
