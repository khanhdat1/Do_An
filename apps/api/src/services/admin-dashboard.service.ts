import { prisma, type OrderStatus } from "@pczone/db";
import { publicImages } from "../mappers/product.mapper.js";
import { orderSummaryInclude, toAdminOrderSummaryDto } from "../mappers/order.mapper.js";
import type { AdminDashboardSummaryDto, DashboardBestSellerDto, DashboardChartPointDto, DashboardGranularityDto } from "../types/dto.js";

const LOW_STOCK_LIMIT = 8;
const BEST_SELLER_LIMIT = 5;
const RECENT_ORDERS_LIMIT = 5;
/** "Đang chờ xử lý" = đặt xong nhưng chưa bắt đầu đóng gói — khớp README/spec, không phải mọi đơn chưa giao xong */
const PENDING_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Thứ Hai đầu tuần chứa `date` (giờ máy chủ — đủ dùng cho quy mô một cửa hàng, không cần xử lý múi giờ riêng) */
function mondayOf(date: Date): Date {
  const day = date.getDay(); // 0 = Chủ nhật
  const diff = day === 0 ? 6 : day - 1;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - diff);
}

/** Khoá bucket SẮP XẾP ĐƯỢC bằng so sánh chuỗi thường: "2026-09-23" / "2026-09-21" (thứ Hai) / "2026-09" / "2026" */
export function bucketKeyOf(date: Date, granularity: DashboardGranularityDto): string {
  switch (granularity) {
    case "day":
      return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    case "week": {
      const monday = mondayOf(date);
      return `${monday.getFullYear()}-${pad2(monday.getMonth() + 1)}-${pad2(monday.getDate())}`;
    }
    case "month":
      return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
    case "year":
      return String(date.getFullYear());
  }
}

/** Nhãn ngắn gọn hiện trên trục biểu đồ, dựng lại từ chính bucket key (không cần giữ Date gốc) */
export function bucketLabelOf(key: string, granularity: DashboardGranularityDto): string {
  const parts = key.split("-");
  switch (granularity) {
    case "day":
      return `${parts[2]}/${parts[1]}`;
    case "week":
      return `Tuần ${parts[2]}/${parts[1]}`;
    case "month":
      return `Th${Number(parts[1])}/${parts[0]}`;
    case "year":
      return key;
  }
}

/** Sinh đủ MỌI bucket trong [from, to], kể cả khi không phát sinh gì — biểu đồ không bị đứt đoạn giữa chừng */
export function generateBucketKeys(from: Date, to: Date, granularity: DashboardGranularityDto): string[] {
  const keys: string[] = [];

  if (granularity === "month") {
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= end) {
      keys.push(bucketKeyOf(cursor, "month"));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return keys;
  }

  if (granularity === "year") {
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) keys.push(String(y));
    return keys;
  }

  const stepDays = granularity === "week" ? 7 : 1;
  const cursor = granularity === "week" ? mondayOf(from) : new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cursor <= end) {
    keys.push(bucketKeyOf(cursor, granularity));
    cursor.setDate(cursor.getDate() + stepDays);
  }
  return keys;
}

/** Khoảng thời gian mặc định khi không truyền from/to — đủ dài để biểu đồ có ý nghĩa ở từng mức hiển thị */
export function defaultRangeFor(granularity: DashboardGranularityDto, now: Date = new Date()): { from: Date; to: Date } {
  const to = now;
  const from = new Date(now);
  if (granularity === "day") from.setDate(from.getDate() - 13); // 14 ngày gồm cả hôm nay
  else if (granularity === "week") from.setDate(from.getDate() - 7 * 7); // 8 tuần
  else if (granularity === "month") from.setMonth(from.getMonth() - 11); // 12 tháng
  else from.setFullYear(from.getFullYear() - 4); // 5 năm
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export interface DashboardRangeInput {
  from: Date;
  to: Date;
  granularity: DashboardGranularityDto;
}

export async function getDashboardSummary(input: DashboardRangeInput): Promise<AdminDashboardSummaryDto> {
  const { from, to, granularity } = input;

  const [orders, paidPayments, refundedPayments, totalCustomers, pendingOrderCount, lowStockRows, recentOrderRows, orderItemRows] =
    await Promise.all([
      prisma.order.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { totalAmount: true } }),
      prisma.payment.findMany({ where: { status: "PAID", paidAt: { gte: from, lte: to } }, select: { amount: true, paidAt: true } }),
      prisma.payment.findMany({ where: { status: "REFUNDED", refundedAt: { gte: from, lte: to } }, select: { amount: true, refundedAt: true } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.order.count({ where: { status: { in: PENDING_STATUSES } } }),
      prisma.product.findMany({
        where: { status: "ACTIVE", inventoryQuantity: { lte: prisma.product.fields.lowStockThreshold } },
        orderBy: { inventoryQuantity: "asc" },
        take: LOW_STOCK_LIMIT,
        select: { id: true, slug: true, name: true, inventoryQuantity: true, lowStockThreshold: true, images: { ...publicImages, take: 1 } },
      }),
      prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: RECENT_ORDERS_LIMIT, include: orderSummaryInclude }),
      prisma.orderItem.findMany({
        where: { order: { createdAt: { gte: from, lte: to }, status: { not: "CANCELLED" } } },
        select: {
          productId: true,
          quantity: true,
          productName: true,
          product: { select: { slug: true, images: { ...publicImages, take: 1 } } },
        },
      }),
    ]);

  const grossOrderValue = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
  const paidAmount = paidPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const refundedAmount = refundedPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);

  const productsSoldCount = orderItemRows.reduce((sum, item) => sum + item.quantity, 0);

  const bestSellerMap = new Map<string, DashboardBestSellerDto>();
  for (const item of orderItemRows) {
    // Sản phẩm đã bị xoá hẳn khỏi catalog không còn gì để dẫn link tới — vẫn tính vào productsSoldCount ở trên, chỉ bỏ khỏi bảng xếp hạng
    if (!item.productId) continue;
    const existing = bestSellerMap.get(item.productId);
    if (existing) {
      existing.quantitySold += item.quantity;
    } else {
      bestSellerMap.set(item.productId, {
        productId: item.productId,
        slug: item.product?.slug ?? "",
        name: item.productName,
        image: item.product?.images[0]?.url,
        quantitySold: item.quantity,
      });
    }
  }
  const bestSellers = [...bestSellerMap.values()].sort((a, b) => b.quantitySold - a.quantitySold).slice(0, BEST_SELLER_LIMIT);

  const chartMap = new Map<string, number>();
  for (const key of generateBucketKeys(from, to, granularity)) chartMap.set(key, 0);
  for (const payment of paidPayments) {
    const key = bucketKeyOf(payment.paidAt!, granularity);
    chartMap.set(key, (chartMap.get(key) ?? 0) + Number(payment.amount));
  }
  for (const payment of refundedPayments) {
    const key = bucketKeyOf(payment.refundedAt!, granularity);
    chartMap.set(key, (chartMap.get(key) ?? 0) - Number(payment.amount));
  }
  const chart: DashboardChartPointDto[] = [...chartMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, netRevenue]) => ({ bucket, label: bucketLabelOf(bucket, granularity), netRevenue }));

  return {
    range: { from: from.toISOString(), to: to.toISOString(), granularity },
    revenue: { grossOrderValue, paidAmount, refundedAmount, netRevenue: paidAmount - refundedAmount },
    orderCount: orders.length,
    productsSoldCount,
    totalCustomers,
    pendingOrderCount,
    chart,
    bestSellers,
    lowStock: lowStockRows.map((product) => ({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0]?.url,
      inventoryQuantity: product.inventoryQuantity,
      lowStockThreshold: product.lowStockThreshold,
    })),
    recentOrders: recentOrderRows.map(toAdminOrderSummaryDto),
  };
}
