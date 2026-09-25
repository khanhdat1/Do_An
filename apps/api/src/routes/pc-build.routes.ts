import { Router } from "express";
import { z } from "zod";
import { pcBuildLimiter } from "../middleware/security.js";
import { BUILD_SLOTS, MAX_RAM_QUANTITY } from "../pc-build/slots.js";
import { listBuildComponents, validateBuild, type BuildSelectionInput } from "../services/pc-build.service.js";

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

const validateBody = z.object({
  items: z
    .array(z.object({ productId, quantity: z.number().int().min(1).max(MAX_RAM_QUANTITY).optional() }))
    .max(BUILD_SLOTS.length),
});

/** POST /api/pc-build/validate { items: [{ productId, quantity? }] } — kiểm tra tương thích + tổng tiền + công suất */
pcBuildRouter.post("/validate", async (req, res, next) => {
  try {
    const { items } = validateBody.parse(req.body);
    res.json(await validateBuild(items));
  } catch (error) {
    next(error);
  }
});
