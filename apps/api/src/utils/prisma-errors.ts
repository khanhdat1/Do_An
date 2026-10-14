import { Prisma } from "@pczone/db";

/** P2002 = vi phạm ràng buộc unique. Dùng để phát hiện race condition (hai request cùng tạo một dòng). */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * P2034 = transaction bị huỷ vì xung đột ghi hoặc deadlock (MySQL InnoDB chọn transaction này làm "nạn nhân").
 * Toàn bộ transaction đã bị rollback ở phía DB, nên theo tài liệu Prisma cách xử lý đúng là chạy lại CẢ transaction.
 */
export function isTransactionConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Chạy `run` (một transaction trọn vẹn), gặp P2034 thì chạy lại từ đầu — tối đa `attempts` lần, nghỉ ngắn có ngẫu
 * nhiên tăng dần giữa các lần (20–80 ms × số lần đã thử) để các transaction đang tranh nhau không lại đụng nhau đúng
 * cùng lúc. Lỗi khác, hoặc hết lượt thử, thì ném ra nguyên vẹn. `wait` chỉ để kiểm thử thay bằng hàm không chờ.
 */
export async function retryOnTransactionConflict<T>(
  run: () => Promise<T>,
  attempts = 5,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (!isTransactionConflict(error) || attempt >= attempts) throw error;
      await wait((20 + Math.random() * 60) * attempt);
    }
  }
}
