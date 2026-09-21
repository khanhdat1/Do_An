/**
 * Phần tìm kiếm chạy ở TRÌNH DUYỆT: gọi API gợi ý khi gõ và nhớ các câu đã tìm gần đây.
 *
 * Gợi ý là dữ liệu công khai nên gọi thẳng, không cookie và không refresh token như `api-client.ts`.
 */
import { PUBLIC_API_URL } from "./config";
import type { SearchSuggestions } from "@/types";

export async function fetchSuggestions(query: string, signal: AbortSignal): Promise<SearchSuggestions> {
  const response = await fetch(`${PUBLIC_API_URL}/api/search/suggest?${new URLSearchParams({ q: query, limit: "5" })}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as SearchSuggestions;
}

/* -------------------------------------------------------------------------- */
/*  Tìm kiếm gần đây                                                          */
/* -------------------------------------------------------------------------- */

const RECENT_KEY = "pczone.recentSearches";
const RECENT_MAX = 6;

/**
 * Chỉ là tiện ích của từng trình duyệt: đọc/ghi localStorage có thể ném lỗi (chế độ riêng tư, bị chặn dữ liệu
 * trang), lúc đó coi như không có lịch sử chứ không làm hỏng ô tìm kiếm.
 */
export function readRecentSearches(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** Thêm một câu vào đầu danh sách (bỏ câu trùng, không phân biệt hoa thường) và trả về danh sách mới */
export function rememberSearch(query: string): string[] {
  const list = [query, ...readRecentSearches().filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, RECENT_MAX);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Không lưu được thì thôi
  }
  return list;
}

export function clearRecentSearches(): void {
  try {
    window.localStorage.removeItem(RECENT_KEY);
  } catch {
    // Không xoá được thì thôi
  }
}
