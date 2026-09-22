import type { Prisma } from "@pczone/db";

/** "PCZ20260919" — tiền tố theo ngày (giờ máy chủ, đủ dùng cho một mã hiển thị) */
function todayPrefix(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `PCZ${y}${m}${d}`;
}

/**
 * Sinh mã đơn hiển thị cho khách, dạng "PCZ20260919-0001": tiền tố theo ngày + số thứ tự trong ngày, đếm bằng số
 * đơn đã có cùng tiền tố. Có thể trùng nếu hai đơn được tạo cùng lúc; gọi lại với `attempt` tăng dần khi
 * `Order.create` báo lỗi trùng khoá `orderCode` (xem `order.service.ts`) để thử số tiếp theo.
 */
export async function generateOrderCode(tx: Prisma.TransactionClient, attempt = 0): Promise<string> {
  const prefix = todayPrefix(new Date());
  const count = await tx.order.count({ where: { orderCode: { startsWith: `${prefix}-` } } });
  const sequence = count + 1 + attempt;
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}
