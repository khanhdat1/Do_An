import { Router } from "express";
import { z } from "zod";
import { searchLimiter } from "../middleware/security.js";
import { searchProducts, suggestSearch } from "../services/search.service.js";
import { boolQuery } from "../utils/query.js";

export const searchRouter = Router();

const searchQuerySchema = z.object({
  // Câu rỗng không phải lỗi: trả về kết quả rỗng để trang web hiện màn hình "nhập từ khoá"
  q: z.string().trim().max(200).default(""),
  category: z.string().trim().min(1).max(100).optional(),
  // Nhiều hãng cách nhau dấu phẩy: ?brand=asus,msi
  brand: z.string().trim().min(1).max(300).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  inStock: boolQuery,
  sort: z.enum(["relevance", "best-selling", "newest", "price-asc", "price-desc"]).default("relevance"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(20),
});

/**
 * GET /api/search
 * Ví dụ:
 *   /api/search?q=ban phim co
 *   /api/search?q=laptop gaming dưới 30 triệu&sort=price-asc
 *   /api/search?q=razer&category=chuot&inStock=true&page=2
 * Câu tìm kiếm không phân biệt dấu, hiểu từ đồng nghĩa (mouse = chuột), tự sửa lỗi gõ và cụm giá ("dưới 30 triệu").
 */
searchRouter.get("/", async (req, res, next) => {
  try {
    const params = searchQuerySchema.parse(req.query);
    res.json(await searchProducts(params));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/search/suggest?q=raz&limit=5
 * Gợi ý cho hộp thả xuống của ô tìm kiếm ở header. Cho phép trình duyệt giữ 30 giây: gõ rồi xoá lại cùng một
 * chuỗi thì không gọi API lần nữa.
 *
 * Mỗi lần dừng gõ là một request nên cần trần theo IP. Chỉ đặt trần ở đây, không đặt cho `GET /api/search`: trang
 * kết quả do server của web gọi (mọi khách cùng một IP), trần theo IP sẽ chặn cả cửa hàng khi có ~2 lượt tìm mỗi giây.
 */
searchRouter.get("/suggest", searchLimiter, async (req, res, next) => {
  try {
    const { q, limit } = z
      .object({
        q: z.string().trim().max(200).default(""),
        limit: z.coerce.number().int().min(1).max(10).default(5),
      })
      .parse(req.query);

    res.set("Cache-Control", "public, max-age=30");
    res.json(await suggestSearch(q, limit));
  } catch (error) {
    next(error);
  }
});
