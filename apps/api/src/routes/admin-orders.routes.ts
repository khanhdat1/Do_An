import { Router } from "express";
import { z } from "zod";
import { authenticateAdmin, requireAuth } from "../middleware/auth.js";
import { adminWriteLimiter, noStore } from "../middleware/security.js";
import { requirePermission } from "../middleware/permissions.js";
import { confirmOrderPayment, listOrdersForAdmin } from "../services/admin-order.service.js";

/**
 * Trang quản trị xác nhận thanh toán thủ công (chuyển khoản ngân hàng / MoMo — không có cổng nào tự báo
 * "đã thanh toán" như VNPay). Phiên đăng nhập admin riêng (`authenticateAdmin`) + quyền `orders:write`.
 */
export const adminOrdersRouter = Router();

adminOrdersRouter.use(noStore, authenticateAdmin, requireAuth);

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED", "CANCELLED"]).optional(),
  paymentMethod: z.enum(["COD", "VNPAY", "BANK_TRANSFER", "MOMO"]).optional(),
});

const orderCodeParam = z.object({ orderCode: z.string().min(1).max(30) });

/** GET /api/admin/orders?paymentStatus=&paymentMethod=&page=&pageSize= — mặc định không lọc, mới nhất trước */
adminOrdersRouter.get("/", requirePermission("orders:read"), async (req, res, next) => {
  try {
    const { page, pageSize, paymentStatus, paymentMethod } = listQuery.parse(req.query);
    res.json(await listOrdersForAdmin({ paymentStatus, paymentMethod }, page, pageSize));
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/orders/:orderCode/confirm-payment — đánh dấu đã nhận được tiền chuyển khoản/MoMo */
adminOrdersRouter.post("/:orderCode/confirm-payment", requirePermission("orders:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { orderCode } = orderCodeParam.parse(req.params);
    res.json(await confirmOrderPayment(orderCode, req.auth!.userId));
  } catch (error) {
    next(error);
  }
});
