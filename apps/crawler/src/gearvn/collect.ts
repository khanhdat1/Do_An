/**
 * Thu thập dữ liệu demo từ GEARVN, ghi ra apps/crawler/data/demo-catalog.json.
 *
 *   npm run collect-demo                     tất cả danh mục theo CATEGORY_PLAN (cần mạng, ~5 phút)
 *   npm run collect-demo -- --only=cpu,ssd   chỉ vài danh mục (ghép vào file đã có, không mất phần khác)
 *   npm run collect-demo -- --dry-run        chỉ đọc trang danh sách, in số ứng viên, không tải trang sản phẩm
 *
 * Tôn trọng nguồn: robots.txt của GEARVN cho phép các đường dẫn /collections và /products; mọi
 * request đi qua getHtml (http.ts) nên cách nhau tối thiểu CRAWL_DELAY_MS (mặc định 1,5 giây),
 * tuần tự, kèm User-Agent tự khai báo là crawler học tập.
 */
import "dotenv/config";
import { getHtml } from "../http.js";
import { CATEGORY_PLAN, type CategoryPlan } from "./plan.js";
import { parseCollectionPage, parseProductPage, type ListingProduct } from "./rsc.js";
import { rankCandidates } from "./select.js";
import { readCatalog, writeCatalog, type Catalog, type CatalogItem } from "./snapshot.js";

const ORIGIN = "https://gearvn.com";

const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = process.argv
  .find((arg) => arg.startsWith("--only="))
  ?.slice("--only=".length)
  .toLowerCase()
  .split(",");

const nfc = (text: string) => text.normalize("NFC").replace(/\s+/g, " ").trim();

/** Thử lại một lần: lỗi mạng thoáng qua không nên làm mất cả sản phẩm */
async function fetchHtml(url: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await getHtml(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`      ! ${message} (${url}) lần ${attempt}/2`);
    }
  }
  return null;
}

async function readListings(plan: CategoryPlan): Promise<ListingProduct[]> {
  const bySlug = new Map<string, ListingProduct>();

  for (const collection of plan.collections) {
    for (let page = 1; page <= plan.pages; page++) {
      const html = await fetchHtml(`${ORIGIN}/collections/${collection}?page=${page}`);
      if (!html) continue;

      const products = parseCollectionPage(html);
      console.log(`    ${collection} trang ${page}: ${products.length} sản phẩm`);

      for (const product of products) {
        if (!bySlug.has(product.slug)) bySlug.set(product.slug, { ...product, name: nfc(product.name) });
      }

      // Trang chưa đầy (~20 sản phẩm) là trang cuối; 0 sản phẩm có thể là tên bộ sưu tập sai
      if (products.length < 15) break;
    }
  }

  return [...bySlug.values()];
}

async function collectCategory(plan: CategoryPlan, taken: Set<string>): Promise<CatalogItem[]> {
  console.log(`\n▶ ${plan.category} (cần ${plan.want})`);

  // `taken`: sản phẩm đã thuộc danh mục khác, để một sản phẩm không xuất hiện hai lần trong bộ demo
  const ranked = rankCandidates(await readListings(plan), plan).filter(
    (candidate) => !taken.has(`${ORIGIN}/products/${candidate.slug}`),
  );
  console.log(`    ${ranked.length} ứng viên hợp lệ sau khi lọc`);

  if (DRY_RUN) {
    for (const product of ranked.slice(0, plan.want)) {
      console.log(`      · ${product.name} — ${product.price.toLocaleString("vi-VN")}đ [${product.brand ?? "?"}]`);
    }
    return [];
  }

  const items: CatalogItem[] = [];

  for (const candidate of ranked) {
    if (items.length >= plan.want) break;

    const url = `${ORIGIN}/products/${candidate.slug}`;
    const html = await fetchHtml(url);
    if (!html) continue;

    const page = parseProductPage(html);
    const images = [...new Set([...(page.images.length > 0 ? page.images : []), ...(candidate.imageUrl ? [candidate.imageUrl] : [])])];

    // Trang thiếu bảng thông số hoặc ảnh thì mô tả sẽ nghèo nàn: nhường chỗ ứng viên kế
    if (page.attributes.length < 4 || images.length === 0) {
      console.log(`      – bỏ ${candidate.slug}: ${page.attributes.length} thuộc tính, ${images.length} ảnh`);
      continue;
    }

    const price = page.price ?? candidate.price;
    const listPrice = page.listPrice ?? candidate.originalPrice;

    items.push({
      category: plan.category,
      sourceUrl: url,
      name: nfc(page.name ?? candidate.name),
      brand: page.brand ?? candidate.brand,
      price,
      listPrice: listPrice !== null && listPrice > price ? listPrice : null,
      images,
      attributes: page.attributes.map((attribute) => ({
        ...attribute,
        label: nfc(attribute.label),
        value: nfc(attribute.value),
      })),
      highlights: candidate.highlights.map(nfc),
    });

    console.log(`      ✓ ${items.length}/${plan.want} ${candidate.name} — ${price.toLocaleString("vi-VN")}đ, ${images.length} ảnh, ${page.attributes.length} thuộc tính`);
  }

  if (items.length < plan.want) {
    console.log(`    ⚠ ${plan.category}: chỉ lấy được ${items.length}/${plan.want}`);
  }

  return items;
}

async function main() {
  const plans = CATEGORY_PLAN.filter((plan) => !ONLY || ONLY.includes(plan.category));
  if (plans.length === 0) {
    console.log(`Không có danh mục nào khớp --only=${ONLY?.join(",")}`);
    return;
  }

  // Ghép với file đã có: chạy lại một danh mục không làm mất các danh mục còn lại
  let previous: CatalogItem[] = [];
  try {
    previous = (await readCatalog()).products;
  } catch {
    // chưa có file thì bắt đầu mới
  }

  const rerun = new Set(plans.map((plan) => plan.category));
  const taken = new Set(previous.filter((item) => !rerun.has(item.category)).map((item) => item.sourceUrl));

  const collected = new Map<string, CatalogItem[]>();
  for (const plan of plans) {
    const items = await collectCategory(plan, taken);
    collected.set(plan.category, items);
    for (const item of items) taken.add(item.sourceUrl);
  }

  if (DRY_RUN) return;

  const products = CATEGORY_PLAN.flatMap((plan) => collected.get(plan.category) ?? previous.filter((item) => item.category === plan.category));

  const catalog: Catalog = {
    source: "GEARVN",
    // Ngày theo giờ máy (không dùng toISOString: nó tính theo UTC nên buổi sáng ở Việt Nam ra "hôm qua")
    collectedAt: new Date().toLocaleDateString("sv-SE"),
    note:
      "Bản chụp dữ liệu tham khảo (tên, giá, thông số, địa chỉ ảnh) thu thập từ gearvn.com để làm dữ liệu demo cho PCZone. " +
      "Giá chỉ mang tính tham khảo tại ngày thu thập. Phần mô tả bán hàng do PCZone tự viết, không lấy từ nguồn.",
    products,
  };

  await writeCatalog(catalog);

  const perCategory = Object.fromEntries(CATEGORY_PLAN.map((plan) => [plan.category, products.filter((item) => item.category === plan.category).length]));
  console.log("\n════════════ KẾT QUẢ ════════════");
  console.table(perCategory);
  console.log(`Tổng: ${products.length} sản phẩm → data/demo-catalog.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
