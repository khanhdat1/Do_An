import { Router } from "express";
import { z } from "zod";
import {
  getBestSellers,
  getProductBySlug,
  listProducts,
} from "../services/product.service.js";
import { NotFoundError } from "../middleware/errors.js";

export const productsRouter = Router();

/**
 * Boolean trong query string.
 *
 * KHÔNG dùng z.coerce.boolean(): nó chạy Boolean("false") = true, nên
 * `?featured=false` sẽ bị hiểu thành true. Phải so khớp chuỗi tường minh.
 */
const boolQuery = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1")
  .optional();

/** Query string luôn là chuỗi, nên dùng coerce để đổi sang số */
const listQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
  brand: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  featured: boolQuery,
  flashSale: boolQuery,
  sort: z
    .enum(["newest", "price-asc", "price-desc", "best-selling", "rating"])
    .default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(20),
});

/**
 * GET /api/products
 * Ví dụ:
 *   /api/products?featured=true&pageSize=5
 *   /api/products?flashSale=true
 *   /api/products?category=linh-kien&sort=price-asc&page=2
 */
productsRouter.get("/", async (req, res, next) => {
  try {
    const params = listQuerySchema.parse(req.query);
    res.json(await listProducts(params));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products/best-sellers?limit=4
 * Tách riêng vì khối "Top bán chạy" cần thứ hạng, không cần phân trang.
 */
productsRouter.get("/best-sellers", async (req, res, next) => {
  try {
    const { limit } = z
      .object({ limit: z.coerce.number().int().min(1).max(20).default(4) })
      .parse(req.query);
    res.json({ items: await getBestSellers(limit) });
  } catch (error) {
    next(error);
  }
});

/** GET /api/products/:slug */
productsRouter.get("/:slug", async (req, res, next) => {
  try {
    const product = await getProductBySlug(req.params.slug);
    if (!product) throw new NotFoundError("Không tìm thấy sản phẩm");
    res.json(product);
  } catch (error) {
    next(error);
  }
});
