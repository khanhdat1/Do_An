import { Router } from "express";
import { z } from "zod";
import { authenticate, requireAuth } from "../middleware/auth.js";
import { noStore, orderWriteLimiter } from "../middleware/security.js";
import {
  cancelOrder,
  createOrder,
  getOrderByCode,
  listOrders,
  retryVnpayPayment,
} from "../services/order.service.js";
import { addressInputSchema } from "../utils/validators.js";

/**
 * Đặt hàng và tra cứu đơn của CHÍNH tài khoản đang đăng nhập. Không có phiên bản khách vãng lai —
 * đặt hàng bắt buộc đăng nhập (xem `CheckoutGate` ở web). Tra cứu KHÔNG cần đăng nhập nằm ở
 * `order-lookup.routes.ts`.
 */
export const ordersRouter = Router();

ordersRouter.use(noStore, authenticate, requireAuth);

const orderCodeParam = z.object({ orderCode: z.string().min(1).max(30) });

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

const createOrderBody = z
  .object({
    addressId: z.string().min(1).max(40).optional(),
    newAddress: addressInputSchema.extend({ saveAsDefault: z.boolean().default(false) }).optional(),
    paymentMethod: z.enum(["COD", "VNPAY", "MOMO", "BANK_TRANSFER"], { error: "Phương thức thanh toán không hợp lệ" }),
    customerNote: z.string().trim().max(500).optional(),
    voucherCode: z.string().trim().min(1).max(50).optional(),
  })
  .refine((data) => Boolean(data.addressId) !== Boolean(data.newAddress), {
    message: "Chọn một địa chỉ đã lưu hoặc nhập địa chỉ giao hàng mới",
    path: ["addressId"],
  });

const cancelBody = z.object({ reason: z.string().trim().max(300).optional() });

/** GET /api/orders?page=&pageSize= — mới nhất trước */
ordersRouter.get("/", async (req, res, next) => {
  try {
    const { page, pageSize } = listQuery.parse(req.query);
    res.json(await listOrders(req.auth!.userId, page, pageSize));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/orders — tạo đơn từ giỏ hàng hiện tại. Trả `payUrl` khi chọn VNPay (trình duyệt chuyển
 * sang đó); chọn COD thì không có, trang đặt hàng chuyển thẳng sang trang chi tiết đơn.
 */
ordersRouter.post("/", orderWriteLimiter, async (req, res, next) => {
  try {
    const input = createOrderBody.parse(req.body);
    const result = await createOrder({ ...input, userId: req.auth!.userId, ip: req.ip ?? "0.0.0.0" });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/** GET /api/orders/:orderCode */
ordersRouter.get("/:orderCode", async (req, res, next) => {
  try {
    const { orderCode } = orderCodeParam.parse(req.params);
    res.json(await getOrderByCode(req.auth!.userId, orderCode));
  } catch (error) {
    next(error);
  }
});

/** POST /api/orders/:orderCode/cancel  { reason? } — chỉ được khi chưa thanh toán và chưa đóng gói */
ordersRouter.post("/:orderCode/cancel", orderWriteLimiter, async (req, res, next) => {
  try {
    const { orderCode } = orderCodeParam.parse(req.params);
    const { reason } = cancelBody.parse(req.body ?? {});
    res.json(await cancelOrder(req.auth!.userId, orderCode, reason));
  } catch (error) {
    next(error);
  }
});

/** POST /api/orders/:orderCode/pay — mở một lượt thử thanh toán VNPay mới cho đơn chưa trả tiền thành công */
ordersRouter.post("/:orderCode/pay", orderWriteLimiter, async (req, res, next) => {
  try {
    const { orderCode } = orderCodeParam.parse(req.params);
    res.json(await retryVnpayPayment(req.auth!.userId, orderCode, req.ip ?? "0.0.0.0"));
  } catch (error) {
    next(error);
  }
});
