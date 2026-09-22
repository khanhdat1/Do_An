import { ProductStatus, prisma, type Prisma } from "@pczone/db";
import { env } from "../env.js";
import { orderInclude, orderSummaryInclude, toOrderDto, toOrderSummaryDto } from "../mappers/order.mapper.js";
import { publicImages } from "../mappers/product.mapper.js";
import { ConflictError, NotFoundError } from "../middleware/errors.js";
import type { CreateOrderResultDto, OrderDto, Paginated, OrderSummaryDto } from "../types/dto.js";
import { generateOrderCode } from "../utils/order-code.js";
import { isUniqueViolation } from "../utils/prisma-errors.js";
import { calcShippingFee } from "../utils/shipping.js";
import { createAddress, type AddressInput } from "./address.service.js";
import { isBankTransferConfigured, isMomoConfigured } from "./manual-payment.service.js";
import { buildPaymentUrl, isVnpayConfigured, type VerifiedCallback } from "./vnpay.service.js";
import { redeemVoucher, validateVoucherForOrder } from "./voucher.service.js";

/** Số lần thử lại khi hai đơn cùng sinh trùng `orderCode` (cực hiếm — mã sinh theo số đơn trong ngày) */
const ORDER_CODE_RETRY = 5;

export interface CreateOrderInput {
  userId: string;
  /** Dùng một địa chỉ đã lưu — không kèm `newAddress` */
  addressId?: string;
  /** Nhập địa chỉ mới ngay lúc đặt hàng — địa chỉ này được lưu luôn vào sổ địa chỉ */
  newAddress?: AddressInput & { saveAsDefault?: boolean };
  paymentMethod: "COD" | "VNPAY" | "MOMO" | "BANK_TRANSFER";
  customerNote?: string;
  /** Mã giảm giá công khai, không bắt buộc */
  voucherCode?: string;
  /** IP khách — chỉ VNPay cần, để ghi vnp_IpAddr */
  ip: string;
}

type ShippingSnapshot = {
  recipientName: string;
  recipientPhone: string;
  shippingProvince: string;
  shippingDistrict: string;
  shippingWard: string;
  shippingAddress: string;
};

async function resolveShippingSnapshot(
  tx: Prisma.TransactionClient,
  input: CreateOrderInput,
): Promise<ShippingSnapshot> {
  if (input.addressId) {
    const address = await tx.address.findFirst({ where: { id: input.addressId, userId: input.userId } });
    if (!address) throw new NotFoundError("Không tìm thấy địa chỉ giao hàng");
    return {
      recipientName: address.recipientName,
      recipientPhone: address.phone,
      shippingProvince: address.province,
      shippingDistrict: address.district,
      shippingWard: address.ward,
      shippingAddress: address.streetAddress,
    };
  }

  if (input.newAddress) {
    // Tách saveAsDefault ra trước: input.newAddress không phải object literal nên TypeScript không tự
    // chặn field thừa lọt qua createAddress rồi rơi thẳng vào Prisma (Address không có cột này)
    const { saveAsDefault, ...addressFields } = input.newAddress;
    const saved = await createAddress(tx, input.userId, addressFields, saveAsDefault);
    return {
      recipientName: saved.recipientName,
      recipientPhone: saved.phone,
      shippingProvince: saved.province,
      shippingDistrict: saved.district,
      shippingWard: saved.ward,
      shippingAddress: saved.streetAddress,
    };
  }

  throw new ConflictError("Thiếu địa chỉ giao hàng");
}

/**
 * Tạo đơn: kiểm tra lại tồn kho ngay tại thời điểm đặt (giỏ hàng có thể đã cũ), trừ kho, ghi sổ kho, snapshot
 * địa chỉ + từng dòng hàng, dọn giỏ — tất cả trong MỘT transaction để không bao giờ có nửa đơn (csdl.md mục 9).
 * Trả về id đơn vừa tạo và payUrl (nếu là VNPay) để hàm gọi bên ngoài đọc lại đầy đủ bằng include.
 */
async function runCreateOrder(input: CreateOrderInput): Promise<{ orderId: string; payUrl?: string }> {
  return prisma.$transaction(async (tx) => {
    const shipping = await resolveShippingSnapshot(tx, input);

    const cart = await tx.cart.findUnique({
      where: { userId: input.userId },
      include: { items: { include: { product: { include: { images: { ...publicImages, take: 1 } } } } } },
    });
    if (!cart || cart.items.length === 0) throw new ConflictError("Giỏ hàng đang trống");

    for (const item of cart.items) {
      const available = item.product.inventoryQuantity - item.product.reservedQuantity;
      if (item.product.status !== ProductStatus.ACTIVE || available < item.quantity) {
        throw new ConflictError(
          `"${item.product.name}" không còn đủ số lượng. Vui lòng quay lại giỏ hàng để kiểm tra.`,
        );
      }
    }

    const subtotal = cart.items.reduce(
      (sum, item) => sum + Number(item.product.sellingPrice) * item.quantity,
      0,
    );

    // Kiểm tra lại mã NGAY TRONG transaction dù trang web đã gọi /preview trước đó — cùng lý do
    // "giỏ hàng có thể đã cũ" đang áp dụng cho tồn kho: mã có thể vừa hết lượt giữa lúc preview và lúc
    // bấm Đặt hàng. Phí vận chuyển luôn tính trên subtotal TRƯỚC giảm giá.
    const voucherResult = input.voucherCode
      ? await validateVoucherForOrder(tx, { code: input.voucherCode, subtotal, userId: input.userId })
      : null;
    const discountAmount = voucherResult?.discountAmount ?? 0;
    const shippingFee = calcShippingFee(subtotal);
    const totalAmount = subtotal - discountAmount + shippingFee;

    let order: { id: string; orderCode: string } | undefined;
    for (let attempt = 0; attempt < ORDER_CODE_RETRY; attempt++) {
      const orderCode = await generateOrderCode(tx, attempt);
      try {
        order = await tx.order.create({
          data: {
            orderCode,
            userId: input.userId,
            subtotal,
            discountAmount,
            voucherId: voucherResult?.voucher.id,
            shippingFee,
            totalAmount,
            paymentMethod: input.paymentMethod,
            customerNote: input.customerNote,
            ...shipping,
          },
        });
        break;
      } catch (error) {
        if (isUniqueViolation(error) && attempt < ORDER_CODE_RETRY - 1) continue;
        throw error;
      }
    }
    if (!order) throw new Error("Không sinh được mã đơn hàng"); // không thể tới đây: vòng lặp trên throw hoặc break

    if (voucherResult) {
      await redeemVoucher(tx, {
        voucher: voucherResult.voucher,
        userId: input.userId,
        orderCode: order.orderCode,
        discountAmount,
      });
    }

    for (const item of cart.items) {
      // Điều kiện tồn kho nằm ngay trong WHERE: hai request cùng mua nốt sản phẩm cuối không thể cùng thành công
      const updated = await tx.product.updateMany({
        where: { id: item.productId, inventoryQuantity: { gte: item.quantity } },
        data: { inventoryQuantity: { decrement: item.quantity }, soldCount: { increment: item.quantity } },
      });
      if (updated.count === 0) {
        throw new ConflictError(`"${item.product.name}" vừa hết hàng. Vui lòng quay lại giỏ hàng để kiểm tra.`);
      }

      const fresh = await tx.product.findUniqueOrThrow({
        where: { id: item.productId },
        select: { inventoryQuantity: true },
      });

      await tx.inventoryTransaction.create({
        data: {
          productId: item.productId,
          type: "EXPORT",
          quantityChange: -item.quantity,
          quantityAfter: fresh.inventoryQuantity,
          orderId: order.id,
          note: `Xuất kho theo đơn ${order.orderCode}`,
        },
      });

      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          productName: item.product.name,
          productSku: item.product.sku,
          productImage: item.product.images[0]?.url,
          unitPrice: item.product.sellingPrice,
          quantity: item.quantity,
          lineTotal: Number(item.product.sellingPrice) * item.quantity,
        },
      });
    }

    await tx.orderStatusHistory.create({
      data: { orderId: order.id, toStatus: "PENDING", note: "Tạo đơn hàng" },
    });

    const payment = await tx.payment.create({
      data: { orderId: order.id, method: input.paymentMethod, amount: totalAmount },
    });

    let payUrl: string | undefined;
    if (input.paymentMethod === "VNPAY") {
      payUrl = buildPaymentUrl(env.vnpay, {
        paymentId: payment.id,
        amount: totalAmount,
        orderCode: order.orderCode,
        ip: input.ip,
      });
      await tx.payment.update({ where: { id: payment.id }, data: { payUrl } });
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return { orderId: order.id, payUrl };
  });
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResultDto> {
  if (input.paymentMethod === "VNPAY" && !isVnpayConfigured(env.vnpay)) {
    throw new ConflictError("VNPay chưa được cấu hình. Vui lòng chọn Thanh toán khi nhận hàng (COD).");
  }
  if (input.paymentMethod === "BANK_TRANSFER" && !isBankTransferConfigured(env.bankTransfer)) {
    throw new ConflictError("Chuyển khoản ngân hàng chưa được cấu hình. Vui lòng chọn phương thức khác.");
  }
  if (input.paymentMethod === "MOMO" && !isMomoConfigured(env.momo)) {
    throw new ConflictError("Thanh toán MoMo chưa được cấu hình. Vui lòng chọn phương thức khác.");
  }

  const { orderId, payUrl } = await runCreateOrder(input);
  const row = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  return { order: toOrderDto(row), payUrl };
}

export async function listOrders(userId: string, page: number, pageSize: number): Promise<Paginated<OrderSummaryDto>> {
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      include: orderSummaryInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where: { userId } }),
  ]);

  return {
    items: rows.map(toOrderSummaryDto),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getOrderByCode(userId: string, orderCode: string): Promise<OrderDto> {
  const row = await prisma.order.findFirst({ where: { orderCode, userId }, include: orderInclude });
  if (!row) throw new NotFoundError("Không tìm thấy đơn hàng");
  return toOrderDto(row);
}

/** Tra cứu công khai không cần đăng nhập: phải khớp CẢ mã đơn LẪN số điện thoại nhận hàng mới xem được */
export async function lookupGuestOrder(orderCode: string, phone: string): Promise<OrderDto | null> {
  const row = await prisma.order.findFirst({ where: { orderCode, recipientPhone: phone }, include: orderInclude });
  return row ? toOrderDto(row) : null;
}

/**
 * Khách tự huỷ đơn: chỉ cho phép khi CHƯA thanh toán (COD, hoặc VNPay chưa trả tiền) và còn ở hai bước đầu
 * (chưa đóng gói) — đơn đã thanh toán hoặc đang giao thì phải liên hệ hotline, tránh vòng hoàn tiền tự động
 * chưa xây dựng. Hoàn kho bằng `ADJUST` (đơn chưa từng xuất kho thật sự tới tay khách, khác `RETURN` — dành
 * cho khách trả hàng đã nhận).
 */
export async function cancelOrder(userId: string, orderCode: string, reason: string | undefined): Promise<OrderDto> {
  const orderId = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { orderCode, userId }, include: { items: true } });
    if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");

    const cancellable =
      (order.status === "PENDING" || order.status === "CONFIRMED") && order.paymentStatus === "PENDING";
    if (!cancellable) {
      throw new ConflictError("Đơn hàng này không thể tự huỷ. Vui lòng liên hệ hotline nếu cần hỗ trợ.");
    }

    for (const item of order.items) {
      // Dòng hàng của sản phẩm đã bị xoá hẳn khỏi catalog thì không còn gì để hoàn kho
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
          note: `Hoàn kho do huỷ đơn ${order.orderCode}`,
        },
      });
    }

    // Hoàn lại lượt mã giảm giá — cùng nguyên tắc với hoàn kho: đơn huỷ thì mọi thứ đã trừ lúc tạo đơn
    // phải trả lại, kẻo mã coi như đã dùng dù đơn chưa từng thành công
    if (order.voucherId) {
      await tx.voucher.updateMany({
        where: { id: order.voucherId, usageCount: { gt: 0 } },
        data: { usageCount: { decrement: 1 } },
      });
      await tx.voucherRedemption.deleteMany({
        where: { voucherId: order.voucherId, userId, orderId: order.orderCode },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
    });
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: "CANCELLED", note: reason || "Khách tự huỷ đơn" },
    });
    // Lượt thử VNPay còn treo (khách bấm huỷ trong lúc đang ở trang VNPay) không còn ý nghĩa
    await tx.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "CANCELLED" } });

    return order.id;
  });

  const row = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  return toOrderDto(row);
}

/** Tạo một LƯỢT THỬ thanh toán VNPay mới cho đơn đã có (chưa trả tiền thành công) — dùng cho nút "Thanh toán lại" */
export async function retryVnpayPayment(userId: string, orderCode: string, ip: string): Promise<CreateOrderResultDto & { payUrl: string }> {
  if (!isVnpayConfigured(env.vnpay)) throw new ConflictError("VNPay chưa được cấu hình");

  const order = await prisma.order.findFirst({ where: { orderCode, userId } });
  if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");

  const retryable =
    order.paymentMethod === "VNPAY" &&
    order.status !== "CANCELLED" &&
    (order.paymentStatus === "PENDING" || order.paymentStatus === "FAILED");
  if (!retryable) throw new ConflictError("Đơn hàng này không thể thanh toán lại");

  const payment = await prisma.payment.create({
    data: { orderId: order.id, method: "VNPAY", amount: order.totalAmount },
  });
  const payUrl = buildPaymentUrl(env.vnpay, {
    paymentId: payment.id,
    amount: Number(order.totalAmount),
    orderCode: order.orderCode,
    ip,
  });
  await prisma.payment.update({ where: { id: payment.id }, data: { payUrl } });

  const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  return { order: toOrderDto(row), payUrl };
}

export type ApplyVnpayResult =
  | { kind: "not_found" }
  | { kind: "amount_mismatch"; order: OrderDto }
  | { kind: "already_processed"; order: OrderDto; success: boolean }
  | { kind: "applied"; order: OrderDto; success: boolean };

/**
 * Ghi nhận kết quả VNPay gửi về (return hoặc IPN — dùng chung một hàm, xem `payments.routes.ts`). Idempotent:
 * một `Payment` chỉ áp dụng đúng một lần (`status` khỏi PENDING là coi như xong), vì VNPay có thể gọi IPN nhiều
 * lần hoặc cả return lẫn IPN cùng tới đích.
 */
export async function applyVnpayCallback(callback: VerifiedCallback): Promise<ApplyVnpayResult> {
  if (!callback.paymentId) return { kind: "not_found" };

  const payment = await prisma.payment.findUnique({ where: { id: callback.paymentId } });
  if (!payment) return { kind: "not_found" };

  if (payment.status !== "PENDING") {
    const row = await prisma.order.findUniqueOrThrow({ where: { id: payment.orderId }, include: orderInclude });
    return { kind: "already_processed", order: toOrderDto(row), success: payment.status === "PAID" };
  }

  // Số tiền lệch với lượt thử đã tạo: không tin dữ liệu này, không đổi trạng thái thành công
  if (callback.amount !== undefined && Math.round(callback.amount) !== Math.round(Number(payment.amount))) {
    const row = await prisma.order.findUniqueOrThrow({ where: { id: payment.orderId }, include: orderInclude });
    return { kind: "amount_mismatch", order: toOrderDto(row) };
  }

  const orderId = payment.orderId;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: callback.success ? "PAID" : "FAILED",
        transactionNo: callback.transactionNo,
        bankCode: callback.bankCode,
        responseCode: callback.responseCode,
        gatewayData: callback.raw,
        paidAt: callback.success ? new Date() : undefined,
      },
    });

    if (callback.success) {
      const before = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      // Bình thường đơn còn PENDING chờ thanh toán; nếu khách đã tự huỷ đúng lúc IPN tới muộn thì
      // vẫn ghi nhận đã nhận được tiền nhưng KHÔNG hồi sinh đơn đã huỷ — để lại dấu vết cho việc đối soát thủ công.
      const stillPending = before.status === "PENDING";

      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: "PAID", ...(stillPending ? { status: "CONFIRMED", confirmedAt: new Date() } : {}) },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: before.status,
          toStatus: stillPending ? "CONFIRMED" : before.status,
          note: stillPending
            ? "Thanh toán VNPay thành công"
            : "Nhận được thanh toán VNPay sau khi đơn đã đổi trạng thái — cần đối soát thủ công",
        },
      });
    }
    // Thất bại: KHÔNG đổi Order.status/paymentStatus — đơn vẫn PENDING để khách thử thanh toán lại
  });

  const row = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  return { kind: "applied", order: toOrderDto(row), success: callback.success };
}
