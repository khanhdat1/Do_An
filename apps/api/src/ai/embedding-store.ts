/**
 * Chỉ mục embedding nằm trong bộ nhớ của tiến trình API — phỏng theo gần như nguyên
 * search/index-store.ts, chỉ khác một điểm quan trọng: embedding CÓ lưu lại vào MySQL
 * (`ProductEmbedding.vector`) thay vì chỉ giữ trong RAM. Lý do: `apps/api` chạy `tsx watch`, khởi
 * động lại process mỗi lần lưu file lúc code — nếu dựng lại embedding từ đầu mỗi lần như vậy thì tốn
 * hàng chục-hàng trăm lượt gọi OpenAI vô ích mỗi buổi code. Sau lần chạy đầu tiên, các lần khởi động
 * sau chỉ đọc vector đã lưu, không gọi OpenAI nữa — trừ sản phẩm thật sự mới/đổi nội dung (phát hiện
 * qua so sánh `contentHash`, đúng cơ chế STALE mà csdl.md §5.1 đã thiết kế, chỉ là lưu ở cột MySQL
 * thay vì Qdrant).
 *
 * Cũng như bộ tìm kiếm từ khoá: chỉ mục chỉ dùng để XẾP HẠNG độ liên quan, giá/ảnh/tồn kho luôn đọc
 * lại từ DB sau khi có id (xem ai-search.service.ts) — chỉ mục có thể cũ tới TTL. TTL ở đây dài hơn
 * nhiều so với tìm kiếm từ khoá (15 phút so với 60 giây) vì nội dung mô tả sản phẩm đổi ít hơn nhiều
 * so với giá/tồn kho.
 */
import { createHash } from "node:crypto";
import { prisma, ProductStatus } from "@pczone/db";
import { env } from "../env.js";
import { type EmbeddingDoc } from "./embedding-engine.js";
import { embedBatch, isConfigured } from "./openai-client.js";

const TTL_MS = 15 * 60 * 1000;
/** An toàn cho giới hạn token của model embedding — văn bản sản phẩm ở dự án này ngắn hơn nhiều nên đây chỉ là chặn trên, không phải giới hạn thật gặp phải */
const MAX_EMBED_CHARS = 4000;

function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

interface EmbeddingIndex {
  docs: EmbeddingDoc[];
  builtAt: number;
}

async function build(): Promise<EmbeddingIndex> {
  const [products, existingRows] = await Promise.all([
    // Cùng điều kiện ACTIVE với search/index-store.ts. aiSearchText đã được cả hai luồng crawler
    // ghi sẵn (tên + hãng + danh mục + thông số), chỉ là chưa ai đọc tới trước Đợt này.
    prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE, aiSearchText: { not: null } },
      select: { id: true, aiSearchText: true },
    }),
    prisma.productEmbedding.findMany({ select: { productId: true, contentHash: true, vector: true } }),
  ]);

  const existingByProduct = new Map(existingRows.map((row) => [row.productId, row]));
  const docs: EmbeddingDoc[] = [];
  const needsEmbedding: { productId: string; text: string; hash: string }[] = [];

  for (const product of products) {
    const text = (product.aiSearchText ?? "").slice(0, MAX_EMBED_CHARS);
    if (!text) continue;

    const hash = hashContent(text);
    const existing = existingByProduct.get(product.id);

    if (existing && existing.contentHash === hash && Array.isArray(existing.vector)) {
      docs.push({ productId: product.id, vector: existing.vector as number[] });
    } else {
      needsEmbedding.push({ productId: product.id, text, hash });
    }
  }

  if (needsEmbedding.length > 0 && isConfigured()) {
    const vectors = await embedBatch(needsEmbedding.map((item) => item.text));
    // Ghi từng dòng độc lập (không gộp một transaction): OpenAI đã tính phí cho các vector này rồi,
    // một dòng ghi lỗi không được kéo mất công tính lại của những dòng khác trong cùng lượt.
    await Promise.all(
      needsEmbedding.map((item, i) =>
        prisma.productEmbedding.upsert({
          where: { productId: item.productId },
          create: {
            productId: item.productId,
            vectorId: item.productId,
            model: env.ai.embeddingModel,
            dimensions: vectors[i].length,
            contentHash: item.hash,
            vector: vectors[i],
            status: "INDEXED",
            indexedAt: new Date(),
          },
          update: {
            model: env.ai.embeddingModel,
            dimensions: vectors[i].length,
            contentHash: item.hash,
            vector: vectors[i],
            status: "INDEXED",
            indexedAt: new Date(),
          },
        }),
      ),
    );
    needsEmbedding.forEach((item, i) => docs.push({ productId: item.productId, vector: vectors[i] }));
  }

  return { docs, builtAt: Date.now() };
}

let cached: EmbeddingIndex | null = null;
let refreshing: Promise<EmbeddingIndex> | null = null;

/** Dựng lại chỉ mục; nhiều lời gọi cùng lúc dùng chung một lần dựng */
function refresh(): Promise<EmbeddingIndex> {
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

export async function getEmbeddingIndex(): Promise<EmbeddingIndex> {
  if (!cached) return refresh();

  if (Date.now() - cached.builtAt > TTL_MS) {
    refresh().catch((error) => console.warn("[ai] Không dựng lại được chỉ mục embedding, tạm dùng bản cũ:", error instanceof Error ? error.message : error));
  }
  return cached;
}

/** Làm nóng chỉ mục lúc khởi động — chỉ khi đã cấu hình OpenAI, không thì để trống (AI Search tự lùi về tìm kiếm thường ở retrieval.ts) */
export async function warmEmbeddingIndex(): Promise<number> {
  if (!isConfigured()) return 0;
  return (await refresh()).docs.length;
}
