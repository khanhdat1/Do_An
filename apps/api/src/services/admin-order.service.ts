import { prisma, type OrderStatus, type PaymentMethod, type PaymentStatus } from "@pczone/db";
import { orderInclude, orderSummaryInclude, toAdminOrderSummaryDto, toOrderDto } from "../mappers/order.mapper.js";
import { ConflictError, NotFoundError } from "../middleware/errors.js";
import type { AdminOrderSummaryDto, OrderDto, Paginated } from "../types/dto.js";

export interface AdminOrderFilters {
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
}

/** `GET /api/admin/orders` — mặc định liệt kê TẤT CẢ đơn, mới nhất trước; lọc thêm qua query nếu có */
export async function listOrdersForAdmin(
  filters: AdminOrderFilters,
  page: number,
  pageSize: number,
): Promise<Paginated<AdminOrderSummaryDto>> {
  const where = { paymentStatus: filters.paymentStatus, paymentMethod: filters.paymentMethod };

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
export async function confirmOrderPayment(orderCode: string, adminUserId: string): Promise<OrderDto> {
  const orderId = await prisma.$transaction(async (tx) => {
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
        changedBy: adminUserId,
        note: stillPending
          ? "Nhân viên xác nhận đã nhận được tiền chuyển khoản"
          : "Xác nhận đã nhận được tiền sau khi đơn đã đổi trạng thái khác — cần đối soát thêm",
      },
    });

    return order.id;
  });

  const row = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  return toOrderDto(row);
}
