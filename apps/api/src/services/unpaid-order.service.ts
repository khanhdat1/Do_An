import { prisma } from "@pczone/db";
import { retryOnTransactionConflict } from "../utils/prisma-errors.js";
import { autoCancelReason, staleUnpaidOrderWhere } from "../utils/unpaid-order.js";
import { cancelOrderInTx } from "./order-cancellation.service.js";

/**
 * Tự huỷ đơn chuyển khoản ngân hàng/MoMo/VNPay bỏ dở: đặt hàng đã trừ kho ngay, nhưng khách không chuyển tiền (hoặc
 * nhân viên không xác nhận, hoặc khách bỏ dở ở cổng VNPay) thì hàng bị giữ mãi, không ai mua được. Quá hạn
 * (`env.orders.unpaidTimeoutHours`, mặc định 24 giờ) thì huỷ đúng như khách tự huỷ: hoàn kho, hoàn lượt mã giảm giá,
 * ghi lịch sử với lý do rõ ràng.
 *
 * Chạy bằng `setInterval` ngay trong tiến trình API (`startUnpaidOrderSweeper`, gọi từ server.ts) — không cần cron hay
 * hàng đợi riêng. Chạy lặp hay nhiều tiến trình API cùng quét một lúc đều an toàn: mỗi đơn được huỷ trong transaction
 * riêng bằng cập nhật có điều kiện (`cancelOrderInTx`), tiến trình nào giành được đơn trước thì làm, các tiến trình
 * còn lại thấy count = 0 và bỏ qua; nhân viên vừa xác nhận tiền / IPN VNPay vừa báo thành công đúng lúc đó thì đơn đã
 * PAID, cũng bị bỏ qua — còn nếu lượt huỷ giành được đơn trước thì IPN tới sau chỉ ghi nhận đã có tiền để đối soát
 * (`applyVnpayCallback`), không hồi sinh đơn.
 */

/** Bao lâu quét một lần — đơn bị huỷ trễ tối đa chừng này so với đúng hạn, không đáng kể khi hạn tính bằng giờ */
const SWEEP_INTERVAL_MS = 5 * 60_000;
/** Mỗi lượt quét huỷ tối đa chừng này đơn (cũ nhất trước), còn lại để lượt sau */
const SWEEP_BATCH_SIZE = 100;

/** Một lượt quét: trả mã các đơn vừa được huỷ. `now` để kiểm thử/chạy tay với mốc thời gian khác */
export async function cancelStaleUnpaidOrders(timeoutHours: number, now = new Date()): Promise<string[]> {
  const candidates = await prisma.order.findMany({
    where: staleUnpaidOrderWhere(now, timeoutHours),
    include: { items: true },
    orderBy: { createdAt: "asc" },
    take: SWEEP_BATCH_SIZE,
  });

  const cancelled: string[] = [];
  for (const order of candidates) {
    const reason = autoCancelReason(order.paymentMethod, timeoutHours);
    try {
      const done = await retryOnTransactionConflict(() =>
        prisma.$transaction((tx) =>
          cancelOrderInTx(tx, order, {
            reason,
            historyNote: reason,
            stockNote: `Hoàn kho do hệ thống tự huỷ đơn ${order.orderCode} quá hạn thanh toán`,
            // Lượt thanh toán giữ PENDING (`paymentMayArriveAfterCancel`): tiền khách chuyển sát hạn / IPN VNPay về muộn
            // vẫn ghi nhận được sau khi đơn bị huỷ. Đơn đã huỷ thì trang của khách không còn hiện QR chuyển khoản nữa.
            requireUnpaid: true,
          }),
        ),
      );
      if (done) cancelled.push(order.orderCode);
    } catch (error) {
      // Một đơn lỗi không chặn các đơn còn lại; lượt quét sau sẽ thử lại đơn này
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  Tự huỷ đơn ${order.orderCode} quá hạn thanh toán không thành công: ${message}`);
    }
  }
  return cancelled;
}

/**
 * Bật vòng quét định kỳ (quét ngay một lượt lúc khởi động). `timeoutHours = null` (đặt `UNPAID_ORDER_TIMEOUT_HOURS=0`)
 * thì không bật gì. Trả hàm dừng để server.ts gọi lúc tắt API.
 */
export function startUnpaidOrderSweeper(timeoutHours: number | null): () => void {
  if (timeoutHours === null) return () => {};

  let running = false;
  const sweep = async () => {
    // Lượt trước chưa xong (DB chậm) thì bỏ lượt này, không chạy chồng trong cùng một tiến trình
    if (running) return;
    running = true;
    try {
      const codes = await cancelStaleUnpaidOrders(timeoutHours);
      if (codes.length > 0) console.log(`  Tự huỷ ${codes.length} đơn quá hạn thanh toán: ${codes.join(", ")}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  Quét đơn quá hạn thanh toán không thành công (${message}) — sẽ thử lại ở lượt sau`);
    } finally {
      running = false;
    }
  };

  void sweep();
  const timer = setInterval(() => void sweep(), SWEEP_INTERVAL_MS);
  timer.unref(); // không giữ tiến trình sống chỉ vì vòng quét này
  return () => clearInterval(timer);
}
