/**
 * Thu thập dữ liệu demo từ GEARVN, ghi ra apps/crawler/data/demo-catalog.json.
 *
 *   npm run collect-demo                     bổ sung cho mọi danh mục đến đủ `want` trong CATEGORY_PLAN (cần mạng)
 *   npm run collect-demo -- --only=cpu,ssd   chỉ vài danh mục (các danh mục khác giữ nguyên)
 *   npm run collect-demo -- --fresh          bỏ dữ liệu cũ của các danh mục được chọn rồi thu thập lại từ đầu
 *   npm run collect-demo -- --dry-run        chỉ đọc trang danh sách, in số ứng viên, không tải trang sản phẩm
 *
 * Mặc định là chạy bổ sung: danh mục đã có sản phẩm thì giữ nguyên, chỉ lấy thêm phần còn thiếu so với
 * `want`. Nhờ vậy nâng số lượng trong plan.ts rồi chạy lại là đủ, và bị ngắt giữa chừng thì chạy lại
 * sẽ tiếp tục từ chỗ dừng (file được ghi lại sau mỗi sản phẩm).
 *
 * Tôn trọng nguồn: robots.txt của GEARVN cho phép các đường dẫn /collections và /products; mọi
 * request đi qua getHtml (http.ts) nên cách nhau tối thiểu CRAWL_DELAY_MS (mặc định 1,5 giây),
 * tuần tự, kèm User-Agent tự khai báo là crawler học tập.
 */
import "dotenv/config";
import { getHtml } from "../http.js";
import { CATEGORY_PLAN, type CategoryPlan } from "./plan.js";
import { parseCollectionPage, parseProductPage, type ListingProduct, type ProductAttribute } from "./rsc.js";
import { modelKey, rankCandidates } from "./select.js";
import { readCatalog, writeCatalog, type CatalogItem } from "./snapshot.js";
import { attributesFromLaptopTitle } from "./title-specs.js";

const ORIGIN = "https://gearvn.com";

const DRY_RUN = process.argv.includes("--dry-run");
const FRESH = process.argv.includes("--fresh");
const ONLY = process.argv
  .find((arg) => arg.startsWith("--only="))
  ?.slice("--only=".length)
  .toLowerCase()
  .split(",");

const nfc = (text: string) => text.normalize("NFC").replace(/\s+/g, " ").trim();
const productUrl = (slug: string) => `${ORIGIN}/products/${slug}`;

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

/** Trang danh sách đã đọc trong lần chạy này: nhiều danh mục dùng chung một bộ sưu tập thì chỉ tải một lần */
const listingCache = new Map<string, ListingProduct[]>();

async function readListingPage(collection: string, page: number): Promise<ListingProduct[]> {
  const url = `${ORIGIN}/collections/${collection}?page=${page}`;
  const cached = listingCache.get(url);
  if (cached) return cached;

  const html = await fetchHtml(url);
  const products = html ? parseCollectionPage(html) : [];
  if (html) listingCache.set(url, products);
  return products;
}

async function readListings(plan: CategoryPlan): Promise<ListingProduct[]> {
  const bySlug = new Map<string, ListingProduct>();

  for (const collection of plan.collections) {
    for (let page = 1; page <= plan.pages; page++) {
      const products = await readListingPage(collection, page);
      const before = bySlug.size;

      for (const product of products) {
        if (!bySlug.has(product.slug)) bySlug.set(product.slug, { ...product, name: nfc(product.name) });
      }
      console.log(`    ${collection} trang ${page}: ${products.length} sản phẩm, ${bySlug.size - before} mới`);

      // Trang chưa đầy (~20 sản phẩm) là trang cuối; 0 sản phẩm có thể là tên bộ sưu tập sai; trang không có
      // gì mới là nguồn trả lại trang cũ khi số trang vượt quá giới hạn
      if (products.length < 15 || bySlug.size === before) break;
    }
  }

  return [...bySlug.values()];
}

/** "Dung lượng RAM" và "RAM" là cùng một thông số */
const attributeKey = (label: string) => label.replace(/^Dung lượng /, "");

/**
 * Chọn bảng thông số cho một sản phẩm. Trang có bảng đủ dùng thì lấy bảng của nguồn (bổ sung các thông số
 * cốt lõi của laptop mà bảng bỏ sót); trang không có bảng mà tên laptop ghi đủ thông số thì đọc từ tên.
 */
function chooseAttributes(
  plan: CategoryPlan,
  name: string,
  highlights: string[],
  table: ProductAttribute[],
): { attributes: ProductAttribute[]; from?: "title" } {
  if (plan.titleSpecs !== "laptop") return { attributes: table };

  const fromTitle = attributesFromLaptopTitle(name, highlights);
  // Laptop gaming mà không rõ card đồ họa thì mô tả sẽ thiếu đúng thứ người mua quan tâm nhất
  const usable = fromTitle.length >= 5 && (plan.category !== "laptop-gaming" || fromTitle.some((entry) => entry.label === "Card đồ họa"));

  if (table.length >= (plan.minAttributes ?? 4)) {
    const have = new Set(table.map((entry) => attributeKey(entry.label)));
    return { attributes: usable ? [...table, ...fromTitle.filter((entry) => !have.has(attributeKey(entry.label)))] : table };
  }
  return usable ? { attributes: fromTitle, from: "title" } : { attributes: table };
}

async function collectOne(plan: CategoryPlan, candidate: ListingProduct): Promise<CatalogItem | null> {
  const url = productUrl(candidate.slug);
  const html = await fetchHtml(url);
  if (!html) return null;

  const page = parseProductPage(html);
  const images = [...new Set([...page.images, ...(candidate.imageUrl ? [candidate.imageUrl] : [])])];
  const name = nfc(page.name ?? candidate.name);

  const table = page.attributes.map((attribute) => ({ ...attribute, label: nfc(attribute.label), value: nfc(attribute.value) }));
  const { attributes, from } = chooseAttributes(plan, nfc(candidate.name), candidate.highlights, table);

  // Trang thiếu bảng thông số hoặc ảnh thì mô tả sẽ nghèo nàn: nhường chỗ ứng viên kế
  if (attributes.length < (plan.minAttributes ?? 4) || images.length === 0) {
    console.log(`      – bỏ ${candidate.slug}: ${attributes.length} thuộc tính, ${images.length} ảnh`);
    return null;
  }

  const price = page.price ?? candidate.price;
  const listPrice = page.listPrice ?? candidate.originalPrice;

  return {
    category: plan.category,
    sourceUrl: url,
    name,
    brand: page.brand ?? candidate.brand,
    price,
    listPrice: listPrice !== null && listPrice > price ? listPrice : null,
    images,
    attributes,
    ...(from ? { attributesFrom: from } : {}),
    highlights: candidate.highlights.map(nfc),
  };
}

async function main() {
  const plans = CATEGORY_PLAN.filter((plan) => !ONLY || ONLY.includes(plan.category));
  if (plans.length === 0) {
    console.log(`Không có danh mục nào khớp --only=${ONLY?.join(",")}`);
    return;
  }

  // Sản phẩm đã có theo từng danh mục: chạy lại một danh mục không làm mất các danh mục còn lại
  const byCategory = new Map<string, CatalogItem[]>();
  try {
    for (const item of (await readCatalog()).products) {
      byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);
    }
  } catch {
    // chưa có file thì bắt đầu mới
  }
  if (FRESH) for (const plan of plans) byCategory.set(plan.category, []);

  // Một sản phẩm không xuất hiện hai lần trong bộ demo, dù ở danh mục nào
  const taken = new Set([...byCategory.values()].flat().map((item) => item.sourceUrl));

  const save = () =>
    writeCatalog({
      source: "GEARVN",
      // Ngày theo giờ máy (không dùng toISOString: nó tính theo UTC nên buổi sáng ở Việt Nam ra "hôm qua")
      collectedAt: new Date().toLocaleDateString("sv-SE"),
      note:
        "Bản chụp dữ liệu tham khảo (tên, giá, thông số, địa chỉ ảnh) thu thập từ gearvn.com để làm dữ liệu demo cho PCZone. " +
        "Giá chỉ mang tính tham khảo tại ngày thu thập. Phần mô tả bán hàng do PCZone tự viết, không lấy từ nguồn.",
      products: CATEGORY_PLAN.flatMap((plan) => byCategory.get(plan.category) ?? []),
    });

  for (const plan of plans) {
    const items = byCategory.get(plan.category) ?? [];
    byCategory.set(plan.category, items);

    // Sản phẩm đã có nhưng không còn đạt mức tối thiểu của plan (plan được siết chặt sau lần thu thập trước): bỏ đi
    // để chạy bổ sung thay chúng bằng ứng viên tốt hơn
    const thin = items.filter((item) => item.attributes.length < (plan.minAttributes ?? 4));
    if (thin.length > 0 && !DRY_RUN) {
      console.log(`\n    bỏ ${thin.length} sản phẩm cũ có bảng thông số quá ngắn: ${thin.map((item) => item.name.slice(0, 40)).join("; ")}`);
      items.splice(0, items.length, ...items.filter((item) => !thin.includes(item)));
    }

    const missing = plan.want - items.length;
    console.log(`\n▶ ${plan.category}: đang có ${items.length}, cần ${plan.want}`);
    if (missing <= 0) {
      console.log("    đã đủ, bỏ qua");
      continue;
    }

    const known = new Set(items.map((item) => modelKey(item.name)));
    const ranked = rankCandidates(await readListings(plan), plan, known).filter((candidate) => !taken.has(productUrl(candidate.slug)));
    console.log(`    ${ranked.length} ứng viên hợp lệ chưa dùng (cần thêm ${missing})`);

    if (DRY_RUN) {
      for (const product of ranked.slice(0, missing)) {
        console.log(`      · ${product.name} — ${product.price.toLocaleString("vi-VN")}đ [${product.brand ?? "?"}]${product.inStock ? "" : " (hết hàng)"}`);
      }
      continue;
    }

    for (const candidate of ranked) {
      if (items.length >= plan.want) break;

      const item = await collectOne(plan, candidate);
      if (!item) continue;

      items.push(item);
      taken.add(item.sourceUrl);
      await save();

      console.log(
        `      ✓ ${items.length}/${plan.want} ${candidate.name.slice(0, 90)} — ${item.price.toLocaleString("vi-VN")}đ, ${item.images.length} ảnh, ${item.attributes.length} thuộc tính${item.attributesFrom ? " (đọc từ tên)" : ""}`,
      );
    }

    if (items.length < plan.want) console.log(`    ⚠ ${plan.category}: chỉ có ${items.length}/${plan.want} (hết ứng viên hợp lệ)`);
  }

  if (DRY_RUN) return;

  await save();

  const total = CATEGORY_PLAN.flatMap((plan) => byCategory.get(plan.category) ?? []).length;
  console.log("\n════════════ KẾT QUẢ ════════════");
  console.table(Object.fromEntries(CATEGORY_PLAN.map((plan) => [plan.category, `${byCategory.get(plan.category)?.length ?? 0}/${plan.want}`])));
  console.log(`Tổng: ${total} sản phẩm → data/demo-catalog.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
