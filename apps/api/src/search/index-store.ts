/**
 * Chỉ mục tìm kiếm nằm trong bộ nhớ của tiến trình API: đọc toàn bộ sản phẩm đang bán MỘT lần, dựng chỉ mục
 * (xem engine.ts), rồi dùng lại cho mọi lượt tìm.
 *
 * Chỉ mục chỉ dùng để XÁC ĐỊNH sản phẩm nào khớp và thứ tự; giá, ảnh, tồn kho hiện ra luôn đọc lại từ DB theo
 * id nên không bao giờ cũ. Cái có thể cũ là "sản phẩm nào khớp": sản phẩm mới thêm hay bị ẩn chỉ có hiệu lực sau
 * tối đa TTL (mặc định 60 giây), đúng tuần suất ISR 60 giây của trang web.
 *
 * Hết hạn thì dùng bản cũ trả lời ngay và dựng lại ở nền (stale-while-revalidate): người dùng không bao giờ phải
 * chờ dựng lại chỉ mục, trừ lượt tìm đầu tiên sau khi API khởi động (đã được làm nóng sẵn, xem server.ts).
 */
import { prisma, ProductStatus, type Prisma } from "@pczone/db";
import { readAllShortSpecs, readSpecifications } from "../mappers/product.mapper.js";
import { buildDoc, buildIndex, type SearchIndex } from "./engine.js";

const TTL_MS = 60_000;

const productSelect = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  shortSpecs: true,
  specifications: true,
  sellingPrice: true,
  soldCount: true,
  publishedAt: true,
  inventoryQuantity: true,
  reservedQuantity: true,
  brand: { select: { slug: true, name: true } },
  category: {
    select: {
      slug: true,
      name: true,
      parent: { select: { slug: true, name: true, parent: { select: { slug: true, name: true } } } },
    },
  },
} satisfies Prisma.ProductSelect;

async function build(): Promise<SearchIndex> {
  const [rows, categories] = await Promise.all([
    // Cùng điều kiện với PUBLIC_FILTER của product.service (không import để khỏi vòng phụ thuộc)
    prisma.product.findMany({ where: { status: ProductStatus.ACTIVE }, select: productSelect }),
    prisma.category.findMany({ where: { isActive: true }, select: { slug: true, name: true } }),
  ]);

  const docs = rows.map((row) => {
    const { parent } = row.category;
    return buildDoc({
      id: row.id,
      slug: row.slug,
      name: row.name,
      price: Number(row.sellingPrice),
      soldCount: row.soldCount,
      publishedAt: row.publishedAt,
      inStock: row.inventoryQuantity - row.reservedQuantity > 0,
      brand: row.brand,
      // Lá → cha → ông. Nhãn dòng thông số ("Kích thước màn hình") KHÔNG đưa vào: nó làm mọi laptop khớp "màn hình"
      categories: [row.category, ...(parent ? [parent, ...(parent.parent ? [parent.parent] : [])] : [])].map(({ slug, name }) => ({ slug, name })),
      extraTexts: [row.shortDescription ?? "", ...readAllShortSpecs(row.shortSpecs), ...readSpecifications(row.specifications).map((spec) => spec.value)],
    });
  });

  return buildIndex(docs, categories);
}

let cached: SearchIndex | null = null;
let refreshing: Promise<SearchIndex> | null = null;

/** Dựng lại chỉ mục; nhiều lời gọi cùng lúc dùng chung một lần dựng */
function refresh(): Promise<SearchIndex> {
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

export async function getSearchIndex(): Promise<SearchIndex> {
  if (!cached) return refresh();

  if (Date.now() - cached.builtAt > TTL_MS) {
    refresh().catch((error) => console.warn("[search] Không dựng lại được chỉ mục, tạm dùng bản cũ:", error instanceof Error ? error.message : error));
  }
  return cached;
}

/** Làm nóng chỉ mục lúc khởi động để lượt tìm đầu tiên không phải chờ */
export async function warmSearchIndex(): Promise<number> {
  return (await refresh()).docs.length;
}

/** Đánh dấu chỉ mục đã cũ (gọi sau khi đổi dữ liệu sản phẩm): lượt tìm kế tiếp dựng lại ở nền */
export function invalidateSearchIndex(): void {
  if (cached) cached.builtAt = 0;
}
