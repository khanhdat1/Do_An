import { Router } from "express";
import { z } from "zod";
import { authenticate, requireAuth } from "../middleware/auth.js";
import { noStore, wishlistWriteLimiter } from "../middleware/security.js";
import {
  addToWishlist,
  listWishlist,
  removeFromWishlist,
  wishlistProductIds,
} from "../services/wishlist.service.js";

/** Sản phẩm yêu thích — chỉ tài khoản đã đăng nhập mới có (không có phiên bản khách vãng lai) */
export const wishlistRouter = Router();

wishlistRouter.use(noStore, authenticate, requireAuth);

const productIdParam = z.object({ productId: z.string().min(1).max(40) });

/** GET /api/wishlist */
wishlistRouter.get("/", async (req, res, next) => {
  try {
    res.json({ items: await listWishlist(req.auth!.userId) });
  } catch (error) {
    next(error);
  }
});

/** GET /api/wishlist/ids — gọi nhẹ để tô trạng thái nút trái tim, không tải cả object sản phẩm */
wishlistRouter.get("/ids", async (req, res, next) => {
  try {
    res.json({ productIds: await wishlistProductIds(req.auth!.userId) });
  } catch (error) {
    next(error);
  }
});

/** POST /api/wishlist/:productId */
wishlistRouter.post("/:productId", wishlistWriteLimiter, async (req, res, next) => {
  try {
    const { productId } = productIdParam.parse(req.params);
    await addToWishlist(req.auth!.userId, productId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/wishlist/:productId */
wishlistRouter.delete("/:productId", wishlistWriteLimiter, async (req, res, next) => {
  try {
    const { productId } = productIdParam.parse(req.params);
    await removeFromWishlist(req.auth!.userId, productId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
