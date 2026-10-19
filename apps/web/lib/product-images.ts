/**
 * Kiểm tra ảnh sản phẩm ở phía trình duyệt TRƯỚC khi tải lên (khu quản lý ảnh của trang sửa sản phẩm) — báo lỗi ngay
 * cho từng tệp thay vì đợi máy chủ từ chối cả lượt. Cùng giới hạn với API (apps/api/src/utils/product-images.ts); API
 * vẫn kiểm tra lại tất cả, kể cả nội dung thật của tệp (chữ ký ảnh) và ảnh trùng nội dung.
 */

export const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Giá trị `accept` của ô chọn tệp */
export const PRODUCT_IMAGE_ACCEPT = PRODUCT_IMAGE_TYPES.join(",");
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_MAX_FILES_PER_UPLOAD = 10;
export const PRODUCT_IMAGE_MAX_PER_PRODUCT = 20;

/** Phần của `File` mà các hàm dưới đây cần — kiểm thử được mà không cần trình duyệt */
export interface ImageFileLike {
  name: string;
  type: string;
  size: number;
  lastModified?: number;
}

/** "350 KB", "1,2 MB" — cách viết số thập phân của tiếng Việt */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Thông báo lỗi tiếng Việt cho một tệp không hợp lệ, null nếu tệp dùng được */
export function validateProductImageFile(file: ImageFileLike): string | null {
  if (!PRODUCT_IMAGE_TYPES.includes(file.type)) return `"${file.name}" không phải ảnh JPEG, PNG hoặc WEBP`;
  if (file.size === 0) return `"${file.name}" là tệp rỗng`;
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) return `"${file.name}" nặng ${formatFileSize(file.size)}, vượt quá 5 MB`;
  return null;
}

/** Cùng một tệp trên máy bị chọn/kéo thả lần nữa thì có cùng khoá này */
export function fileKey(file: ImageFileLike): string {
  return `${file.name}:${file.size}:${file.lastModified ?? 0}`;
}

export interface SelectionResult<T> {
  /** Tệp hợp lệ được thêm vào danh sách chờ tải lên, đúng thứ tự đã chọn */
  accepted: T[];
  /** Lý do từng tệp bị bỏ qua */
  errors: string[];
}

/**
 * Gộp các tệp vừa chọn/kéo thả vào danh sách chờ tải lên: bỏ tệp sai loại/quá dung lượng, tệp đã có trong danh sách, và
 * phần vượt quá số ảnh còn được thêm (10 ảnh mỗi lượt, 20 ảnh mỗi sản phẩm).
 */
export function addToSelection<T extends ImageFileLike>(pending: T[], incoming: T[], existingImageCount: number): SelectionResult<T> {
  const uploadRoom = PRODUCT_IMAGE_MAX_FILES_PER_UPLOAD - pending.length;
  const productRoom = PRODUCT_IMAGE_MAX_PER_PRODUCT - existingImageCount - pending.length;
  const room = Math.max(0, Math.min(uploadRoom, productRoom));

  const keys = new Set(pending.map(fileKey));
  const accepted: T[] = [];
  const errors: string[] = [];
  let overLimit = 0;

  for (const file of incoming) {
    const error = validateProductImageFile(file);
    if (error) {
      errors.push(error);
      continue;
    }
    const key = fileKey(file);
    if (keys.has(key)) {
      errors.push(`"${file.name}" đã có trong danh sách chờ tải lên`);
      continue;
    }
    if (accepted.length >= room) {
      overLimit += 1;
      continue;
    }
    keys.add(key);
    accepted.push(file);
  }

  if (overLimit > 0) {
    errors.push(
      productRoom <= uploadRoom
        ? `Mỗi sản phẩm tối đa ${PRODUCT_IMAGE_MAX_PER_PRODUCT} ảnh — đã bỏ qua ${overLimit} ảnh vượt quá số này`
        : `Mỗi lần tải lên tối đa ${PRODUCT_IMAGE_MAX_FILES_PER_UPLOAD} ảnh — đã bỏ qua ${overLimit} ảnh, tải nốt ở lượt sau`,
    );
  }
  return { accepted, errors };
}

/** Bản sao của `list` với phần tử ở `from` chuyển sang vị trí `to` (ngoài phạm vi thì giữ nguyên) */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
