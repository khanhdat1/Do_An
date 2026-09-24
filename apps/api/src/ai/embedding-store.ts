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
import { EMBED_BATCH_LIMIT, embedBatch, isConfigured } from "./openai-client.js";

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
    // Ghi dần theo TỪNG đợt (không gộp một lượt embedBatch(toàn bộ) rồi mới ghi): free-tier Gemini có
    // quota embedding hạn chế, gặp thực tế là hết quota giữa chừng — nếu gộp hết rồi mới ghi thì một
    // đợt lỗi cuối cùng xoá mất công (và quota đã tốn) của mọi đợt trước đó đã thành công. Ghi ngay
    // sau mỗi đợt để giữ lại đúng phần đã làm được; đợt nào lỗi thì DỪNG HẲN (không thử đợt kế tiếp
    // trong cùng lượt dựng này) — để `getEmbeddingIndex()` tự cách quãng theo TTL trước khi thử lại
    // phần còn thiếu, thay vì dội liên tục.
    for (let i = 0; i < needsEmbedding.length; i += EMBED_BATCH_LIMIT) {
      const chunk = needsEmbedding.slice(i, i + EMBED_BATCH_LIMIT);
      let vectors: number[][];
      try {
        vectors = await embedBatch(chunk.map((item) => item.text));
      } catch (error) {
        console.warn(
          `[ai] Dừng dựng chỉ mục embedding giữa chừng (đã xong ${docs.length}/${products.length} sản phẩm, còn lại sẽ tự thử lại sau):`,
          error instanceof Error ? error.message : error,
        );
        break;
      }

      // allSettled (không phải all): một dòng ghi lỗi (vd race giữa hai lần tsx watch restart chồng
      // nhau lúc code, cả hai cùng ghi một productId) không được huỷ mất kết quả ghi thành công của
      // những dòng khác trong cùng đợt — đúng tinh thần "ghi từng dòng độc lập" đã định từ đầu.
      const written = await Promise.allSettled(
        chunk.map((item, j) =>
          prisma.productEmbedding
            .upsert({
              where: { productId: item.productId },
              create: {
                productId: item.productId,
                vectorId: item.productId,
                model: env.ai.embeddingModel,
                dimensions: vectors[j].length,
                contentHash: item.hash,
                vector: vectors[j],
                status: "INDEXED",
                indexedAt: new Date(),
              },
              update: {
                model: env.ai.embeddingModel,
                dimensions: vectors[j].length,
                contentHash: item.hash,
                vector: vectors[j],
                status: "INDEXED",
                indexedAt: new Date(),
              },
            })
            .then(() => item),
        ),
      );
      const succeeded = new Set(written.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<(typeof chunk)[number]>).value.productId));
      const failed = written.length - succeeded.size;
      if (failed > 0) console.warn(`[ai] ${failed} dòng embedding trong đợt này ghi lỗi (bỏ qua, sẽ tự thử lại ở lượt dựng sau)`);

      chunk.forEach((item, j) => {
        if (succeeded.has(item.productId)) docs.push({ productId: item.productId, vector: vectors[j] });
      });
    }
  }

  return { docs, builtAt: Date.now() };
}

let cached: EmbeddingIndex | null = null;
let refreshing: Promise<EmbeddingIndex> | null = null;
let lastFailureAt = 0;
// Free-tier Gemini có quota embedding riêng, từng gặp thực tế: hết quota rồi thì gọi lại NGAY còn làm
// tình hình tệ hơn (thời gian đề nghị chờ lại càng tăng qua mỗi lần thử) chứ không giúp gì — nghỉ một
// lúc trước khi cho phép dựng lại, tránh mỗi lượt tìm kiếm của người dùng lại âm thầm kích hoạt thêm
// một đợt gọi API tốn quota vô ích trong lúc đang bị chặn.
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000;

/** Dựng lại chỉ mục; nhiều lời gọi cùng lúc dùng chung một lần dựng */
function refresh(): Promise<EmbeddingIndex> {
  refreshing ??= build()
    .then((index) => {
      cached = index;
      lastFailureAt = 0;
      return index;
    })
    .catch((error) => {
      lastFailureAt = Date.now();
      throw error;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function getEmbeddingIndex(): Promise<EmbeddingIndex> {
  if (!cached) {
    if (Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS) return { docs: [], builtAt: 0 };
    return refresh();
  }

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
