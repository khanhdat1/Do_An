import { Router } from "express";
import { z } from "zod";
import {
  getBestSellers,
  getProductBySlug,
  getProductFacets,
  listProducts,
} from "../services/product.service.js";
import { SPEC_FILTER_KEYS, type SpecFilterKey, type SpecSelections } from "../catalog/spec-filters.js";
import { NotFoundError } from "../middleware/errors.js";
import { boolQuery } from "../utils/query.js";

export const productsRouter = Router();

/**
 * Giá trị của một bộ lọc thông số, nhiều giá trị cách nhau dấu phẩy: ?socket=AM5,LGA1851. Mỗi giá trị chỉ gồm chữ,
 * số, dấu chấm, gạch ngang (tối đa 24 ký tự, 12 giá trị) — đủ cho "LGA1851", "rtx-4070-ti-super", "600-749".
 */
const specValuesQuery = z
  .string()
  .trim()
  .max(300)
  .regex(/^[A-Za-z0-9.-]{1,24}(,[A-Za-z0-9.-]{1,24}){0,11}$/, "Giá trị bộ lọc thông số không hợp lệ")
  .transform((value) => [...new Set(value.split(","))])
  .optional();

const specFilterShape = Object.fromEntries(SPEC_FILTER_KEYS.map((key) => [key, specValuesQuery])) as Record<
  SpecFilterKey,
  typeof specValuesQuery
>;

/** Query string luôn là chuỗi, nên dùng coerce để đổi sang số */
const filterQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
  // Nhiều hãng cách nhau dấu phẩy: ?brand=asus,msi
  brand: z.string().trim().min(1).max(300).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  inStock: boolQuery,
  ...specFilterShape,
});

const listQuerySchema = filterQuerySchema.extend({
  featured: boolQuery,
  flashSale: boolQuery,
  sort: z
    .enum(["newest", "price-asc", "price-desc", "best-selling", "rating"])
    .default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(20),
});

/** Gom các tham số thông số (socket, ramType...) vào `specs`, phần còn lại giữ nguyên */
function withSpecs<T extends Partial<Record<SpecFilterKey, string[]>>>(query: T): Omit<T, SpecFilterKey> & { specs: SpecSelections } {
  const rest: Partial<T> = { ...query };
  const specs: SpecSelections = {};
  for (const key of SPEC_FILTER_KEYS) {
    const values = query[key];
    if (values) specs[key] = values;
    delete rest[key];
  }
  return { ...(rest as Omit<T, SpecFilterKey>), specs };
}

/**
 * GET /api/products
 * Ví dụ:
 *   /api/products?featured=true&pageSize=5
 *   /api/products?flashSale=true
 *   /api/products?category=linh-kien&sort=price-asc&page=2
 *   /api/products?category=man-hinh&brand=asus,lg&minPrice=3000000&inStock=true
 *   /api/products?category=mainboard&socket=AM5&ramType=DDR5   (bộ lọc thông số: catalog/spec-filters.ts)
 */
productsRouter.get("/", async (req, res, next) => {
  try {
    res.json(await listProducts(withSpecs(listQuerySchema.parse(req.query))));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products/facets?category=mainboard&socket=AM5
 * Các nhóm lọc thông số của danh mục (chỉ nhóm đủ dữ liệu) và số sản phẩm mỗi lựa chọn, tính theo cùng bộ lọc với
 * danh sách. Khai báo TRƯỚC `/:slug`, nếu không "facets" bị hiểu là slug sản phẩm.
 */
productsRouter.get("/facets", async (req, res, next) => {
  try {
    res.json(await getProductFacets(withSpecs(filterQuerySchema.parse(req.query))));
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
