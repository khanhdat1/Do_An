import { prisma, type OrderStatus, type PaymentMethod, type PaymentStatus, type Prisma, type UserRole } from "@pczone/db";
import {
  adminOrderInclude,
  canAdminCancelOrder,
  canReturnOrder,
  FORWARD_NEXT_STATUS,
  orderSummaryInclude,
  toAdminOrderDto,
  toAdminOrderSummaryDto,
} from "../mappers/order.mapper.js";
import { ConflictError, NotFoundError } from "../middleware/errors.js";
import type { AdminOrderDto, AdminOrderSummaryDto, Paginated } from "../types/dto.js";
import { logAdminAction } from "./audit-log.service.js";

/** Ai đang thực hiện thao tác — khớp thẳng `req.auth` của phiên đăng nhập quản trị */
export interface AdminActor {
  userId: string;
  role: UserRole;
}

export interface AdminOrderFilters {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
}

/** `GET /api/admin/orders` — mặc định liệt kê TẤT CẢ đơn, mới nhất trước; lọc thêm qua query nếu có */
export async function listOrdersForAdmin(
  filters: AdminOrderFilters,
  page: number,
  pageSize: number,
): Promise<Paginated<AdminOrderSummaryDto>> {
  const where = { status: filters.status, paymentStatus: filters.paymentStatus, paymentMethod: filters.paymentMethod };

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: orderSummaryInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items: rows.map(toAdminOrderSummaryDto),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Nhân viên xác nhận tay đã nhận được tiền (chuyển khoản ngân hàng / MoMo — không có callback tự động
 * như VNPay). Cùng logic với `applyVnpayCallback` khi thành công: đơn còn PENDING thì lên CONFIRMED,
 * đơn đã đổi trạng thái khác (vd khách vừa tự huỷ) thì vẫn ghi nhận đã có tiền nhưng KHÔNG hồi sinh đơn —
 * để lại dấu vết cho việc đối soát.
 */
export async function confirmOrderPayment(orderCode: string, admin: AdminActor): Promise<AdminOrderDto> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { orderCode } });
    if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
    if (order.paymentStatus !== "PENDING") {
      throw new ConflictError("Đơn hàng này đã được xử lý thanh toán rồi");
    }

    const payment = await tx.payment.findFirst({
      where: { orderId: order.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (!payment) throw new ConflictError("Không tìm thấy lượt thanh toán đang chờ của đơn này");

    await tx.payment.update({ where: { id: payment.id }, data: { status: "PAID", paidAt: new Date() } });

    const stillPending = order.status === "PENDING";
    const toStatus: OrderStatus = stillPending ? "CONFIRMED" : order.status;

    await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PAID", ...(stillPending ? { status: "CONFIRMED", confirmedAt: new Date() } : {}) },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus,
        changedBy: admin.userId,
        note: stillPending
          ? "Nhân viên xác nhận đã nhận được tiền chuyển khoản"
          : "Xác nhận đã nhận được tiền sau khi đơn đã đổi trạng thái khác — cần đối soát thêm",
      },
    });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "order.payment_confirmed",
      targetType: "Order",
      targetId: order.orderCode,
      metadata: { amount: Number(payment.amount) },
    });
  });

  return getOrderForAdmin(orderCode);
}

/** `GET /api/admin/orders/:code` — chi tiết đầy đủ cho trang quản trị */
export async function getOrderForAdmin(orderCode: string): Promise<AdminOrderDto> {
  const row = await prisma.order.findUnique({ where: { orderCode }, include: adminOrderInclude });
  if (!row) throw new NotFoundError("Không tìm thấy đơn hàng");
  return toAdminOrderDto(row);
}

/** `PATCH /api/admin/orders/:code/status` — chuyển "tiến" đúng MỘT bước theo `FORWARD_NEXT_STATUS`; CANCELLED/RETURNED có API riêng */
export async function advanceOrderStatus(
  orderCode: string,
  targetStatus: OrderStatus,
  note: string | undefined,
  admin: AdminActor,
): Promise<AdminOrderDto> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { orderCode } });
    if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");

    if (FORWARD_NEXT_STATUS[order.status] !== targetStatus) {
      throw new ConflictError(
        `Không thể chuyển đơn từ trạng thái hiện tại sang "${targetStatus}". Vòng đời đơn phải đi tuần tự từng bước.`,
      );
    }

    const now = new Date();
    const stageTimestamp: Prisma.OrderUpdateInput =
      targetStatus === "CONFIRMED"
        ? { confirmedAt: now }
        : targetStatus === "PACKING"
          ? { packedAt: now }
          : targetStatus === "SHIPPING"
            ? { shippedAt: now }
            : { deliveredAt: now }; // targetStatus chỉ còn DELIVERED — FORWARD_NEXT_STATUS đã chặn mọi giá trị khác ở trên

    await tx.order.update({ where: { id: order.id }, data: { status: targetStatus, ...stageTimestamp } });
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: targetStatus, changedBy: admin.userId, note },
    });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "order.status_advanced",
      targetType: "Order",
      targetId: order.orderCode,
      metadata: { from: order.status, to: targetStatus },
    });

  });

  return getOrderForAdmin(orderCode);
}

/**
 * Nhân viên huỷ đơn — rộng hơn khách tự huỷ (tới trước khi giao xong, không đòi hỏi chưa thanh toán).
 * Hoàn kho bằng `ADJUST` (đơn chưa từng tới tay khách) + hoàn lượt mã giảm giá nếu có — cùng logic với
 * `order.service.ts`'s `cancelOrder`. KHÔNG tự hoàn tiền dù đã thu — dùng `markOrderRefunded` riêng để
 * nhân viên tự xác nhận đã chuyển tiền lại, tránh giả vờ đã hoàn tiền khi chưa thực sự làm.
 */
export async function cancelOrderAsAdmin(orderCode: string, reason: string | undefined, admin: AdminActor): Promise<AdminOrderDto> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { orderCode }, include: { items: true } });
    if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
    if (!canAdminCancelOrder(order.status)) {
      throw new ConflictError("Đơn hàng ở trạng thái này không thể huỷ (đã giao, đã huỷ hoặc đã hoàn).");
    }

    for (const item of order.items) {
      if (!item.productId) continue;
      const updated = await tx.product.update({
        where: { id: item.productId },
        data: { inventoryQuantity: { increment: item.quantity }, soldCount: { decrement: item.quantity } },
      });
      await tx.inventoryTransaction.create({
        data: {
          productId: item.productId,
          type: "ADJUST",
          quantityChange: item.quantity,
          quantityAfter: updated.inventoryQuantity,
          orderId: order.id,
          note: `Hoàn kho do nhân viên huỷ đơn ${order.orderCode}`,
        },
      });
    }

    if (order.voucherId) {
      await tx.voucher.updateMany({
        where: { id: order.voucherId, usageCount: { gt: 0 } },
        data: { usageCount: { decrement: 1 } },
      });
      await tx.voucherRedemption.deleteMany({ where: { voucherId: order.voucherId, orderId: order.orderCode } });
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "CANCELLED",
        changedBy: admin.userId,
        note: reason || "Nhân viên huỷ đơn",
      },
    });
    await tx.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "order.cancelled",
      targetType: "Order",
      targetId: order.orderCode,
      metadata: { reason: reason ?? null, fromStatus: order.status },
    });

  });

  return getOrderForAdmin(orderCode);
}

/**
 * Khách trả hàng đã nhận (hoặc giao không thành công, hàng về kho) — chỉ áp dụng khi đơn thực sự đã gửi
 * đi. Hoàn kho bằng `RETURN` (khác `ADJUST` của huỷ đơn — đúng ý nghĩa enum có sẵn). KHÔNG hoàn lượt mã
 * giảm giá: đơn đã hoàn tất giao dịch, khách đã dùng mã, khác trường hợp huỷ khi đơn chưa từng thành công.
 */
export async function returnOrder(orderCode: string, reason: string | undefined, admin: AdminActor): Promise<AdminOrderDto> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { orderCode }, include: { items: true } });
    if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
    if (!canReturnOrder(order.status)) {
      throw new ConflictError("Chỉ xử lý hoàn hàng cho đơn đang giao hoặc đã giao.");
    }

    for (const item of order.items) {
      if (!item.productId) continue;
      const updated = await tx.product.update({
        where: { id: item.productId },
        data: { inventoryQuantity: { increment: item.quantity }, soldCount: { decrement: item.quantity } },
      });
      await tx.inventoryTransaction.create({
        data: {
          productId: item.productId,
          type: "RETURN",
          quantityChange: item.quantity,
          quantityAfter: updated.inventoryQuantity,
          orderId: order.id,
          note: `Khách trả hàng — đơn ${order.orderCode}`,
        },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: "RETURNED", returnedAt: new Date(), returnReason: reason },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "RETURNED",
        changedBy: admin.userId,
        note: reason || "Nhân viên xử lý hoàn hàng",
      },
    });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "order.returned",
      targetType: "Order",
      targetId: order.orderCode,
      metadata: { reason: reason ?? null, fromStatus: order.status },
    });

  });

  return getOrderForAdmin(orderCode);
}

/**
 * Đánh dấu THỦ CÔNG là đã hoàn tiền cho khách (chuyển khoản lại tay, không qua cổng thanh toán nào) —
 * chỉ ghi nhận bút toán, KHÔNG tự động chuyển tiền thật. Chỉ áp dụng khi đơn đã huỷ/hoàn VÀ đã từng thu
 * tiền thành công (PAID), tránh đánh dấu hoàn tiền cho đơn chưa từng nhận được tiền.
 */
export async function markOrderRefunded(orderCode: string, note: string | undefined, admin: AdminActor): Promise<AdminOrderDto> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { orderCode } });
    if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
    if (order.paymentStatus !== "PAID" || (order.status !== "CANCELLED" && order.status !== "RETURNED")) {
      throw new ConflictError("Chỉ đánh dấu hoàn tiền cho đơn đã huỷ hoặc đã hoàn, và đã từng thu tiền thành công.");
    }

    const payment = await tx.payment.findFirst({ where: { orderId: order.id, status: "PAID" }, orderBy: { paidAt: "desc" } });
    if (!payment) throw new ConflictError("Không tìm thấy lượt thanh toán đã thu tiền của đơn này");

    await tx.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED", refundedAt: new Date() } });
    await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "REFUNDED" } });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "order.marked_refunded",
      targetType: "Order",
      targetId: order.orderCode,
      metadata: { note: note ?? null, amount: Number(payment.amount) },
    });

  });

  return getOrderForAdmin(orderCode);
}

/** `PATCH /api/admin/orders/:code/tracking-number` — chuỗi rỗng để xoá mã vận đơn */
export async function updateOrderTrackingNumber(orderCode: string, trackingNumber: string, admin: AdminActor): Promise<AdminOrderDto> {
  const order = await prisma.order.findUnique({ where: { orderCode } });
  if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { trackingNumber: trackingNumber || null } });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "order.tracking_number_updated",
      targetType: "Order",
      targetId: order.orderCode,
      metadata: { trackingNumber: trackingNumber || null },
    });
  });

  return getOrderForAdmin(orderCode);
}

/** `PATCH /api/admin/orders/:code/internal-note` — chuỗi rỗng để xoá ghi chú */
export async function updateOrderInternalNote(orderCode: string, internalNote: string, admin: AdminActor): Promise<AdminOrderDto> {
  const order = await prisma.order.findUnique({ where: { orderCode } });
  if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { internalNote: internalNote || null } });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "order.internal_note_updated",
      targetType: "Order",
      targetId: order.orderCode,
    });
  });

  return getOrderForAdmin(orderCode);
}
