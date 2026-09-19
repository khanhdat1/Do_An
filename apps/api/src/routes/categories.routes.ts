import { Router } from "express";
import { z } from "zod";
import {
  getFeaturedCategories,
  listCategories,
} from "../services/category.service.js";

export const categoriesRouter = Router();

/** GET /api/categories — cây danh mục đầy đủ (dùng cho menu, trang danh mục) */
categoriesRouter.get("/", async (_req, res, next) => {
  try {
    res.json({ items: await listCategories() });
  } catch (error) {
    next(error);
  }
});

/** GET /api/categories/featured?limit=6 — lưới danh mục nổi bật ở trang chủ */
categoriesRouter.get("/featured", async (req, res, next) => {
  try {
    const { limit } = z
      .object({ limit: z.coerce.number().int().min(1).max(12).default(6) })
      .parse(req.query);
    res.json({ items: await getFeaturedCategories(limit) });
  } catch (error) {
    next(error);
  }
});
