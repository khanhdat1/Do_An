import { prisma } from "@pczone/db";
import { retrieveProducts } from "../ai/retrieval.js";
import { productInclude, toProductDto } from "../mappers/product.mapper.js";
import type { AiSearchResultDto } from "../types/dto.js";
import { PUBLIC_FILTER } from "./product.service.js";

const RESULT_LIMIT = 20;

/** Đọc dữ liệu thật (giá/ảnh/tồn kho luôn mới) cho đúng các id đã truy hồi, giữ nguyên thứ tự xếp hạng */
async function loadProducts(ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: ids }, ...PUBLIC_FILTER }, include: productInclude });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toProductDto(row)] : [];
  });
}

/**
 * Tìm kiếm ngữ nghĩa bằng embedding. Trả `usedAi: false` (không phải lỗi) khi chưa cấu hình OpenAI
 * hoặc không có kết quả đủ liên quan — trang gọi tự lùi về `/api/search` (từ khoá) một cách êm ái,
 * đúng thiết kế đã chốt trong plan.
 */
export async function aiSearchProducts(query: string): Promise<AiSearchResultDto> {
  const trimmed = query.trim();
  const { products, priceIntent } = await retrieveProducts(trimmed, { limit: RESULT_LIMIT });

  if (products.length === 0) {
    return { items: [], query: trimmed, usedAi: false };
  }

  let items = await loadProducts(products.map((item) => item.productId));

  if (priceIntent) {
    items = items.filter((item) => (priceIntent.min === undefined || item.price >= priceIntent.min) && (priceIntent.max === undefined || item.price <= priceIntent.max));
  }

  // Ghi lại để sau này biết AI đang được dùng thế nào (câu hỏi gì, ra bao nhiêu kết quả) — bảng có sẵn từ đầu, chưa ai ghi
  await prisma.aiSearchLog.create({
    data: { query: trimmed, resultCount: items.length, parsedFilters: priceIntent ? { minPrice: priceIntent.min, maxPrice: priceIntent.max } : undefined },
  });

  if (items.length === 0) {
    return { items: [], query: trimmed, usedAi: false };
  }

  return {
    items,
    query: trimmed,
    priceIntent: priceIntent ? { label: priceIntent.label, minPrice: priceIntent.min, maxPrice: priceIntent.max } : undefined,
    usedAi: true,
  };
}
