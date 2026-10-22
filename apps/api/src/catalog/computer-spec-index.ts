/**
 * Thông số đã trích của mọi laptop / PC lắp sẵn đang bán, giữ trong bộ nhớ của tiến trình API — cùng cách làm với
 * chỉ mục tìm kiếm (search/index-store.ts): đọc cột JSON `specifications` MỘT lần rồi dùng lại, thay vì đọc lại vài
 * trăm KB JSON mỗi lượt mở trang danh mục.
 *
 * Bản này chỉ dùng để biết "máy nào khớp bộ lọc thông số"; trạng thái bán, giá, tồn kho vẫn lọc bằng SQL ở mỗi lượt nên
 * không bao giờ cũ. Cái có thể cũ (tối đa TTL) là thông số của máy vừa thêm/sửa — đúng nhịp ISR 60 giây của trang web.
 * Hết hạn thì trả bản cũ ngay và dựng lại ở nền.
 */
import { prisma, ProductStatus } from "@pczone/db";
import { parseComputerSpecs } from "./computer-specs.js";
import { computerFacetValues, type FacetRow, type FacetValues } from "./spec-filters.js";

const TTL_MS = 60_000;

interface ComputerSpecIndex {
  builtAt: number;
  byId: Map<string, { categoryId: string; values: FacetValues }>;
}

async function build(): Promise<ComputerSpecIndex> {
  // Cùng điều kiện với hồ sơ "máy tính hoàn chỉnh" ở spec-filters.ts: danh mục không gắn loại linh kiện
  const rows = await prisma.product.findMany({
    where: { status: ProductStatus.ACTIVE, category: { componentType: null } },
    select: { id: true, categoryId: true, specifications: true },
  });

  const byId: ComputerSpecIndex["byId"] = new Map();
  for (const row of rows) {
    byId.set(row.id, { categoryId: row.categoryId, values: computerFacetValues(parseComputerSpecs(row.specifications)) });
  }
  return { builtAt: Date.now(), byId };
}

let cached: ComputerSpecIndex | null = null;
let refreshing: Promise<ComputerSpecIndex> | null = null;

function refresh(): Promise<ComputerSpecIndex> {
  refreshing ??= build()
    .then((index) => {
      cached = index;
      return index;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function getIndex(): Promise<ComputerSpecIndex> {
  if (!cached) return refresh();
  if (Date.now() - cached.builtAt > TTL_MS) {
    refresh().catch((error) => console.warn("[catalog] Không dựng lại được thông số laptop/PC, tạm dùng bản cũ:", error instanceof Error ? error.message : error));
  }
  return cached;
}

/** Giá trị lọc của từng sản phẩm theo id; sản phẩm chưa có trong bản đệm coi như chưa có dữ liệu */
export async function computerFacetRows(productIds: readonly string[]): Promise<FacetRow[]> {
  const { byId } = await getIndex();
  return productIds.map((id) => ({ id, values: byId.get(id)?.values ?? {} }));
}

/** Mọi máy thuộc các danh mục cho trước, để dựng điều kiện lọc */
export async function computerRowsInCategories(categoryIds: readonly string[]): Promise<FacetRow[]> {
  const { byId } = await getIndex();
  const wanted = new Set(categoryIds);
  const rows: FacetRow[] = [];
  for (const [id, entry] of byId) if (wanted.has(entry.categoryId)) rows.push({ id, values: entry.values });
  return rows;
}
