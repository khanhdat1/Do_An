import { Router } from "express";
import { z } from "zod";
import { noStore, orderLookupLimiter } from "../middleware/security.js";
import { lookupGuestOrder } from "../services/order.service.js";
import { phoneSchema } from "../utils/validators.js";

/**
 * Tra cứu đơn hàng KHÔNG cần đăng nhập ("Tra cứu đơn hàng trực tuyến" ở chân trang): phải khớp cả mã đơn
 * lẫn số điện thoại nhận hàng, và có trần gọi chặt để không bị dò. Đặt hàng luôn bắt buộc đăng nhập nên đây
 * là cách duy nhất xem lại đơn khi không nhớ mật khẩu / dùng máy khác.
 */
export const orderLookupRouter = Router();

orderLookupRouter.use(noStore, orderLookupLimiter);

const lookupQuery = z.object({
  code: z.string().trim().min(1).max(30),
  phone: phoneSchema,
});

/** GET /api/order-lookup?code=PCZ20260922-0001&phone=0901234567 */
orderLookupRouter.get("/", async (req, res, next) => {
  try {
    const { code, phone } = lookupQuery.parse(req.query);
    const order = await lookupGuestOrder(code, phone);

    if (!order) {
      res.status(404).json({
        error: "NOT_FOUND",
        message: "Không tìm thấy đơn hàng khớp mã đơn và số điện thoại đã nhập",
      });
      return;
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
});
