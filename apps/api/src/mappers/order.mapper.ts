import type { Order, OrderStatusHistory, Prisma } from "@pczone/db";
import { env } from "../env.js";
import { buildBankQrUrl, isBankTransferConfigured, isMomoConfigured } from "../services/manual-payment.service.js";
import type {
  AdminOrderSummaryDto,
  OrderDto,
  OrderItemDto,
  OrderStatusEventDto,
  OrderSummaryDto,
} from "../types/dto.js";

export const orderInclude = {
  items: { include: { product: { select: { slug: true } } }, orderBy: { createdAt: "asc" } },
  statusHistory: { orderBy: { createdAt: "asc" } },
  voucher: { select: { code: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function toNumber(value: Prisma.Decimal): number {
  return Number(value);
}

function toOrderItemDto(item: OrderWithRelations["items"][number]): OrderItemDto {
  return {
    id: item.id,
    // Sản phẩm còn tồn tại thì dẫn được sang trang chi tiết; bị xoá hẳn (product null) thì chỉ còn tên đã lưu
    productSlug: item.product?.slug,
    name: item.productName,
    image: item.productImage ?? undefined,
    unitPrice: toNumber(item.unitPrice),
    quantity: item.quantity,
    lineTotal: toNumber(item.lineTotal),
  };
}

function toStatusEventDto(event: OrderStatusHistory): OrderStatusEventDto {
  return {
    status: event.toStatus,
    note: event.note ?? undefined,
    createdAt: event.createdAt.toISOString(),
  };
}

/** Tự huỷ được khi chưa thanh toán (COD hoặc VNPay chưa trả tiền) và còn ở hai bước đầu, trước khi đóng gói */
function canCancelOrder(order: Pick<Order, "status" | "paymentStatus">): boolean {
  return (
    (order.status === "PENDING" || order.status === "CONFIRMED") && order.paymentStatus === "PENDING"
  );
}

/** VNPay chưa trả tiền thành công và đơn chưa bị huỷ thì còn thử thanh toán lại được */
function canRetryPaymentOf(order: Pick<Order, "status" | "paymentMethod" | "paymentStatus">): boolean {
  return (
    order.paymentMethod === "VNPAY" &&
    (order.paymentStatus === "PENDING" || order.paymentStatus === "FAILED") &&
    order.status !== "CANCELLED"
  );
}

/** Chỉ đơn BANK_TRANSFER/MOMO còn chờ thanh toán mới cần hiện lại hướng dẫn chuyển khoản */
function manualPaymentInfoOf(
  order: Pick<Order, "paymentMethod" | "paymentStatus" | "orderCode" | "totalAmount">,
): Pick<OrderDto, "bankTransfer" | "momo"> {
  if (order.paymentStatus !== "PENDING") return {};

  if (order.paymentMethod === "BANK_TRANSFER" && isBankTransferConfigured(env.bankTransfer)) {
    return {
      bankTransfer: {
        qrUrl: buildBankQrUrl(env.bankTransfer, { amount: toNumber(order.totalAmount), addInfo: order.orderCode }),
        bankName: env.bankTransfer.bankName,
        accountNumber: env.bankTransfer.accountNumber,
        accountName: env.bankTransfer.accountName,
      },
    };
  }

  if (order.paymentMethod === "MOMO" && isMomoConfigured(env.momo)) {
    return { momo: { phone: env.momo.phone, displayName: env.momo.displayName } };
  }

  return {};
}

export function toOrderDto(order: OrderWithRelations): OrderDto {
  return {
    orderCode: order.orderCode,
    status: order.status,
    subtotal: toNumber(order.subtotal),
    discountAmount: toNumber(order.discountAmount),
    voucherCode: order.voucher?.code,
    shippingFee: toNumber(order.shippingFee),
    totalAmount: toNumber(order.totalAmount),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    ...manualPaymentInfoOf(order),
    canRetryPayment: canRetryPaymentOf(order),
    canCancel: canCancelOrder(order),
    shippingAddress: {
      recipientName: order.recipientName,
      phone: order.recipientPhone,
      province: order.shippingProvince,
      district: order.shippingDistrict,
      ward: order.shippingWard,
      streetAddress: order.shippingAddress,
    },
    customerNote: order.customerNote ?? undefined,
    items: order.items.map(toOrderItemDto),
    statusHistory: order.statusHistory.map(toStatusEventDto),
    createdAt: order.createdAt.toISOString(),
  };
}

/**
 * Dòng gọn cho danh sách đơn hàng: lấy hết dòng hàng để tính đúng `itemCount` (tổng số lượng, giống cách
 * CartDto tính), nhưng chỉ hiện tối đa 4 ảnh đầu — số dòng của một đơn luôn nhỏ (trần giỏ hàng 50) nên không
 * cần aggregate riêng.
 */
export const orderSummaryInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    select: { productName: true, productImage: true, quantity: true },
  },
} satisfies Prisma.OrderInclude;

export type OrderSummaryRow = Prisma.OrderGetPayload<{ include: typeof orderSummaryInclude }>;

export function toOrderSummaryDto(order: OrderSummaryRow): OrderSummaryDto {
  return {
    orderCode: order.orderCode,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    totalAmount: toNumber(order.totalAmount),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    previewItems: order.items
      .slice(0, 4)
      .map((item) => ({ name: item.productName, image: item.productImage ?? undefined })),
    createdAt: order.createdAt.toISOString(),
  };
}

/** `GET /api/admin/orders` dùng chung include với danh sách đơn của khách, chỉ mapper khác (thêm người nhận) */
export function toAdminOrderSummaryDto(order: OrderSummaryRow): AdminOrderSummaryDto {
  return {
    orderCode: order.orderCode,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    totalAmount: toNumber(order.totalAmount),
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: order.createdAt.toISOString(),
  };
}
