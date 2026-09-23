import { Router } from "express";
import { z } from "zod";
import { authenticateAdmin, requireAuth } from "../middleware/auth.js";
import { adminWriteLimiter, noStore } from "../middleware/security.js";
import { requirePermission } from "../middleware/permissions.js";
import {
  advanceOrderStatus,
  cancelOrderAsAdmin,
  confirmOrderPayment,
  getOrderForAdmin,
  listAllOrdersForAdmin,
  listOrdersForAdmin,
  markOrderRefunded,
  returnOrder,
  updateOrderInternalNote,
  updateOrderTrackingNumber,
} from "../services/admin-order.service.js";
import { buildOrdersReportWorkbook } from "../services/admin-order-export.service.js";

/**
 * Quản trị đơn hàng: xem danh sách/chi tiết, xác nhận thanh toán thủ công, chuyển trạng thái theo vòng
 * đời, mã vận đơn, ghi chú nội bộ, huỷ/hoàn theo quyền. Phiên đăng nhập admin riêng (`authenticateAdmin`)
 * + kiểm quyền `orders:*` cho TỪNG route ghi dữ liệu (không chặn chung ở router).
 */
export const adminOrdersRouter = Router();

adminOrdersRouter.use(noStore, authenticateAdmin, requireAuth);

const ORDER_STATUS_VALUES = ["PENDING", "CONFIRMED", "PACKING", "SHIPPING", "DELIVERED", "CANCELLED", "RETURNED"] as const;

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(ORDER_STATUS_VALUES).optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED", "CANCELLED"]).optional(),
  paymentMethod: z.enum(["COD", "VNPAY", "BANK_TRANSFER", "MOMO"]).optional(),
});

const orderCodeParam = z.object({ orderCode: z.string().min(1).max(30) });
const reasonBody = z.object({ reason: z.string().trim().max(300).optional() });
const noteBody = z.object({ note: z.string().trim().max(300).optional() });
const statusBody = z.object({
  status: z.enum(ORDER_STATUS_VALUES),
  note: z.string().trim().max(300).optional(),
});
const trackingNumberBody = z.object({ trackingNumber: z.string().trim().max(100) });
const internalNoteBody = z.object({ internalNote: z.string().trim().max(500) });

/** GET /api/admin/orders?status=&paymentStatus=&paymentMethod=&page=&pageSize= — mặc định không lọc, mới nhất trước */
adminOrdersRouter.get("/", requirePermission("orders:read"), async (req, res, next) => {
  try {
    const { page, pageSize, status, paymentStatus, paymentMethod } = listQuery.parse(req.query);
    res.json(await listOrdersForAdmin({ status, paymentStatus, paymentMethod }, page, pageSize));
  } catch (error) {
    next(error);
  }
});

/** GET /api/admin/orders/export?status=&paymentStatus=&paymentMethod= — TẤT CẢ đơn khớp bộ lọc (không phân trang). Đặt TRƯỚC /:orderCode để "export" không bị khớp nhầm thành mã đơn */
adminOrdersRouter.get("/export", requirePermission("orders:read"), async (req, res, next) => {
  try {
    const { status, paymentStatus, paymentMethod } = listQuery.omit({ page: true, pageSize: true }).parse(req.query);
    const orders = await listAllOrdersForAdmin({ status, paymentStatus, paymentMethod });
    const buffer = await buildOrdersReportWorkbook(orders, { status, paymentStatus, paymentMethod });

    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="don-hang_${today}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});

/** GET /api/admin/orders/:orderCode — chi tiết đầy đủ cho trang quản trị */
adminOrdersRouter.get("/:orderCode", requirePermission("orders:read"), async (req, res, next) => {
  try {
    const { orderCode } = orderCodeParam.parse(req.params);
    res.json(await getOrderForAdmin(orderCode));
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/orders/:orderCode/confirm-payment — đánh dấu đã nhận được tiền chuyển khoản/MoMo */
adminOrdersRouter.post("/:orderCode/confirm-payment", requirePermission("orders:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { orderCode } = orderCodeParam.parse(req.params);
    res.json(await confirmOrderPayment(orderCode, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/admin/orders/:orderCode/status — chuyển tiến đúng một bước (PENDING→CONFIRMED→PACKING→SHIPPING→DELIVERED) */
adminOrdersRouter.patch("/:orderCode/status", requirePermission("orders:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { orderCode } = orderCodeParam.parse(req.params);
    const { status, note } = statusBody.parse(req.body);
    res.json(await advanceOrderStatus(orderCode, status, note, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/orders/:orderCode/cancel — nhân viên huỷ đơn (rộng hơn khách tự huỷ), hoàn kho + mã giảm giá */
adminOrdersRouter.post("/:orderCode/cancel", requirePermission("orders:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { orderCode } = orderCodeParam.parse(req.params);
    const { reason } = reasonBody.parse(req.body);
    res.json(await cancelOrderAsAdmin(orderCode, reason, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/orders/:orderCode/return — khách trả hàng đã nhận, hoàn kho kiểu RETURN */
adminOrdersRouter.post("/:orderCode/return", requirePermission("orders:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { orderCode } = orderCodeParam.parse(req.params);
    const { reason } = reasonBody.parse(req.body);
    res.json(await returnOrder(orderCode, reason, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/orders/:orderCode/mark-refunded — ghi nhận THỦ CÔNG đã chuyển tiền lại, không tự động qua cổng nào */
adminOrdersRouter.post("/:orderCode/mark-refunded", requirePermission("orders:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { orderCode } = orderCodeParam.parse(req.params);
    const { note } = noteBody.parse(req.body);
    res.json(await markOrderRefunded(orderCode, note, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/admin/orders/:orderCode/tracking-number — chuỗi rỗng để xoá */
adminOrdersRouter.patch("/:orderCode/tracking-number", requirePermission("orders:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { orderCode } = orderCodeParam.parse(req.params);
    const { trackingNumber } = trackingNumberBody.parse(req.body);
    res.json(await updateOrderTrackingNumber(orderCode, trackingNumber, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/admin/orders/:orderCode/internal-note — chuỗi rỗng để xoá */
adminOrdersRouter.patch("/:orderCode/internal-note", requirePermission("orders:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { orderCode } = orderCodeParam.parse(req.params);
    const { internalNote } = internalNoteBody.parse(req.body);
    res.json(await updateOrderInternalNote(orderCode, internalNote, req.auth!));
  } catch (error) {
    next(error);
  }
});
