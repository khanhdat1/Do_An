import { Router } from "express";
import { z } from "zod";
import { authenticate, requireAuth } from "../middleware/auth.js";
import { buildSaveLimiter, noStore, pcBuildLimiter } from "../middleware/security.js";
import { BUILD_SLOTS, MAX_RAM_QUANTITY } from "../pc-build/slots.js";
import {
  deleteMyBuild,
  getSavedBuild,
  listBuildComponents,
  listMyBuilds,
  saveBuild,
  validateBuild,
  type BuildSelectionInput,
} from "../services/pc-build.service.js";

export const pcBuildRouter = Router();

pcBuildRouter.use(pcBuildLimiter);

const productId = z.string().trim().min(1).max(50);
const quantity = z.coerce.number().int().min(1).max(MAX_RAM_QUANTITY);

/** Cùng khoá với URL trang `/ai-build-pc?cpu=…&mainboard=…&ram=…&ramQty=2` */
const componentsQuery = z.object({
  type: z.string().toUpperCase().pipe(z.enum(BUILD_SLOTS)),
  cpu: productId.optional(),
  mainboard: productId.optional(),
  ram: productId.optional(),
  ramQty: quantity.optional(),
  vga: productId.optional(),
  ssd: productId.optional(),
  psu: productId.optional(),
  case: productId.optional(),
});

/**
 * GET /api/pc-build/components?type=cpu&mainboard=<id>…
 * Danh sách linh kiện đang bán của một ô, mỗi món kèm huy hiệu tương thích với các món đã chọn.
 */
pcBuildRouter.get("/components", async (req, res, next) => {
  try {
    const query = componentsQuery.parse(req.query);
    const selection: BuildSelectionInput[] = [
      { productId: query.cpu },
      { productId: query.mainboard },
      { productId: query.ram, quantity: query.ramQty },
      { productId: query.vga },
      { productId: query.ssd },
      { productId: query.psu },
      { productId: query.case },
    ].filter((item): item is BuildSelectionInput => item.productId !== undefined);
    res.json(await listBuildComponents(query.type, selection));
  } catch (error) {
    next(error);
  }
});

const itemsSchema = z
  .array(z.object({ productId, quantity: z.number().int().min(1).max(MAX_RAM_QUANTITY).optional() }))
  .max(BUILD_SLOTS.length);

/** POST /api/pc-build/validate { items: [{ productId, quantity? }] } — kiểm tra tương thích + tổng tiền + công suất */
pcBuildRouter.post("/validate", async (req, res, next) => {
  try {
    const { items } = z.object({ items: itemsSchema }).parse(req.body);
    res.json(await validateBuild(items));
  } catch (error) {
    next(error);
  }
});

/** POST /api/pc-build/builds { name, items } — lưu bản chụp cấu hình, trả link ngắn. Khách chưa đăng nhập cũng lưu được */
pcBuildRouter.post("/builds", authenticate, buildSaveLimiter, async (req, res, next) => {
  try {
    const { name, items } = z.object({ name: z.string().trim().min(1).max(100), items: itemsSchema.min(1) }).parse(req.body);
    res.status(201).json(await saveBuild(req.auth?.userId ?? null, { name, items }));
  } catch (error) {
    next(error);
  }
});

/** GET /api/pc-build/builds — cấu hình đã lưu của tài khoản đang đăng nhập, mới nhất trước */
pcBuildRouter.get("/builds", noStore, authenticate, requireAuth, async (req, res, next) => {
  try {
    res.json({ items: await listMyBuilds(req.auth!.userId) });
  } catch (error) {
    next(error);
  }
});

const codeParam = z.object({ code: z.string().trim().min(1).max(20) });

/**
 * GET /api/pc-build/builds/:code — công khai: ai có link cũng mở được. Đăng nhập thì thêm `isMine` đúng theo tài
 * khoản (kết quả khác nhau theo người xem nên không cho cache).
 */
pcBuildRouter.get("/builds/:code", noStore, authenticate, async (req, res, next) => {
  try {
    const { code } = codeParam.parse(req.params);
    res.json(await getSavedBuild(code, req.auth?.userId ?? null));
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/pc-build/builds/:code — chỉ chủ cấu hình */
pcBuildRouter.delete("/builds/:code", authenticate, requireAuth, async (req, res, next) => {
  try {
    const { code } = codeParam.parse(req.params);
    await deleteMyBuild(req.auth!.userId, code);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
