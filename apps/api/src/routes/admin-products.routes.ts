import { Router } from "express";
import { z } from "zod";
import { authenticateAdmin, requireAuth } from "../middleware/auth.js";
import { adminWriteLimiter, noStore } from "../middleware/security.js";
import { requirePermission } from "../middleware/permissions.js";
import { boolQuery } from "../utils/query.js";
import {
  adjustInventory,
  createProduct,
  getProductForAdmin,
  getProductFormOptions,
  listInventoryTransactions,
  listProductsForAdmin,
  updateProduct,
  updateProductStatus,
} from "../services/admin-product.service.js";

/** Quản lý sản phẩm và kho hàng. Phiên đăng nhập admin riêng + quyền `products:*` cho từng route ghi dữ liệu. */
export const adminProductsRouter = Router();

adminProductsRouter.use(noStore, authenticateAdmin, requireAuth);

const PRODUCT_STATUS_VALUES = ["DRAFT", "ACTIVE", "HIDDEN", "DISCONTINUED"] as const;

const listQuery = z.object({
  status: z.enum(PRODUCT_STATUS_VALUES).optional(),
  category: z.string().trim().min(1).optional(),
  brand: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  lowStockOnly: boolQuery,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(20),
});

const specRow = z.object({ label: z.string().trim().min(1).max(100), value: z.string().trim().min(1).max(500) });

const productInputBody = z.object({
  name: z.string().trim().min(1).max(300),
  sku: z.string().trim().min(1).max(100),
  categoryId: z.string().trim().min(1),
  brandId: z.string().trim().min(1).optional(),
  sellingPrice: z.coerce.number().int().nonnegative(),
  costPrice: z.coerce.number().int().nonnegative().optional(),
  originalPrice: z.coerce.number().int().nonnegative().optional(),
  shortDescription: z.string().trim().max(500).optional(),
  description: z.string().trim().max(20000).optional(),
  warrantyMonths: z.coerce.number().int().min(0).max(120).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  specifications: z.array(specRow).max(50).optional(),
});

const statusBody = z.object({ status: z.enum(PRODUCT_STATUS_VALUES) });

const inventoryBody = z.discriminatedUnion("type", [
  z.object({ type: z.literal("IMPORT"), quantity: z.coerce.number().int().positive(), unitCost: z.coerce.number().int().nonnegative().optional(), note: z.string().trim().max(300).optional() }),
  z.object({ type: z.literal("EXPORT"), quantity: z.coerce.number().int().positive(), note: z.string().trim().max(300).optional() }),
  z.object({ type: z.literal("ADJUST"), newQuantity: z.coerce.number().int().min(0), note: z.string().trim().max(300).optional() }),
]);

const idParam = z.object({ id: z.string().trim().min(1) });

/** GET /api/admin/products?status=&category=&brand=&search=&lowStockOnly=&page=&pageSize= */
adminProductsRouter.get("/", requirePermission("products:read"), async (req, res, next) => {
  try {
    const { status, category, brand, search, lowStockOnly, page, pageSize } = listQuery.parse(req.query);
    res.json(await listProductsForAdmin({ status, category, brand, search, lowStockOnly }, page, pageSize));
  } catch (error) {
    next(error);
  }
});

/** GET /api/admin/products/meta/options — danh mục/hãng phẳng cho ô chọn của form. Đặt TRƯỚC /:id để "meta" không bị khớp nhầm thành id. */
adminProductsRouter.get("/meta/options", requirePermission("products:read"), async (_req, res, next) => {
  try {
    res.json(await getProductFormOptions());
  } catch (error) {
    next(error);
  }
});

/** GET /api/admin/products/:id */
adminProductsRouter.get("/:id", requirePermission("products:read"), async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    res.json(await getProductForAdmin(id));
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/products — sản phẩm mới luôn vào DRAFT, phải duyệt riêng mới hiện ra ngoài */
adminProductsRouter.post("/", requirePermission("products:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const input = productInputBody.parse(req.body);
    res.status(201).json(await createProduct(input, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/admin/products/:id */
adminProductsRouter.patch("/:id", requirePermission("products:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    const input = productInputBody.parse(req.body);
    res.json(await updateProduct(id, input, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/admin/products/:id/status — ẩn/lưu trữ/duyệt DRAFT/mở bán lại */
adminProductsRouter.patch("/:id/status", requirePermission("products:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    const { status } = statusBody.parse(req.body);
    res.json(await updateProductStatus(id, status, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** GET /api/admin/products/:id/inventory?page=&pageSize= — lịch sử nhập/xuất/điều chỉnh/hoàn */
adminProductsRouter.get("/:id/inventory", requirePermission("products:read"), async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    const { page, pageSize } = z
      .object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(60).default(20) })
      .parse(req.query);
    res.json(await listInventoryTransactions(id, page, pageSize));
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/products/:id/inventory — nhập/xuất/điều chỉnh thủ công */
adminProductsRouter.post("/:id/inventory", requirePermission("products:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    const input = inventoryBody.parse(req.body);
    res.json(await adjustInventory(id, input, req.auth!));
  } catch (error) {
    next(error);
  }
});
