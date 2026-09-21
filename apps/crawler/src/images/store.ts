/**
 * Việc chung của mọi luồng gắn ảnh vào sản phẩm (attach.ts cho sản phẩm mẫu, demo/load.ts cho bộ demo):
 * kiểm tra sản phẩm đã có ảnh dùng được chưa, và dọn file ảnh cũ không còn dòng DB nào trỏ tới.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../db.js";
import type { IngestedImage } from "./ingest.js";

/** Đọc lúc gọi hàm, không phải lúc nạp module — xem ghi chú trong ingest.ts */
export const storageDir = () => process.env.IMAGE_STORAGE_DIR ?? "public/images/products";

/**
 * Sản phẩm đã có ảnh dùng được chưa?
 * Dòng DB còn mà file trên đĩa đã mất (xoá thư mục ảnh, chuyển sang máy khác, khôi
 * phục DB) thì tính là chưa có, để chạy lại sẽ tự tải bù.
 */
export async function hasUsableImages(productId: string): Promise<boolean> {
  const images = await prisma.productImage.findMany({
    where: { productId, needsReview: false },
    select: { localPath: true },
  });
  if (images.length === 0) return false;

  for (const { localPath } of images) {
    if (!localPath) return false; // ảnh hotlink từ nơi khác, chưa tự host
    try {
      await fs.access(path.join(storageDir(), localPath));
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Xoá file ảnh cũ không còn dòng DB nào trỏ tới (sau --force hoặc khi đổi danh sách ảnh).
 * `localPath` dạng "<sku>/<hash12>-medium.webp", ba cỡ của một ảnh cùng tiền tố "<hash12>-".
 */
export async function pruneOrphans(sku: string, kept: IngestedImage[]): Promise<void> {
  const prefixes = kept.map((image) => `${path.posix.basename(image.localPath).split("-")[0]}-`);

  try {
    const dir = path.join(storageDir(), sku);
    for (const file of await fs.readdir(dir)) {
      if (!prefixes.some((prefix) => file.startsWith(prefix))) {
        await fs.rm(path.join(dir, file), { force: true });
      }
    }
  } catch {
    // dọn rác không được làm hỏng kết quả chính
  }
}
