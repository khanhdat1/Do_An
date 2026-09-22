import { Router } from "express";
import { z } from "zod";
import { authenticate, requireAuth } from "../middleware/auth.js";
import { voucherPreviewLimiter } from "../middleware/security.js";
import { listActiveVouchers, previewVoucher } from "../services/voucher.service.js";

export const vouchersRouter = Router();

/** GET /api/vouchers — danh sách mã đang áp dụng được, công khai, không cần đăng nhập */
vouchersRouter.get("/", async (_req, res, next) => {
  try {
    res.json({ items: await listActiveVouchers() });
  } catch (error) {
    next(error);
  }
});

const previewQuery = z.object({
  code: z.string().trim().min(1).max(50),
  subtotal: z.coerce.number().int().nonnegative(),
});

/**
 * GET /api/vouchers/preview?code=WELCOME10&subtotal=1200000 — xem trước số tiền được giảm TRƯỚC khi
 * đặt hàng. Bắt buộc đăng nhập vì cần userId để kiểm `perUserLimit`, khớp với việc trang đặt hàng vốn
 * đã đứng sau màn hình đăng nhập.
 */
vouchersRouter.get("/preview", authenticate, requireAuth, voucherPreviewLimiter, async (req, res, next) => {
  try {
    const { code, subtotal } = previewQuery.parse(req.query);
    res.json(await previewVoucher(req.auth!.userId, code, subtotal));
  } catch (error) {
    next(error);
  }
});
