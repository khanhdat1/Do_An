import type { OrderStatus, PaymentMethod, Prisma } from "@pczone/db";
import { ConflictError } from "../middleware/errors.js";

/**
 * Phần dùng chung của mọi thao tác đổi trạng thái đơn có hoàn kho: khách tự huỷ (`order.service.ts`), nhân viên
 * huỷ/hoàn hàng (`admin-order.service.ts`) và tự huỷ đơn quá hạn thanh toán (`unpaid-order.service.ts`).
 *
 * Chống chạy đua: hàm gọi đọc đơn (đọc thường, KHÔNG khoá dòng) rồi kiểm tra nghiệp vụ, nhưng bước đổi trạng thái
 * luôn là một `UPDATE ... WHERE id = ? AND status = <trạng thái vừa đọc>` đặt TRƯỚC mọi bước hoàn kho/hoàn mã. InnoDB
 * khoá dòng đơn và kiểm lại điều kiện trên bản mới nhất: hai request huỷ cùng lúc thì request sau phải chờ request
 * trước xong, lúc đó đơn đã CANCELLED nên không khớp điều kiện (count = 0) → 409, cả transaction của nó bị huỷ, không
 * hoàn kho/hoàn mã/ghi lịch sử lần hai. Cùng nguyên tắc với điều kiện tồn kho trong WHERE lúc đặt hàng.
 */

/** Lỗi 409 khi một thao tác khác vừa đổi trạng thái đơn giữa lúc đọc và lúc ghi */
export const ORDER_CHANGED_MESSAGE =
  "Đơn hàng vừa được cập nhật bởi một thao tác khác. Vui lòng tải lại trang để xem trạng thái mới nhất.";

/**
 * Đổi trạng thái CÓ ĐIỀU KIỆN: chỉ ghi khi đơn vẫn đúng trạng thái `order.status` đã đọc (cộng điều kiện thêm nếu
 * có, vd chưa thanh toán). Trả `false` nếu một thao tác khác đã đổi đơn trước — hàm gọi tự quyết định báo 409 hay
 * bỏ qua.
 */
export async function claimOrderTransition(
  tx: Prisma.TransactionClient,
  order: { id: string; status: OrderStatus },
  data: Prisma.OrderUpdateManyMutationInput,
  extraWhere: Prisma.OrderWhereInput = {},
): Promise<boolean> {
  const { count } = await tx.order.updateMany({ where: { ...extraWhere, id: order.id, status: order.status }, data });
  return count === 1;
}

/** Như `claimOrderTransition` nhưng ném 409 khi không giành được đơn — dùng cho request của người dùng */
export async function claimOrderTransitionOrThrow(
  ...args: Parameters<typeof claimOrderTransition>
): Promise<void> {
  if (!(await claimOrderTransition(...args))) throw new ConflictError(ORDER_CHANGED_MESSAGE);
}

interface OrderLine {
  productId: string | null;
  quantity: number;
}

/**
 * Cộng trả kho từng dòng hàng + ghi sổ kho. `ADJUST` cho đơn huỷ (hàng chưa từng tới tay khách), `RETURN` cho khách
 * trả hàng đã nhận/giao không thành công.
 */
export async function restockOrderItems(
  tx: Prisma.TransactionClient,
  order: { id: string; items: OrderLine[] },
  type: "ADJUST" | "RETURN",
  note: string,
): Promise<void> {
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
        type,
        quantityChange: item.quantity,
        quantityAfter: updated.inventoryQuantity,
        orderId: order.id,
        note,
      },
    });
  }
}

/**
 * Hoàn lại lượt mã giảm giá — cùng nguyên tắc với hoàn kho: đơn huỷ thì mọi thứ đã trừ lúc tạo đơn phải trả lại,
 * kẻo mã coi như đã dùng dù đơn chưa từng thành công. `VoucherRedemption.orderId` lưu mã đơn (xem `redeemVoucher`).
 */
export async function releaseOrderVoucher(
  tx: Prisma.TransactionClient,
  order: { voucherId: string | null; orderCode: string },
): Promise<void> {
  if (!order.voucherId) return;
  await tx.voucher.updateMany({
    where: { id: order.voucherId, usageCount: { gt: 0 } },
    data: { usageCount: { decrement: 1 } },
  });
  await tx.voucherRedemption.deleteMany({ where: { voucherId: order.voucherId, orderId: order.orderCode } });
}

/**
 * Tiền có thể về SAU khi đơn đã huỷ không: chuyển khoản/MoMo do khách tự chuyển (có thể chuyển sát lúc đơn bị huỷ, tiền
 * về muộn), VNPay thì cổng có thể báo kết quả (IPN) muộn cho lượt khách đang thanh toán dở. Những đơn này GIỮ lượt thanh
 * toán ở PENDING khi huỷ — nhân viên vẫn "Xác nhận đã nhận tiền" được (`confirmOrderPayment`), IPN muộn vẫn ghi nhận được
 * (`applyVnpayCallback`): đơn giữ nguyên Đã huỷ, lịch sử ghi "cần đối soát", rồi nhân viên "Đánh dấu đã hoàn tiền".
 * COD thu tiền lúc giao hàng — đơn đã huỷ thì không bao giờ có tiền về, huỷ luôn lượt thanh toán.
 */
export function paymentMayArriveAfterCancel(method: PaymentMethod): boolean {
  return method !== "COD";
}

export interface CancelOrderOptions {
  /** Ghi vào `Order.cancelReason` (khách thấy ở trang chi tiết đơn) */
  reason?: string;
  /** Ghi chú dòng lịch sử trạng thái */
  historyNote: string;
  /** Ghi chú các dòng sổ kho hoàn kho */
  stockNote: string;
  /** Người thực hiện — bỏ trống khi khách tự huỷ hoặc hệ thống tự huỷ */
  changedBy?: string;
  /** Chỉ huỷ khi đơn vẫn CHƯA thanh toán — chặn luôn trường hợp nhân viên vừa xác nhận tiền đúng lúc khách bấm huỷ */
  requireUnpaid?: boolean;
}

/**
 * Huỷ đơn trong transaction của hàm gọi: giành đơn bằng cập nhật có điều kiện TRƯỚC, rồi mới hoàn mã + hoàn kho,
 * ghi lịch sử. Trả `false` (không làm gì cả) nếu đơn đã bị thao tác khác đổi trạng thái. Lượt thanh toán còn chờ: xem
 * `paymentMayArriveAfterCancel` — cùng một cách cho khách tự huỷ, nhân viên huỷ và hệ thống tự huỷ đơn quá hạn.
 *
 * Hoàn mã TRƯỚC hoàn kho: lúc đặt hàng `createOrder` khoá dòng mã giảm giá rồi mới tới dòng sản phẩm, đi cùng thứ
 * tự đó thì một lượt đặt hàng và một lượt huỷ dùng chung mã + sản phẩm không khoá chéo nhau (deadlock).
 */
export async function cancelOrderInTx(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    orderCode: string;
    status: OrderStatus;
    paymentMethod: PaymentMethod;
    voucherId: string | null;
    items: OrderLine[];
  },
  options: CancelOrderOptions,
): Promise<boolean> {
  const claimed = await claimOrderTransition(
    tx,
    order,
    { status: "CANCELLED", cancelledAt: new Date(), cancelReason: options.reason },
    options.requireUnpaid ? { paymentStatus: "PENDING" } : {},
  );
  if (!claimed) return false;

  await releaseOrderVoucher(tx, order);
  await restockOrderItems(tx, order, "ADJUST", options.stockNote);

  await tx.orderStatusHistory.create({
    data: {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: "CANCELLED",
      changedBy: options.changedBy,
      note: options.historyNote,
    },
  });
  if (!paymentMayArriveAfterCancel(order.paymentMethod)) {
    await tx.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "CANCELLED" } });
  }
  return true;
}
