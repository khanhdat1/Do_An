/**
 * Danh sách so sánh sản phẩm — chỉ lưu ở trình duyệt (localStorage), không cần đăng nhập, không
 * đồng bộ server: đây là công cụ tạm để cân nhắc lúc mua sắm, không phải tài sản lâu dài như yêu thích.
 */

const COMPARE_KEY = "pczone.compareSlugs";
export const COMPARE_MAX = 4;

/** localStorage có thể ném lỗi (chế độ riêng tư, bị chặn dữ liệu trang) — lỗi thì coi như danh sách rỗng */
export function readCompareSlugs(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(COMPARE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeCompareSlugs(slugs: string[]): void {
  try {
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify(slugs));
  } catch {
    // Không lưu được thì thôi — danh sách vẫn đúng trong state của tab hiện tại
  }
}

/** Bật/tắt một sản phẩm trong danh sách so sánh. Đầy (COMPARE_MAX) thì bỏ qua, trả nguyên danh sách cũ. */
export function toggleCompareSlug(current: string[], slug: string): string[] {
  if (current.includes(slug)) {
    const next = current.filter((item) => item !== slug);
    writeCompareSlugs(next);
    return next;
  }
  if (current.length >= COMPARE_MAX) return current;
  const next = [...current, slug];
  writeCompareSlugs(next);
  return next;
}

export function removeCompareSlug(current: string[], slug: string): string[] {
  const next = current.filter((item) => item !== slug);
  writeCompareSlugs(next);
  return next;
}

export function clearCompareSlugs(): string[] {
  writeCompareSlugs([]);
  return [];
}
