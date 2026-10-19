import { isAbsolute, posix, relative, resolve } from "node:path";

/**
 * Phần logic thuần của việc quản lý ảnh sản phẩm ở trang quản trị (`services/admin-product-image.service.ts`) — tách
 * riêng để kiểm thử được mà không cần DB hay ổ đĩa (`product-images.test.ts`).
 */

/** Cùng trần 5MB với ảnh banner */
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** Số ảnh tối đa trong MỘT lần tải lên */
export const PRODUCT_IMAGE_MAX_FILES_PER_UPLOAD = 10;
/** Tổng số ảnh tối đa của một sản phẩm (kể cả ảnh crawler đang chờ duyệt) — bộ ảnh crawler thường chỉ 3–6 ảnh */
export const PRODUCT_IMAGE_MAX_PER_PRODUCT = 20;

/** Chỉ nhận ba định dạng ảnh chụp sản phẩm; GIF (banner nhận) không hợp với ảnh sản phẩm */
export const PRODUCT_IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/**
 * Ảnh admin tải lên nằm trong thư mục con riêng của IMAGE_STORAGE_DIR, KHÔNG nằm chung thư mục `<sku>/` của crawler:
 * crawler chạy lại với --force sẽ dọn mọi file lạ trong `<sku>/` (`pruneOrphans` ở apps/crawler/src/images/store.ts).
 * URL công khai `/images/products/uploads/...` — web chuyển tiếp đường dẫn này sang API (apps/web/next.config.ts).
 */
export const PRODUCT_UPLOAD_SUBDIR = "uploads";
export const PRODUCT_UPLOAD_PUBLIC_PREFIX = `/images/products/${PRODUCT_UPLOAD_SUBDIR}`;

export function isAllowedProductImageType(mimetype: string): boolean {
  return Object.hasOwn(PRODUCT_IMAGE_EXT_BY_MIME, mimetype);
}

/** Tên hiển thị của một file trong thông báo lỗi — trình duyệt luôn gửi tên, phòng khi trống thì dùng số thứ tự */
export function describeUploadedFile(originalName: string, index: number): string {
  const name = originalName.trim();
  return name ? `Tệp "${name}"` : `Tệp thứ ${index + 1}`;
}

export interface IncomingChecksum {
  checksum: string;
  label: string;
}

/**
 * Chặn ảnh trùng NỘI DUNG (SHA-256) — dù tên file khác nhau: trùng với ảnh sản phẩm đã có, hoặc cùng một ảnh bị chọn hai
 * lần trong một lượt tải. Trả về thông báo lỗi của ảnh trùng đầu tiên, hoặc null nếu không trùng.
 */
export function findDuplicateUpload(existingChecksums: Iterable<string | null>, incoming: IncomingChecksum[]): string | null {
  const existing = new Set([...existingChecksums].filter((checksum): checksum is string => Boolean(checksum)));
  const seen = new Map<string, string>();

  for (const file of incoming) {
    if (existing.has(file.checksum)) return `${file.label} trùng nội dung với một ảnh sản phẩm đã có`;
    const earlier = seen.get(file.checksum);
    if (earlier) return `${file.label} trùng nội dung với ${earlier.charAt(0).toLowerCase()}${earlier.slice(1)} trong cùng lượt tải`;
    seen.set(file.checksum, file.label);
  }
  return null;
}

/** Lỗi khi số ảnh sau lượt tải vượt trần của sản phẩm, null nếu còn chỗ */
export function checkImageCapacity(existingCount: number, incomingCount: number, max = PRODUCT_IMAGE_MAX_PER_PRODUCT): string | null {
  if (existingCount + incomingCount <= max) return null;
  const room = Math.max(0, max - existingCount);
  return room === 0
    ? `Sản phẩm đã đủ ${max} ảnh — xoá bớt ảnh cũ trước khi tải thêm`
    : `Mỗi sản phẩm tối đa ${max} ảnh — hiện có ${existingCount} ảnh, chỉ thêm được ${room} ảnh nữa`;
}

export interface StoredImageOrder {
  id: string;
  position: number;
  createdAt: Date;
}

/** Thứ tự đang lưu: `position` tăng dần, trùng thì ảnh cũ trước (dữ liệu crawler cũ có thể trùng position) */
export function sortByStoredOrder<T extends StoredImageOrder>(images: T[]): T[] {
  return [...images].sort(
    (a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  );
}

export interface ImageOrderEntry {
  id: string;
  position: number;
  isPrimary: boolean;
}

/**
 * Chuẩn hoá một thứ tự ảnh: `position` liền nhau 0..n-1, và ảnh chính là ảnh ĐẦU TIÊN khách nhìn thấy được (bỏ qua ảnh
 * `needsReview`, vốn không bao giờ hiện ra ngoài). Nhờ vậy thứ tự khách thấy (ảnh chính trước, rồi theo position —
 * `publicImages` ở product.mapper.ts) luôn đúng bằng thứ tự quản trị viên sắp, không có hai khái niệm lệch nhau.
 */
export function normalizeImageOrder(ordered: { id: string; needsReview: boolean }[]): ImageOrderEntry[] {
  const primaryId = ordered.find((image) => !image.needsReview)?.id;
  return ordered.map((image, position) => ({ id: image.id, position, isPrimary: image.id === primaryId }));
}

/** "Đặt làm ảnh chính" = đưa ảnh lên đầu, các ảnh khác giữ nguyên thứ tự tương đối */
export function moveToFront(ids: string[], id: string): string[] {
  return ids.includes(id) ? [id, ...ids.filter((other) => other !== id)] : ids;
}

/**
 * Danh sách id gửi lên khi đổi thứ tự phải là một HOÁN VỊ đúng của bộ ảnh hiện có: không thiếu, không thừa, không lặp.
 * Lệch nghĩa là trang của quản trị viên đã cũ (người khác vừa thêm/xoá ảnh) — trả về lỗi để họ tải lại, null nếu hợp lệ.
 */
export function checkReorder(currentIds: string[], requestedIds: string[]): string | null {
  const requested = new Set(requestedIds);
  const sameSet =
    requested.size === requestedIds.length &&
    requested.size === currentIds.length &&
    currentIds.every((id) => requested.has(id));
  return sameSet ? null : "Danh sách ảnh đã thay đổi (có thể vừa có người thêm/xoá ảnh) — tải lại trang rồi sắp xếp lại";
}

/**
 * Các file trên đĩa thuộc về một ảnh. Ảnh crawler lưu 3 cỡ cùng tiền tố (`<sku>/<hash12>-thumb|medium|large.webp`,
 * dòng DB trỏ bản medium — apps/crawler/src/images/ingest.ts) nên xoá ảnh là xoá cả 3; ảnh tải lên chỉ có một file.
 */
export function filesOfLocalPath(localPath: string): string[] {
  const normalized = localPath.replaceAll("\\", "/");
  const match = /^(.*\/)?([0-9a-f]{12})-(thumb|medium|large)\.webp$/.exec(normalized);
  if (!match) return [normalized];
  const [, dir = "", hash] = match;
  return ["thumb", "medium", "large"].map((size) => `${dir}${hash}-${size}.webp`);
}

/** Đường dẫn tuyệt đối của `relativePath` bên trong `dir`; null nếu nó thoát ra ngoài thư mục (`..`, đường dẫn tuyệt đối) */
export function resolveInsideDir(dir: string, relativePath: string): string | null {
  if (!relativePath || isAbsolute(relativePath) || posix.isAbsolute(relativePath)) return null;
  const root = resolve(dir);
  const target = resolve(root, relativePath);
  const rel = relative(root, target);
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? target : null;
}
