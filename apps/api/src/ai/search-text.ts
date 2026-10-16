/**
 * Dựng `Product.aiSearchText` — văn bản đem đi sinh embedding (xem ai/embedding-store.ts). Cùng khuôn với hai luồng
 * crawler (apps/crawler/src/db.ts, apps/crawler/src/demo/load.ts): tên + hãng + danh mục + mô tả ngắn + thông số.
 *
 * Trước đây chỉ crawler/seed ghi cột này, sản phẩm admin tạo/sửa thì để null (hoặc giữ nội dung cũ), mà
 * embedding-store lọc `aiSearchText: { not: null }` — sản phẩm thêm tay không bao giờ vào chỉ mục AI, sửa tên/thông
 * số thì AI vẫn tìm theo nội dung cũ.
 */
import type { SpecRowDto } from "../types/dto.js";

/** Cùng trần với crawler */
export const AI_SEARCH_TEXT_MAX_LENGTH = 20_000;

export interface AiSearchTextSource {
  name: string;
  brandName?: string | null;
  categoryName?: string | null;
  shortDescription?: string | null;
  shortSpecs?: string[];
  specifications?: SpecRowDto[];
}

export function buildAiSearchText(source: AiSearchTextSource): string {
  return [
    source.name.trim(),
    source.brandName?.trim() ? `Thương hiệu: ${source.brandName.trim()}` : "",
    source.categoryName?.trim() ? `Danh mục: ${source.categoryName.trim()}` : "",
    source.shortDescription?.trim() ?? "",
    (source.shortSpecs ?? []).map((spec) => spec.trim()).filter(Boolean).join("\n"),
    (source.specifications ?? [])
      .filter((row) => row.label.trim() && row.value.trim())
      .map((row) => `${row.label.trim()}: ${row.value.trim()}`)
      .join("\n"),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, AI_SEARCH_TEXT_MAX_LENGTH);
}
