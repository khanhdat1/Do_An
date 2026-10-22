import { ProductStatus, prisma, type Prisma } from "@pczone/db";
import { env } from "../env.js";
import { orderInclude, orderSummaryInclude, toOrderDto, toOrderSummaryDto } from "../mappers/order.mapper.js";
import { publicImages } from "../mappers/product.mapper.js";
import { ConflictError, NotFoundError } from "../middleware/errors.js";
import type { CreateOrderResultDto, OrderDto, OrderGroupDto, Paginated, OrderSummaryDto, ShippingSettingsDto } from "../types/dto.js";
import { MAX_QUANTITY_PER_LINE } from "../utils/limits.js";
import { generateOrderCode } from "../utils/order-code.js";
import { isUniqueViolation, retryOnTransactionConflict } from "../utils/prisma-errors.js";
import { calcShippingFee } from "../utils/shipping.js";
import { ORDER_GROUP_STATUSES } from "./account.service.js";
import { createAddress, type AddressInput } from "./address.service.js";
import { isBankTransferConfigured, isMomoConfigured } from "./manual-payment.service.js";
import { cancelOrderInTx, claimOrderTransition, ORDER_CHANGED_MESSAGE } from "./order-cancellation.service.js";
import { assertPaymentMethodEnabled, getSettings } from "./settings.service.js";
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
 * `shippingConfig` = phí/ngưỡng HIỆN HÀNH trong cài đặt hệ thống, `createOrder` đọc ngay trước khi gọi.
 */
async function runCreateOrder(input: CreateOrderInput, shippingConfig: ShippingSettingsDto): Promise<{ orderId: string; payUrl?: string }> {
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
      // Giỏ hàng đã chặn trần này, kiểm lại ở đây để mọi đơn đều chắc chắn tuân theo
      if (item.quantity > MAX_QUANTITY_PER_LINE) {
        throw new ConflictError(
          `"${item.product.name}": mỗi sản phẩm chỉ được mua tối đa ${MAX_QUANTITY_PER_LINE} cái mỗi đơn`,
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
    const shippingFee = calcShippingFee(subtotal, shippingConfig);
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

  // Đã cấu hình nhưng chủ website đang TẮT ở /admin/settings: chặn ở server (400), không chỉ dựa vào việc trang
  // đặt hàng đã ẩn phương thức — request gửi thẳng tới API vẫn bị từ chối
  const settings = await getSettings();
  assertPaymentMethodEnabled(settings.payments, input.paymentMethod);

  // Nhiều khách đặt cùng lúc có thể cùng sinh một `orderCode` (mã theo số đơn trong ngày) → InnoDB báo deadlock (P2034)
  // và huỷ cả transaction. Chạy lại từ đầu: lượt sau đọc lại giỏ + tồn kho, ai hết hàng sẽ nhận 409 như thiết kế thay vì 500
  const { orderId, payUrl } = await retryOnTransactionConflict(() => runCreateOrder(input, settings.shipping));
  const row = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  return { order: toOrderDto(row), payUrl };
}

export async function listOrders(userId: string, page: number, pageSize: number, group?: OrderGroupDto): Promise<Paginated<OrderSummaryDto>> {
  const where = { userId, ...(group ? { status: { in: ORDER_GROUP_STATUSES[group] } } : {}) } satisfies Prisma.OrderWhereInput;
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: orderSummaryInclude,
      // Tie-break theo id để hai đơn cùng thời điểm không lặp/mất giữa các trang
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
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
  const orderId = await retryOnTransactionConflict(() =>
    prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { orderCode, userId }, include: { items: true } });
      if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");

      const cancellable =
        (order.status === "PENDING" || order.status === "CONFIRMED") && order.paymentStatus === "PENDING";
      if (!cancellable) {
        throw new ConflictError("Đơn hàng này không thể tự huỷ. Vui lòng liên hệ hotline nếu cần hỗ trợ.");
      }

      // Bước kiểm tra trên đọc không khoá dòng: hai lượt bấm huỷ cùng lúc đều qua được — `cancelOrderInTx` giành đơn
      // bằng cập nhật có điều kiện, lượt sau nhận 409 thay vì hoàn kho/hoàn mã lần hai
      const cancelled = await cancelOrderInTx(tx, order, {
        reason,
        historyNote: reason || "Khách tự huỷ đơn",
        stockNote: `Hoàn kho do huỷ đơn ${order.orderCode}`,
        requireUnpaid: true,
      });
      if (!cancelled) throw new ConflictError(ORDER_CHANGED_MESSAGE);

      return order.id;
    }),
  );

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
 * Ghi nhận tiền VNPay đã về cho đơn, trong transaction của `applyVnpayCallback` (lượt thanh toán đã được giành xong).
 *
 * Đơn còn chờ thì xác nhận luôn — bằng cập nhật CÓ ĐIỀU KIỆN (`claimOrderTransition`, đơn vẫn PENDING + chưa thanh
 * toán), không đọc rồi ghi đè: khách tự huỷ / nhân viên huỷ / hệ thống tự huỷ đơn quá hạn đúng lúc IPN tới thì InnoDB bắt
 * lượt này chờ lượt huỷ xong rồi kiểm lại điều kiện trên bản mới nhất → không khớp, đơn đã huỷ (kho đã hoàn) KHÔNG bị hồi
 * sinh thành CONFIRMED. Không giành được (đơn vừa bị huỷ, hoặc đã được xác nhận qua một lượt thanh toán khác) thì tiền
 * vẫn đã thật sự bị trừ của khách: ghi nhận đã có tiền (trang quản trị hiện "Đánh dấu đã hoàn tiền") nhưng giữ nguyên
 * trạng thái đơn, lịch sử ghi "cần đối soát".
 */
export async function recordVnpayPaid(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  const now = new Date();
  const confirmed = await claimOrderTransition(
    tx,
    { id: orderId, status: "PENDING" },
    { status: "CONFIRMED", confirmedAt: now, paymentStatus: "PAID" },
    { paymentStatus: "PENDING" },
  );
  if (confirmed) {
    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: "PENDING", toStatus: "CONFIRMED", note: "Thanh toán VNPay thành công" },
    });
    return;
  }

  await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID" } });
  // Đọc SAU khi chính transaction này vừa ghi dòng đơn: InnoDB trả bản mới nhất của dòng mình đã ghi (gồm trạng thái
  // lượt huỷ vừa commit), không phải ảnh chụp cũ từ đầu transaction
  const { status } = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } });
  await tx.orderStatusHistory.create({
    data: {
      orderId,
      fromStatus: status,
      toStatus: status,
      note: "Nhận được thanh toán VNPay sau khi đơn đã đổi trạng thái — cần đối soát thủ công",
    },
  });
}

/**
 * Ghi nhận kết quả VNPay gửi về (return hoặc IPN — dùng chung một hàm, xem `payments.routes.ts`). Idempotent:
 * một `Payment` chỉ áp dụng đúng một lần (`status` khỏi PENDING là coi như xong), vì VNPay có thể gọi IPN nhiều
 * lần hoặc cả return lẫn IPN cùng tới đích — kể cả ĐÚNG CÙNG LÚC: lượt thanh toán được giành bằng cập nhật có điều
 * kiện `status = PENDING`, lượt tới sau thấy count = 0 và trả `already_processed`, không ghi lịch sử hai lần.
 */
export async function applyVnpayCallback(callback: VerifiedCallback): Promise<ApplyVnpayResult> {
  if (!callback.paymentId) return { kind: "not_found" };

  const payment = await prisma.payment.findUnique({ where: { id: callback.paymentId } });
  if (!payment) return { kind: "not_found" };

  const orderId = payment.orderId;
  const alreadyProcessed = async (): Promise<ApplyVnpayResult> => {
    const [latest, row] = await Promise.all([
      prisma.payment.findUniqueOrThrow({ where: { id: payment.id }, select: { status: true } }),
      prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude }),
    ]);
    return { kind: "already_processed", order: toOrderDto(row), success: latest.status === "PAID" };
  };

  if (payment.status !== "PENDING") return alreadyProcessed();

  // Số tiền lệch với lượt thử đã tạo: không tin dữ liệu này, không đổi trạng thái thành công
  if (callback.amount !== undefined && Math.round(callback.amount) !== Math.round(Number(payment.amount))) {
    const row = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
    return { kind: "amount_mismatch", order: toOrderDto(row) };
  }

  const applied = await retryOnTransactionConflict(() =>
    prisma.$transaction(async (tx) => {
      const { count } = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: {
          status: callback.success ? "PAID" : "FAILED",
          transactionNo: callback.transactionNo,
          bankCode: callback.bankCode,
          responseCode: callback.responseCode,
          gatewayData: callback.raw,
          paidAt: callback.success ? new Date() : undefined,
        },
      });
      if (count === 0) return false; // một callback khác của cùng lượt thanh toán vừa xử lý xong

      if (callback.success) await recordVnpayPaid(tx, orderId);
      // Thất bại: KHÔNG đổi Order.status/paymentStatus — đơn vẫn PENDING để khách thử thanh toán lại
      return true;
    }),
  );
  if (!applied) return alreadyProcessed();

  const row = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  return { kind: "applied", order: toOrderDto(row), success: callback.success };
}
