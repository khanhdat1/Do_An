/**
 * Đồng bộ ảnh chính hãng — script nối ba tầng lại với nhau.
 *
 *   danh mục hãng  ->  so khớp model  ->  trích ảnh  ->  tải & chuyển WebP  ->  DB
 *
 * Thay thế cho replace-all-asrock-images.ts và replace-all-gigabyte-images.ts.
 *
 * Cách dùng:
 *   npx tsx src/images/sync.ts --dry-run          xem trước, không đụng DB, không tải ảnh
 *   npx tsx src/images/sync.ts --limit=5          chỉ xử lý 5 sản phẩm đầu
 *   npx tsx src/images/sync.ts --brand=asrock     chỉ một hãng
 *   npx tsx src/images/sync.ts                    chạy thật, tất cả
 *
 * Nên chạy --dry-run trước: nó cho biết tỷ lệ so khớp mà không tải một byte nào.
 */
import "dotenv/config";
import fs from "node:fs/promises";
import { prisma } from "../db.js";
import { ADAPTERS, type BrandAdapter } from "./adapters.js";
import { fetchText } from "./catalog.js";
import { ingestImage } from "./ingest.js";
import { matchProduct } from "./normalize.js";

const DELAY_MS = 1200;

function getFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found?.slice(prefix.length);
}

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number(getFlag("limit") ?? "0");
const ONLY_BRAND = getFlag("brand")?.toLowerCase();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Outcome =
  | "REPLACED" // đã thay bằng ảnh chính hãng
  | "NO_MATCH" // không tìm thấy model trong danh mục hãng
  | "AMBIGUOUS" // nhiều ứng viên ngang nhau, không dám đoán
  | "NO_IMAGES" // tìm ra trang nhưng không trích được ảnh đạt chuẩn
  | "FAILED"; // lỗi mạng hoặc lỗi khác

interface Row {
  sku: string;
  name: string;
  outcome: Outcome;
  detail: string;
}

const rows: Row[] = [];

/**
 * Đánh dấu ảnh KCCShop của sản phẩm là cần rà.
 *
 * Ảnh vẫn giữ trong DB để admin biết sản phẩm nào còn thiếu, nhưng frontend
 * lọc theo cờ này để KHÔNG hiển thị ảnh có watermark của shop khác.
 */
async function flagForReview(productId: string) {
  if (DRY_RUN) return;
  await prisma.productImage.updateMany({
    where: { productId, source: "KCCSHOP" },
    data: { needsReview: true },
  });
}

async function processProduct(
  adapter: BrandAdapter,
  product: { id: string; sku: string; name: string },
  catalog: Awaited<ReturnType<BrandAdapter["loadCatalog"]>>
): Promise<void> {
  const record = (outcome: Outcome, detail: string) => {
    rows.push({ sku: product.sku, name: product.name, outcome, detail });
    const mark = outcome === "REPLACED" ? "✓" : outcome === "FAILED" ? "✗" : "–";
    console.log(`  ${mark} [${outcome}] ${product.name}`);
    if (detail) console.log(`      ${detail}`);
  };

  // --- 1. So khớp model ----------------------------------------------------
  const match = matchProduct(product.name, catalog);

  if (match.status === "NOT_FOUND") {
    await flagForReview(product.id);
    return record("NO_MATCH", "Không có model tương ứng trong danh mục hãng");
  }

  if (match.status === "AMBIGUOUS") {
    await flagForReview(product.id);
    return record("AMBIGUOUS", `Ngang điểm: ${match.candidates.join(" | ")}`);
  }

  const { entry, warning } = match.result;

  if (DRY_RUN) {
    return record(
      "REPLACED",
      `(thử) -> ${entry.model}  ${entry.url}${warning ? "  [cần rà]" : ""}`
    );
  }

  // --- 2. Lấy ảnh từ trang chính hãng --------------------------------------
  let candidates: { url: string; alt: string }[];
  try {
    const html = await fetchText(entry.url);
    candidates = adapter.extractImages(html, entry.url, entry.model);
  } catch (error) {
    await flagForReview(product.id);
    return record(
      "FAILED",
      error instanceof Error ? error.message : String(error)
    );
  }

  if (candidates.length === 0) {
    await flagForReview(product.id);
    return record("NO_IMAGES", `Trang ${entry.url} không có ảnh đạt chuẩn`);
  }

  // --- 3. Tải về, kiểm tra, chuyển WebP ------------------------------------
  const seen = new Set<string>();
  const ingested: {
    url: string;
    alt: string;
    localPath: string;
    remoteUrl: string;
    width: number;
    height: number;
    bytes: number;
    checksum: string;
  }[] = [];

  for (const candidate of candidates) {
    const result = await ingestImage(product.sku, candidate.url, seen);

    if (result.status === "OK") {
      ingested.push({ ...result.image, alt: candidate.alt });
    } else if (result.status === "REJECTED") {
      console.log(`      bỏ ảnh: ${result.reason}`);
    } else if (result.status === "ERROR") {
      console.log(`      lỗi tải ảnh: ${result.message}`);
    }

    await sleep(300);
  }

  if (ingested.length === 0) {
    await flagForReview(product.id);
    return record("NO_IMAGES", "Tất cả ảnh ứng viên đều bị loại");
  }

  // --- 4. Ghi vào DB -------------------------------------------------------
  // Chỉ xoá ảnh cũ SAU KHI đã chắc chắn có ảnh mới hợp lệ, để không bao giờ
  // rơi vào trạng thái sản phẩm không còn ảnh nào.
  await prisma.$transaction(async (tx) => {
    await tx.productImage.deleteMany({ where: { productId: product.id } });

    await tx.productImage.createMany({
      data: ingested.map((image, index) => ({
        productId: product.id,
        url: image.url,
        alt: image.alt,
        position: index,
        isPrimary: index === 0,
        source: adapter.key.toUpperCase(),
        sourceUrl: entry.url,
        remoteUrl: image.remoteUrl,
        localPath: image.localPath,
        width: image.width,
        height: image.height,
        bytes: image.bytes,
        checksum: image.checksum,
        // Khớp được nhưng có điểm đáng ngờ -> vẫn dùng, nhưng để admin rà lại
        needsReview: Boolean(warning),
      })),
    });
  });

  record(
    "REPLACED",
    `${ingested.length} ảnh từ ${entry.model}${warning ? "  [cần rà]" : ""}`
  );
}

async function main() {
  console.log(
    DRY_RUN
      ? "=== ĐỒNG BỘ ẢNH CHÍNH HÃNG (chạy thử, không ghi DB) ===\n"
      : "=== ĐỒNG BỘ ẢNH CHÍNH HÃNG ===\n"
  );

  for (const adapter of ADAPTERS) {
    if (ONLY_BRAND && adapter.key !== ONLY_BRAND) continue;

    console.log(`\n########## ${adapter.key.toUpperCase()} ##########`);

    let catalog;
    try {
      catalog = await adapter.loadCatalog();
    } catch (error) {
      console.error(
        `Không dựng được danh mục ${adapter.key}:`,
        error instanceof Error ? error.message : error
      );
      continue;
    }

    if (catalog.length === 0) {
      console.warn(`Danh mục ${adapter.key} rỗng — bỏ qua hãng này.`);
      continue;
    }

    // MySQL dùng collation không phân biệt hoa thường nên `contains` là đủ,
    // không cần mode: "insensitive" (tuỳ chọn đó chỉ có ở PostgreSQL).
    const products = await prisma.product.findMany({
      where: {
        OR: adapter.brandNames.map((b) => ({ name: { contains: b } })),
      },
      select: { id: true, sku: true, name: true },
      orderBy: { name: "asc" },
      ...(LIMIT > 0 ? { take: LIMIT } : {}),
    });

    console.log(`Tìm thấy ${products.length} sản phẩm trong database.\n`);

    for (const product of products) {
      await processProduct(adapter, product, catalog);
      if (!DRY_RUN) await sleep(DELAY_MS);
    }
  }

  // --- Báo cáo -------------------------------------------------------------
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.outcome] = (acc[r.outcome] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\n\n════════════ KẾT QUẢ ════════════");
  console.table(counts);

  const total = rows.length;
  const ok = counts.REPLACED ?? 0;
  console.log(
    `Tỷ lệ phủ: ${ok}/${total}` +
      (total ? ` (${Math.round((ok / total) * 100)}%)` : "")
  );

  const needAttention = rows.filter((r) => r.outcome !== "REPLACED");
  if (needAttention.length) {
    const report =
      "SKU\tTình trạng\tTên sản phẩm\tChi tiết\n" +
      needAttention
        .map((r) => `${r.sku}\t${r.outcome}\t${r.name}\t${r.detail}`)
        .join("\n");

    await fs.writeFile("bao-cao-anh-can-xu-ly.tsv", report, "utf8");
    console.log(
      `\n${needAttention.length} sản phẩm cần admin tự upload ảnh.` +
        `\nDanh sách đã ghi ra: bao-cao-anh-can-xu-ly.tsv (mở được bằng Excel)`
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });