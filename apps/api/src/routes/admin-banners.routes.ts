import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { authenticateAdmin, requireAuth } from "../middleware/auth.js";
import { adminWriteLimiter, noStore } from "../middleware/security.js";
import { requirePermission } from "../middleware/permissions.js";
import { BadRequestError } from "../middleware/errors.js";
import { createBanner, deleteBanner, getBannerForAdmin, listBannersForAdmin, updateBanner } from "../services/admin-banner.service.js";

/** Quản trị banner trang chủ (Đợt 6 phần 2 — nội dung). */
export const adminBannersRouter = Router();

adminBannersRouter.use(noStore, authenticateAdmin, requireAuth);

// `apps/api/src/routes` -> lên 4 cấp là gốc monorepo -> vào apps/web/public/images/banners.
// Cùng cách tính đường dẫn tương đối crawler đang dùng để ghi ảnh sản phẩm (IMAGE_STORAGE_DIR),
// chỉ khác là viết cứng ở đây vì banner không cần chỉnh qua biến môi trường.
const here = dirname(fileURLToPath(import.meta.url));
const BANNER_IMAGE_DIR = resolve(here, "../../../../apps/web/public/images/banners");
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!existsSync(BANNER_IMAGE_DIR)) mkdirSync(BANNER_IMAGE_DIR, { recursive: true });
      cb(null, BANNER_IMAGE_DIR);
    },
    // Tên file random, KHÔNG dùng tên gốc người upload gửi lên — tránh path traversal / đè file
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${EXT_BY_MIME[file.mimetype] ?? ""}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) return cb(new BadRequestError("Chỉ nhận ảnh JPEG/PNG/WEBP/GIF"));
    cb(null, true);
  },
});

/** Bọc multer để lỗi của riêng nó (vượt dung lượng...) cũng ra đúng dạng JSON lỗi chung của API, không rơi vào 500 chung chung */
function uploadImageMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.single("image")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      return next(new BadRequestError(error.code === "LIMIT_FILE_SIZE" ? "Ảnh vượt quá 5MB" : "Không tải được ảnh lên"));
    }
    if (error) return next(error);
    next();
  });
}

/** POST /api/admin/banners/upload-image — multipart field "image", trả về {url} để đưa vào form tạo/sửa banner */
adminBannersRouter.post("/upload-image", requirePermission("content:write"), adminWriteLimiter, uploadImageMiddleware, (req, res, next) => {
  try {
    if (!req.file) throw new BadRequestError("Thiếu file ảnh");
    res.status(201).json({ url: `/images/banners/${req.file.filename}` });
  } catch (error) {
    next(error);
  }
});

const bannerInputBody = z.object({
  title: z.string().trim().max(200).optional(),
  subtitle: z.string().trim().max(300).optional(),
  imageUrl: z.string().trim().min(1).max(500),
  linkUrl: z.string().trim().max(500).optional(),
  displayOrder: z.coerce.number().int(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

const idParam = z.object({ id: z.string().trim().min(1) });

/** GET /api/admin/banners — mọi trạng thái */
adminBannersRouter.get("/", requirePermission("content:read"), async (_req, res, next) => {
  try {
    res.json({ items: await listBannersForAdmin() });
  } catch (error) {
    next(error);
  }
});

/** GET /api/admin/banners/:id */
adminBannersRouter.get("/:id", requirePermission("content:read"), async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    res.json(await getBannerForAdmin(id));
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/banners — luôn gọi /upload-image trước để có imageUrl */
adminBannersRouter.post("/", requirePermission("content:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const input = bannerInputBody.parse(req.body);
    res.status(201).json(await createBanner(input, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/admin/banners/:id */
adminBannersRouter.patch("/:id", requirePermission("content:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    const input = bannerInputBody.parse(req.body);
    res.json(await updateBanner(id, input, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/admin/banners/:id — không có bảng con tham chiếu, xoá thẳng */
adminBannersRouter.delete("/:id", requirePermission("content:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    await deleteBanner(id, req.auth!);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
