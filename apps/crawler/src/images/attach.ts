/**
 * Gắn ảnh thật cho sản phẩm mẫu — MỘT lệnh làm cả ba việc: tải ảnh, chuyển WebP, ghi DB.
 *
 *   npm run seed-images                  chỉ làm cho sản phẩm chưa có ảnh (chạy lại nhiều lần vô hại)
 *   npm run seed-images -- --force       tải lại, thay toàn bộ ảnh của mọi sản phẩm trong danh sách
 *   npm run seed-images -- --dry-run     xem trước, không tải, không ghi DB
 *   npm run seed-images -- --only=asus   chỉ các sản phẩm có slug chứa "asus"
 *
 * `npm run db:seed` gọi lệnh này ngay sau khi seed sản phẩm, nên một lệnh là có cả dữ
 * liệu lẫn ảnh.
 *
 * Khác sync.ts (tự dò trang hãng rồi so khớp model, hiện chỉ có ASRock và Gigabyte),
 * danh sách ảnh ở đây đã được chọn và xem bằng mắt từ trước (seed-manifest.ts) nên
 * kết quả ổn định, không phải đoán. Ảnh vẫn đi qua đúng tầng ingest chung: kiểm tra
 * kích thước, bỏ ảnh trùng nội dung, chuyển WebP ba cỡ, ghi ra đĩa.
 */
import "dotenv/config";
import { prisma } from "../db.js";
import { ingestImage, type IngestedImage } from "./ingest.js";
import { hasUsableImages, pruneOrphans } from "./store.js";
import { SEED_IMAGES, type SeedImage, type SeedImageSet } from "./seed-manifest.js";

/** Nghỉ giữa các ảnh để không dồn dập vào CDN của hãng */
const DELAY_MS = 300;

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const ONLY = process.argv
  .find((arg) => arg.startsWith("--only="))
  ?.slice("--only=".length)
  .toLowerCase();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Outcome =
  | "OK" // đã tải và ghi DB
  | "SKIPPED" // đã có ảnh, không cần làm lại
  | "MISSING" // sản phẩm chưa có trong DB
  | "FAILED" // không tải được ảnh nào
  | "PLAN"; // chế độ --dry-run

const rows: { slug: string; outcome: Outcome }[] = [];

function record(slug: string, outcome: Outcome, detail = "") {
  rows.push({ slug, outcome });
  const mark = outcome === "OK" ? "✓" : outcome === "FAILED" || outcome === "MISSING" ? "✗" : "–";
  console.log(`  ${mark} [${outcome}] ${slug}`);
  if (detail) console.log(`      ${detail}`);
}

function toItem(image: SeedImage, fallbackPage: string): { url: string; page: string } {
  return typeof image === "string" ? { url: image, page: fallbackPage } : image;
}

async function processSet(set: SeedImageSet): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { slug: set.slug },
    select: { id: true, sku: true, name: true },
  });

  if (!product) {
    return record(set.slug, "MISSING", "Chưa có trong DB — chạy `npm run db:seed:data` trước");
  }

  if (!FORCE && (await hasUsableImages(product.id))) {
    return record(set.slug, "SKIPPED", "Đã có ảnh (thêm --force để tải lại)");
  }

  const wanted = set.images.map((image) => toItem(image, set.sourceUrl));

  if (DRY_RUN) {
    return record(set.slug, "PLAN", `${wanted.length} ảnh từ ${set.source}`);
  }

  // --- 1. Tải, kiểm tra, chuyển WebP ----------------------------------------
  const seen = new Set<string>();
  const ingested: (IngestedImage & { page: string })[] = [];

  for (const item of wanted) {
    const result = await ingestImage(product.sku, item.url, seen);

    if (result.status === "OK") ingested.push({ ...result.image, page: item.page });
    else if (result.status === "REJECTED") console.log(`      bỏ ảnh: ${result.reason}`);
    else if (result.status === "DUPLICATE") console.log("      bỏ ảnh: trùng nội dung với ảnh trước");
    else console.log(`      lỗi tải ảnh: ${result.message}`);

    await sleep(DELAY_MS);
  }

  // Không tải được ảnh nào thì giữ nguyên ảnh cũ, không bao giờ để sản phẩm trắng ảnh
  if (ingested.length === 0) {
    return record(set.slug, "FAILED", "Không tải được ảnh nào (mất mạng, hoặc hãng đã đổi đường dẫn?)");
  }

  // --- 2. Ghi DB: thay cả bộ ảnh trong một giao dịch -------------------------
  await prisma.$transaction(async (tx) => {
    await tx.productImage.deleteMany({ where: { productId: product.id } });

    await tx.productImage.createMany({
      data: ingested.map((image, index) => ({
        productId: product.id,
        url: image.url,
        alt: `${product.name} - ảnh ${index + 1}`,
        position: index,
        isPrimary: index === 0,
        source: set.source,
        sourceUrl: image.page,
        remoteUrl: image.remoteUrl,
        localPath: image.localPath,
        width: image.width,
        height: image.height,
        bytes: image.bytes,
        checksum: image.checksum,
        needsReview: false,
      })),
    });
  });

  await pruneOrphans(product.sku, ingested);

  const partial = ingested.length < wanted.length ? ` (bỏ ${wanted.length - ingested.length} ảnh lỗi)` : "";
  record(set.slug, "OK", `${ingested.length}/${wanted.length} ảnh từ ${set.source}${partial}`);
}

async function main() {
  console.log(DRY_RUN ? "=== GẮN ẢNH THẬT CHO SẢN PHẨM (chạy thử) ===\n" : "=== GẮN ẢNH THẬT CHO SẢN PHẨM ===\n");

  const sets = SEED_IMAGES.filter((set) => !ONLY || set.slug.includes(ONLY));
  if (sets.length === 0) {
    console.log(`Không có sản phẩm nào khớp --only=${ONLY}`);
    return;
  }

  for (const set of sets) {
    await processSet(set);
  }

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.outcome] = (acc[row.outcome] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\n════════════ KẾT QUẢ ════════════");
  console.table(counts);

  // Cố ý KHÔNG đặt exitCode lỗi: khi chạy nối sau `db:seed`, dữ liệu sản phẩm đã seed xong
  // và web vẫn chạy được với ảnh giả (icon); chỉ cần nhắc để chạy lại khi có mạng.
  const failed = rows.filter((row) => row.outcome === "FAILED").length;
  if (failed > 0) {
    console.warn(
      `\n⚠ ${failed} sản phẩm chưa có ảnh. Sản phẩm vẫn hiện bình thường (ảnh tạm theo danh mục).` +
        "\n  Khi có mạng, chạy lại: npm run seed-images",
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
