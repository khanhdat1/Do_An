import type { Order, OrderStatus, OrderStatusHistory, Prisma } from "@pczone/db";
import { env } from "../env.js";
import { buildBankQrUrl, isBankTransferConfigured, isMomoConfigured } from "../services/manual-payment.service.js";
import type {
  AdminOrderDto,
  AdminOrderSummaryDto,
  AdminPaymentRecordDto,
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

/**
 * Chỉ đơn BANK_TRANSFER/MOMO còn thật sự chờ thanh toán mới cần hiện lại hướng dẫn chuyển khoản —
 * `paymentStatus` một mình không đủ: đơn tự huỷ vẫn giữ nguyên `paymentStatus: PENDING` (chưa từng
 * trả tiền thành công) nên phải loại thêm cả CANCELLED, kẻo khách xem đơn đã huỷ vẫn thấy "hãy chuyển
 * khoản số tiền này".
 */
function manualPaymentInfoOf(
  order: Pick<Order, "status" | "paymentMethod" | "paymentStatus" | "orderCode" | "totalAmount">,
): Pick<OrderDto, "bankTransfer" | "momo"> {
  if (order.paymentStatus !== "PENDING" || order.status === "CANCELLED") return {};

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

/**
 * `historyMapper` mặc định bỏ qua tên người đổi trạng thái (khách hàng không cần biết nhân viên nào) —
 * `toAdminOrderDto` bên dưới truyền `toAdminStatusEventDto` để có thêm `changedByName`.
 */
export function toOrderDto(
  order: OrderWithRelations,
  historyMapper: (event: OrderWithRelations["statusHistory"][number]) => OrderStatusEventDto = toStatusEventDto,
): OrderDto {
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
    statusHistory: order.statusHistory.map(historyMapper),
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

/** Trạng thái kế tiếp khi chuyển "tiến" một bước bình thường — KHÔNG gồm CANCELLED/RETURNED (có API riêng, kèm hoàn kho + lý do) */
export const FORWARD_NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PACKING",
  PACKING: "SHIPPING",
  SHIPPING: "DELIVERED",
};

/** Nhân viên huỷ được rộng hơn khách tự huỷ: tới trước khi giao xong, không đòi hỏi chưa thanh toán */
export function canAdminCancelOrder(status: OrderStatus): boolean {
  return status === "PENDING" || status === "CONFIRMED" || status === "PACKING" || status === "SHIPPING";
}

/** Chỉ xử lý "hoàn hàng" khi đơn thực sự đã được gửi đi */
export function canReturnOrder(status: OrderStatus): boolean {
  return status === "SHIPPING" || status === "DELIVERED";
}

/** GET /api/admin/orders/:code — thêm changedByUser (tên nhân viên) vào lịch sử và toàn bộ lượt thanh toán */
export const adminOrderInclude = {
  items: { include: { product: { select: { slug: true } } }, orderBy: { createdAt: "asc" } },
  statusHistory: {
    include: { changedByUser: { select: { fullName: true } } },
    orderBy: { createdAt: "asc" },
  },
  payments: { orderBy: { createdAt: "asc" } },
  voucher: { select: { code: true } },
} satisfies Prisma.OrderInclude;

export type AdminOrderWithRelations = Prisma.OrderGetPayload<{ include: typeof adminOrderInclude }>;

/**
 * `changedByUser` khai báo OPTIONAL (không lấy thẳng từ `AdminOrderWithRelations`) để kiểu tham số này
 * tương thích ngược với `toOrderDto`'s `historyMapper` (nhận dòng KHÔNG có include quan hệ này) — nếu
 * bắt buộc có, TypeScript coi hai kiểu hàm nghịch biến và báo lỗi không gán được.
 */
function toAdminStatusEventDto(
  event: OrderWithRelations["statusHistory"][number] & { changedByUser?: { fullName: string } | null },
): OrderStatusEventDto {
  return {
    status: event.toStatus,
    note: event.note ?? undefined,
    changedByName: event.changedByUser?.fullName,
    createdAt: event.createdAt.toISOString(),
  };
}

function toAdminPaymentRecordDto(payment: AdminOrderWithRelations["payments"][number]): AdminPaymentRecordDto {
  return {
    id: payment.id,
    method: payment.method,
    status: payment.status,
    amount: toNumber(payment.amount),
    transactionNo: payment.transactionNo ?? undefined,
    paidAt: payment.paidAt?.toISOString(),
    refundedAt: payment.refundedAt?.toISOString(),
    createdAt: payment.createdAt.toISOString(),
  };
}

export function toAdminOrderDto(order: AdminOrderWithRelations): AdminOrderDto {
  const base = toOrderDto(order, toAdminStatusEventDto);
  const nextStatus = FORWARD_NEXT_STATUS[order.status];

  return {
    ...base,
    trackingNumber: order.trackingNumber ?? undefined,
    internalNote: order.internalNote ?? undefined,
    cancelReason: order.cancelReason ?? undefined,
    returnReason: order.returnReason ?? undefined,
    payments: order.payments.map(toAdminPaymentRecordDto),
    nextStatuses: nextStatus ? [nextStatus] : [],
    canAdminCancel: canAdminCancelOrder(order.status),
    canReturn: canReturnOrder(order.status),
    canMarkRefunded: order.paymentStatus === "PAID" && (order.status === "CANCELLED" || order.status === "RETURNED"),
  };
}
