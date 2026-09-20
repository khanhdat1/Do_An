import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { cartWriteLimiter, noStore } from "../middleware/security.js";
import {
  addItem,
  clearCart,
  generateGuestSessionId,
  getCart,
  isValidGuestSessionId,
  removeItem,
  setItemQuantity,
  type CartOwner,
} from "../services/cart.service.js";
import { GUEST_CART_COOKIE, readCookie, setGuestCartCookie } from "../utils/cookies.js";
import { MAX_QUANTITY_PER_LINE } from "../utils/limits.js";

/**
 * Giỏ hàng dùng chung cho khách đã đăng nhập (theo tài khoản) và khách vãng lai
 * (theo cookie `pcz_cart`). Đăng nhập rồi thì giỏ vãng lai được gộp vào tài khoản
 * (xem auth.routes.ts).
 */
export const cartRouter = Router();

cartRouter.use(noStore, authenticate);

// Khách vãng lai không cần đăng nhập vẫn ghi được vào DB, nên phải giới hạn tần suất
cartRouter.use((req, res, next) => {
  if (req.method === "GET") return next();
  cartWriteLimiter(req, res, next);
});

const itemIdParam = z.object({ itemId: z.string().min(1).max(40) });

const addBody = z.object({
  productId: z.string({ error: "Thiếu mã sản phẩm" }).min(1).max(40),
  quantity: z
    .number({ error: "Số lượng không hợp lệ" })
    .int("Số lượng không hợp lệ")
    .min(1, "Số lượng tối thiểu là 1")
    .max(MAX_QUANTITY_PER_LINE, `Mỗi sản phẩm chỉ được mua tối đa ${MAX_QUANTITY_PER_LINE} cái`)
    .default(1),
});

const setQuantityBody = z.object({
  quantity: z
    .number({ error: "Số lượng không hợp lệ" })
    .int("Số lượng không hợp lệ")
    .min(1, "Số lượng tối thiểu là 1")
    .max(MAX_QUANTITY_PER_LINE, `Mỗi sản phẩm chỉ được mua tối đa ${MAX_QUANTITY_PER_LINE} cái`),
});

/** Chủ giỏ khi chỉ ĐỌC: không có cookie thì chưa có giỏ, không tạo gì cả */
function readOwner(req: Request): CartOwner | null {
  if (req.auth) return { userId: req.auth.userId };

  const sessionId = readCookie(req, GUEST_CART_COOKIE);
  return sessionId && isValidGuestSessionId(sessionId) ? { sessionId } : null;
}

/** Chủ giỏ khi GHI: khách chưa có cookie thì cấp cookie mới ngay trong response này */
function writeOwner(req: Request, res: Response): CartOwner {
  const owner = readOwner(req);
  if (owner) return owner;

  const sessionId = generateGuestSessionId();
  setGuestCartCookie(res, sessionId);
  return { sessionId };
}

/** GET /api/cart */
cartRouter.get("/", async (req, res, next) => {
  try {
    res.json(await getCart(readOwner(req)));
  } catch (error) {
    next(error);
  }
});

/** POST /api/cart/items  { productId, quantity? } — thêm vào giỏ (cộng dồn nếu đã có) */
cartRouter.post("/items", async (req, res, next) => {
  try {
    const { productId, quantity } = addBody.parse(req.body);
    res.json(await addItem(writeOwner(req, res), productId, quantity));
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/cart/items/:itemId  { quantity } — đặt số lượng mới */
cartRouter.patch("/items/:itemId", async (req, res, next) => {
  try {
    const { itemId } = itemIdParam.parse(req.params);
    const { quantity } = setQuantityBody.parse(req.body);
    res.json(await setItemQuantity(writeOwner(req, res), itemId, quantity));
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/cart/items/:itemId */
cartRouter.delete("/items/:itemId", async (req, res, next) => {
  try {
    const { itemId } = itemIdParam.parse(req.params);
    res.json(await removeItem(writeOwner(req, res), itemId));
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/cart — làm trống giỏ */
cartRouter.delete("/", async (req, res, next) => {
  try {
    res.json(await clearCart(writeOwner(req, res)));
  } catch (error) {
    next(error);
  }
});
