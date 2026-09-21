/**
 * Nạp bộ dữ liệu demo (data/demo-catalog.json) vào database: sản phẩm, thương hiệu và ảnh thật.
 *
 *   npm run demo-data                       nạp tất cả (chạy lại nhiều lần vô hại)
 *   npm run demo-data -- --no-images        chỉ dữ liệu sản phẩm, chưa tải ảnh
 *   npm run demo-data -- --only=cpu,ssd     chỉ vài danh mục
 *   npm run demo-data -- --force-images     tải lại ảnh của mọi sản phẩm (mặc định chỉ sản phẩm chưa có ảnh)
 *   npm run demo-data -- --dry-run          xem trước, không ghi DB, không tải ảnh
 *
 * Cần có sẵn cây danh mục: `npm run db:seed:data` (lần đầu) hoặc `npm run db:seed:categories` (DB đã có dữ liệu, chỉ
 * thêm danh mục mới như Tai nghe, Loa, Ghế, Bàn).
 *
 * Quy tắc dữ liệu (khác luồng crawl KCCShop, nơi sản phẩm mới ở trạng thái DRAFT chờ duyệt):
 *   - Đây là dữ liệu DEMO đã được chọn lọc nên sản phẩm vào thẳng trạng thái ACTIVE, có giá bán và tồn
 *     kho để giỏ hàng, đặt hàng chạy được. Giá lấy theo giá tham khảo tại ngày thu thập và được cập
 *     nhật theo bản chụp mỗi lần chạy lại.
 *   - Trạng thái, tồn kho và số đã bán là số giả lập ổn định (cùng sản phẩm luôn ra cùng số), chỉ đặt khi
 *     TẠO mới. Chạy lại không đè lên tồn kho đã giảm vì có đơn hàng thật, hay sản phẩm đã bị ẩn.
 *   - Đánh giá để 0: PCZone không bịa lượt đánh giá.
 *   - Phần chữ (mô tả, thông số, chip) do PCZone tự viết ở demo/content, không lấy từ nguồn.
 */
import "dotenv/config";
import { Prisma, ProductStatus, StockStatus } from "@pczone/db";
import { prisma } from "../db.js";
import { readCatalog, readImageBlocklist, type CatalogItem } from "../gearvn/snapshot.js";
import { rejectRetailerLogo } from "../images/watermark.js";
import { ingestImage, type IngestedImage } from "../images/ingest.js";
import { hasUsableImages, pruneOrphans } from "../images/store.js";
import { toSlug } from "../utils.js";
import { buildContent, hasBuilder } from "./content/index.js";
import { displayName, makeSku, resolveBrand, stableFraction } from "./names.js";

/** Số ảnh giữ lại cho mỗi sản phẩm: ảnh chính + ảnh minh hoạ xen giữa bài mô tả */
const MAX_IMAGES = 4;
/** Nghỉ giữa các ảnh để không dồn dập vào CDN nguồn */
const DELAY_MS = 300;

const DRY_RUN = process.argv.includes("--dry-run");
const NO_IMAGES = process.argv.includes("--no-images");
const FORCE_IMAGES = process.argv.includes("--force-images");
const ONLY = process.argv
  .find((arg) => arg.startsWith("--only="))
  ?.slice("--only=".length)
  .toLowerCase()
  .split(",");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const money = (value: number) => new Prisma.Decimal(value);

/** Tồn kho giả lập: hàng càng đắt càng ít, để dữ liệu nhìn giống một cửa hàng thật */
function demoStock(item: CatalogItem): number {
  const fraction = stableFraction(`stock:${item.sourceUrl}`);
  const [min, max] = item.price >= 100_000_000 ? [1, 3] : item.price >= 30_000_000 ? [2, 8] : item.price >= 10_000_000 ? [4, 15] : [8, 40];
  return min + Math.floor(fraction * (max - min + 1));
}

/** Số đã bán giả lập: hàng rẻ bán nhiều hơn, phân bố lệch (đa số ít, vài mẫu bán chạy) */
function demoSold(item: CatalogItem): number {
  const fraction = stableFraction(`sold:${item.sourceUrl}`) ** 2;
  const scale = item.price < 3_000_000 ? 160 : item.price < 10_000_000 ? 90 : item.price < 30_000_000 ? 45 : 15;
  return Math.floor(fraction * scale);
}

/** Ngày đăng giả lập rải trong 60 ngày gần đây để sắp xếp "Mới nhất" không gom cả một danh mục lại */
function demoPublishedAt(item: CatalogItem): Date {
  return new Date(Date.now() - Math.floor(stableFraction(`date:${item.sourceUrl}`) * 60) * 24 * 60 * 60 * 1000);
}

async function ensureBrand(brand: { name: string; slug: string }): Promise<string> {
  // Tìm theo cả slug lẫn tên (cột name unique, không phân biệt hoa thường) để không đụng hãng đã có
  const existing = await prisma.brand.findFirst({ where: { OR: [{ slug: brand.slug }, { name: brand.name }] } });
  if (existing) return existing.id;
  return (await prisma.brand.create({ data: { name: brand.name, slug: brand.slug } })).id;
}

/** Slug chưa ai dùng: thêm -2, -3... nếu trùng với sản phẩm khác trong DB hoặc trong lần chạy này */
async function freeSlug(base: string, usedInRun: Set<string>, ownId?: string): Promise<string> {
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (usedInRun.has(candidate)) continue;
    const found = await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!found || found.id === ownId) return candidate;
  }
}

type ImageOutcome = "OK" | "SKIPPED" | "FAILED";

/** Sản phẩm đang có ảnh mà địa chỉ gốc nằm trong danh sách ảnh đã loại */
async function hasBlockedImage(productId: string, blocked: Set<string>): Promise<boolean> {
  if (blocked.size === 0) return false;
  const images = await prisma.productImage.findMany({ where: { productId }, select: { remoteUrl: true } });
  return images.some((image) => image.remoteUrl !== null && blocked.has(image.remoteUrl));
}

/**
 * Tải ảnh, bỏ ảnh dính logo shop khác và ảnh trong danh sách loại (data/image-blocklist.json), ghi DB.
 * Không tải được ảnh nào thì giữ nguyên ảnh cũ.
 */
async function attachImages(
  product: { id: string; sku: string; name: string },
  item: CatalogItem,
  blocked: Set<string>,
): Promise<{ outcome: ImageOutcome; detail: string }> {
  // Đã có ảnh thì thôi, trừ khi trong đó có ảnh vừa được thêm vào danh sách loại: thêm địa chỉ vào
  // image-blocklist.json rồi chạy lại là đủ để thay ảnh đó, không cần --force-images cho cả danh mục
  if (!FORCE_IMAGES && (await hasUsableImages(product.id)) && !(await hasBlockedImage(product.id, blocked))) {
    return { outcome: "SKIPPED", detail: "đã có ảnh" };
  }

  const seen = new Set<string>();
  const ingested: IngestedImage[] = [];
  // Gộp theo lý do để dòng log ngắn: "bỏ 9 ảnh: có logo GEARVN đóng ở góc ảnh"
  const skipped = new Map<string, number>();
  const skip = (reason: string) => skipped.set(reason, (skipped.get(reason) ?? 0) + 1);

  for (const url of item.images) {
    if (blocked.has(url)) {
      skip("nằm trong danh sách ảnh đã loại");
      continue;
    }
    if (ingested.length >= MAX_IMAGES) break;

    const result = await ingestImage(product.sku, url, seen, { reject: rejectRetailerLogo });
    if (result.status === "OK") ingested.push(result.image);
    else if (result.status === "REJECTED") skip(result.reason);
    else if (result.status === "DUPLICATE") skip("trùng nội dung");
    else skip(`lỗi tải: ${result.message.slice(0, 60)}`);

    await sleep(DELAY_MS);
  }

  const notes = [...skipped].map(([reason, count]) => `bỏ ${count} ảnh: ${reason}`);
  if (ingested.length === 0) return { outcome: "FAILED", detail: notes.join("; ") || "không có ảnh nào" };

  await prisma.$transaction(async (tx) => {
    await tx.productImage.deleteMany({ where: { productId: product.id } });
    await tx.productImage.createMany({
      data: ingested.map((image, index) => ({
        productId: product.id,
        url: image.url,
        alt: `${product.name} - ảnh ${index + 1}`,
        position: index,
        isPrimary: index === 0,
        source: "GEARVN",
        sourceUrl: item.sourceUrl,
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

  return { outcome: "OK", detail: `${ingested.length} ảnh${notes.length > 0 ? ` (${notes.join("; ")})` : ""}` };
}

async function main() {
  const catalog = await readCatalog();
  const blocked = await readImageBlocklist();
  const items = catalog.products.filter((item) => !ONLY || ONLY.includes(item.category));

  console.log(`=== NẠP DỮ LIỆU DEMO${DRY_RUN ? " (chạy thử)" : ""} ===`);
  console.log(`Nguồn ${catalog.source}, thu thập ${catalog.collectedAt}: ${items.length} sản phẩm\n`);

  const categories = new Map((await prisma.category.findMany({ select: { id: true, slug: true, name: true } })).map((category) => [category.slug, category]));
  const missing = [...new Set(items.map((item) => item.category))].filter((slug) => !categories.has(slug));
  if (missing.length > 0) {
    throw new Error(`Thiếu danh mục: ${missing.join(", ")}. Chạy \`npm run db:seed:categories\` trước.`);
  }

  const usedSlugs = new Set<string>();
  const counts = { created: 0, updated: 0, images: { OK: 0, SKIPPED: 0, FAILED: 0 } as Record<ImageOutcome, number> };
  const failedImages: string[] = [];

  for (const item of items) {
    if (!hasBuilder(item.category)) {
      console.log(`  ✗ Bỏ qua ${item.sourceUrl}: chưa có mẫu nội dung cho danh mục ${item.category}`);
      continue;
    }

    const category = categories.get(item.category)!;
    const brand = resolveBrand(item);
    const name = displayName(item);
    const content = buildContent(item, name, brand?.name ?? null);

    if (DRY_RUN) {
      console.log(`  · [${item.category}] ${name} — ${item.price.toLocaleString("vi-VN")}đ (${brand?.name ?? "không hãng"}) ${content.description.length} ký tự`);
      continue;
    }

    const existing = await prisma.product.findUnique({ where: { sourceUrl: item.sourceUrl }, select: { id: true, slug: true, sku: true } });
    const slug = existing?.slug ?? (await freeSlug(toSlug(name).slice(0, 180), usedSlugs));
    usedSlugs.add(slug);

    const brandId = brand ? await ensureBrand(brand) : null;

    const aiSearchText = [
      name,
      brand ? `Thương hiệu: ${brand.name}` : "",
      `Danh mục: ${category.name}`,
      content.shortDescription,
      content.shortSpecs.join("\n"),
      content.specifications.map((row) => `${row.label}: ${row.value}`).join("\n"),
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 20000);

    // Phần nội dung: luôn cập nhật theo bản mới nhất của mẫu viết và dữ liệu chụp
    const contentData = {
      name,
      categoryId: category.id,
      brandId,
      shortDescription: content.shortDescription,
      shortSpecs: content.shortSpecs as Prisma.InputJsonValue,
      specifications: content.specifications as unknown as Prisma.InputJsonValue,
      description: content.description,
      warrantyMonths: content.warrantyMonths,
      sellingPrice: money(item.price),
      originalPrice: item.listPrice ? money(item.listPrice) : null,
      refPrice: money(item.price),
      aiSearchText,
      scrapedAt: new Date(catalog.collectedAt),
    };

    let product: { id: string; sku: string; name: string };
    if (existing) {
      product = await prisma.product.update({ where: { id: existing.id }, data: contentData, select: { id: true, sku: true, name: true } });
      counts.updated++;
    } else {
      const stock = demoStock(item);
      product = await prisma.product.create({
        data: {
          ...contentData,
          slug,
          sku: makeSku(item.category, brand?.slug, slug),
          source: "GEARVN",
          sourceUrl: item.sourceUrl,
          // Chỉ khi tạo mới: trạng thái và các con số vận hành không bị đè khi chạy lại
          status: ProductStatus.ACTIVE,
          inventoryQuantity: stock,
          stockStatus: StockStatus.IN_STOCK,
          soldCount: demoSold(item),
          publishedAt: demoPublishedAt(item),
        },
        select: { id: true, sku: true, name: true },
      });
      counts.created++;
    }

    let imageNote = "";
    if (!NO_IMAGES) {
      const result = await attachImages(product, item, blocked);
      counts.images[result.outcome]++;
      imageNote = ` — ảnh: ${result.outcome} (${result.detail})`;
      if (result.outcome === "FAILED") failedImages.push(product.name);
    }

    console.log(`  ✓ [${item.category}] ${product.name}${imageNote}`);
  }

  if (DRY_RUN) return;

  console.log("\n════════════ KẾT QUẢ ════════════");
  console.table({ "Sản phẩm tạo mới": counts.created, "Sản phẩm cập nhật": counts.updated, ...(NO_IMAGES ? {} : { "Ảnh OK": counts.images.OK, "Ảnh đã có": counts.images.SKIPPED, "Ảnh lỗi": counts.images.FAILED }) });

  if (failedImages.length > 0) {
    console.warn(`\n⚠ ${failedImages.length} sản phẩm chưa có ảnh (mất mạng hoặc CDN từ chối). Chạy lại \`npm run demo-data\` để tải bù:`);
    for (const name of failedImages) console.warn(`  - ${name}`);
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
