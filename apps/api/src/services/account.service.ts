import { prisma, type OrderStatus } from "@pczone/db";
import { orderSummaryInclude, toOrderSummaryDto } from "../mappers/order.mapper.js";
import type { AccountSummaryDto, OrderGroupDto } from "../types/dto.js";

/** Nhóm trạng thái dùng chung cho thẻ số liệu ở trang Tài khoản và bộ lọc danh sách đơn */
export const ORDER_GROUP_STATUSES: Record<OrderGroupDto, OrderStatus[]> = {
  processing: ["PENDING", "CONFIRMED", "PACKING", "SHIPPING"],
  delivered: ["DELIVERED"],
  cancelled: ["CANCELLED", "RETURNED"],
};

const RECENT_ORDER_COUNT = 3;

/**
 * `GET /api/account/summary` — số liệu THẬT của chính tài khoản đang đăng nhập cho bảng điều khiển trang Tài khoản.
 * "Tổng chi tiêu" chỉ cộng đơn `paymentStatus = PAID` (đơn đã hoàn tiền chuyển sang REFUNDED nên tự động không tính) —
 * đúng cách trang quản trị khách hàng đang tính, để hai nơi không bao giờ lệch nhau.
 */
export async function getAccountSummary(userId: string): Promise<AccountSummaryDto> {
  const [byStatus, spent, wishlistCount, savedBuildCount, recent] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { userId, paymentStatus: "PAID" }, _sum: { totalAmount: true } }),
    prisma.wishlistItem.count({ where: { userId } }),
    // Cùng điều kiện với trang "Cấu hình của tôi" (listMyBuilds): chỉ cấu hình có link ngắn
    prisma.pcBuild.count({ where: { userId, shareCode: { not: null } } }),
    prisma.order.findMany({
      where: { userId },
      include: orderSummaryInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: RECENT_ORDER_COUNT,
    }),
  ]);

  const countOf = (statuses: OrderStatus[]) =>
    byStatus.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + row._count._all, 0);

  return {
    orders: {
      total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
      processing: countOf(ORDER_GROUP_STATUSES.processing),
      delivered: countOf(ORDER_GROUP_STATUSES.delivered),
      cancelled: countOf(ORDER_GROUP_STATUSES.cancelled),
    },
    totalSpent: Number(spent._sum.totalAmount ?? 0),
    wishlistCount,
    savedBuildCount,
    recentOrders: recent.map(toOrderSummaryDto),
  };
}
