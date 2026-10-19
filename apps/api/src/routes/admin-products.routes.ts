import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { env } from "../env.js";
import { authenticateAdmin, requireAuth } from "../middleware/auth.js";
import { BadRequestError } from "../middleware/errors.js";
import { adminWriteLimiter, noStore } from "../middleware/security.js";
import { requirePermission } from "../middleware/permissions.js";
import { boolQuery } from "../utils/query.js";
import {
  describeUploadedFile,
  isAllowedProductImageType,
  PRODUCT_IMAGE_EXT_BY_MIME,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_FILES_PER_UPLOAD,
  PRODUCT_UPLOAD_SUBDIR,
} from "../utils/product-images.js";
import {
  adjustInventory,
  createProduct,
  getProductForAdmin,
  getProductFormOptions,
  listAllProductsForAdmin,
  listInventoryTransactions,
  listProductsForAdmin,
  updateProduct,
  updateProductStatus,
} from "../services/admin-product.service.js";
import { buildProductsReportWorkbook } from "../services/admin-product-export.service.js";
import {
  deleteProductImage,
  reorderProductImages,
  setPrimaryProductImage,
  uploadProductImages,
} from "../services/admin-product-image.service.js";

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
const imageParams = z.object({ id: z.string().trim().min(1), imageId: z.string().trim().min(1) });
const reorderBody = z.object({ imageIds: z.array(z.string().trim().min(1)).min(1).max(100) });

/*
 * Ảnh sản phẩm quản trị viên tải lên: ghi vào `<IMAGE_STORAGE_DIR>/uploads/` với tên ngẫu nhiên (KHÔNG dùng tên gốc —
 * tránh path traversal / đè file), cùng cách làm với ảnh banner (admin-banners.routes.ts). Kiểm tra chữ ký ảnh thật và
 * chặn trùng nội dung nằm ở service, sau khi multer đã ghi file.
 */
const PRODUCT_UPLOAD_DIR = join(env.images.productDir, PRODUCT_UPLOAD_SUBDIR);

const productImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      mkdirSync(PRODUCT_UPLOAD_DIR, { recursive: true });
      cb(null, PRODUCT_UPLOAD_DIR);
    },
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${PRODUCT_IMAGE_EXT_BY_MIME[file.mimetype] ?? ""}`),
  }),
  // Tên file tiếng Việt: busboy mặc định đọc tên theo latin1, ra chữ lỗi trong thông báo
  defParamCharset: "utf8",
  limits: { fileSize: PRODUCT_IMAGE_MAX_BYTES, files: PRODUCT_IMAGE_MAX_FILES_PER_UPLOAD },
  fileFilter: (req, file, cb) => {
    if (!isAllowedProductImageType(file.mimetype)) {
      // multer đã chèn chỗ cho file đang xét vào req.files trước khi gọi bộ lọc → số thứ tự = độ dài - 1
      const index = Array.isArray(req.files) ? Math.max(0, req.files.length - 1) : 0;
      return cb(new BadRequestError(`${describeUploadedFile(file.originalname, index)} không phải ảnh JPEG/PNG/WEBP`));
    }
    cb(null, true);
  },
});

function multerErrorMessage(error: multer.MulterError): string {
  switch (error.code) {
    case "LIMIT_FILE_SIZE": {
      // multer 2 kèm tên file bị vượt dung lượng (bộ khai báo kiểu chưa có trường này)
      const filename = (error as { filename?: string }).filename;
      return `${filename ? `Tệp "${filename}"` : "Có ảnh"} vượt quá ${PRODUCT_IMAGE_MAX_BYTES / 1024 / 1024}MB`;
    }
    case "LIMIT_FILE_COUNT":
    case "LIMIT_UNEXPECTED_FILE":
      // Quá 10 file trong trường "images" cũng báo LIMIT_UNEXPECTED_FILE (giới hạn maxCount của .array())
      return error.field && error.field !== "images"
        ? 'Ảnh phải gửi trong trường "images" của form multipart'
        : `Mỗi lần tải lên tối đa ${PRODUCT_IMAGE_MAX_FILES_PER_UPLOAD} ảnh`;
    default:
      return "Không tải được ảnh lên";
  }
}

/** Bọc multer để lỗi của riêng nó (vượt dung lượng, quá nhiều file...) cũng ra đúng dạng JSON lỗi chung của API. Multer tự xoá các file đã ghi khi lỗi. */
function uploadProductImagesMiddleware(req: Request, res: Response, next: NextFunction) {
  productImageUpload.array("images", PRODUCT_IMAGE_MAX_FILES_PER_UPLOAD)(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) return next(new BadRequestError(multerErrorMessage(error)));
    if (error) return next(error);
    next();
  });
}

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

/** GET /api/admin/products/export?status=&category=&brand=&search=&lowStockOnly= — TẤT CẢ sản phẩm khớp bộ lọc (không phân trang). Đặt TRƯỚC /:id để "export" không bị khớp nhầm thành id. */
adminProductsRouter.get("/export", requirePermission("products:read"), async (req, res, next) => {
  try {
    const { status, category, brand, search, lowStockOnly } = listQuery.omit({ page: true, pageSize: true }).parse(req.query);
    const products = await listAllProductsForAdmin({ status, category, brand, search, lowStockOnly });
    const buffer = await buildProductsReportWorkbook(products, { status, category, brand, search, lowStockOnly });

    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="san-pham_${today}.xlsx"`);
    res.send(Buffer.from(buffer));
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

/** POST /api/admin/products/:id/images — multipart, trường "images" (1–10 ảnh JPEG/PNG/WEBP, mỗi ảnh ≤ 5MB), thêm vào cuối bộ ảnh */
adminProductsRouter.post(
  "/:id/images",
  requirePermission("products:write"),
  adminWriteLimiter,
  uploadProductImagesMiddleware,
  async (req, res, next) => {
    try {
      const { id } = idParam.parse(req.params);
      const files = Array.isArray(req.files) ? req.files : [];
      res.status(201).json(await uploadProductImages(id, files, req.auth!));
    } catch (error) {
      next(error);
    }
  },
);

/** PUT /api/admin/products/:id/images/order — body {imageIds}: đủ mọi ảnh hiện có theo thứ tự mới */
adminProductsRouter.put("/:id/images/order", requirePermission("products:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    const { imageIds } = reorderBody.parse(req.body);
    res.json(await reorderProductImages(id, imageIds, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/admin/products/:id/images/:imageId/primary — đưa ảnh lên đầu, thành ảnh chính */
adminProductsRouter.patch("/:id/images/:imageId/primary", requirePermission("products:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id, imageId } = imageParams.parse(req.params);
    res.json(await setPrimaryProductImage(id, imageId, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/admin/products/:id/images/:imageId — xoá ảnh và file trên đĩa, trả về sản phẩm với bộ ảnh mới */
adminProductsRouter.delete("/:id/images/:imageId", requirePermission("products:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id, imageId } = imageParams.parse(req.params);
    res.json(await deleteProductImage(id, imageId, req.auth!));
  } catch (error) {
    next(error);
  }
});
