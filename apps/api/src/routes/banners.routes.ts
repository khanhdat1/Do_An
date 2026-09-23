import { Router } from "express";
import { listActiveBanners } from "../services/banner.service.js";

export const bannersRouter = Router();

/** GET /api/banners — dải banner khuyến mãi trang chủ, công khai, không cần đăng nhập */
bannersRouter.get("/", async (_req, res, next) => {
  try {
    res.json({ items: await listActiveBanners() });
  } catch (error) {
    next(error);
  }
});
