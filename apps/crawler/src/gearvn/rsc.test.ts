/**
 * Kiểm thử bộ đọc dữ liệu nhúng của GEARVN (rsc.ts) và bộ xếp hạng ứng viên (select.ts) bằng chuỗi mẫu,
 * không cần mạng. Chạy: npx tsx src/gearvn/rsc.test.ts
 */
import { CATEGORY_PLAN, type CategoryPlan } from "./plan.js";
import { findObjects, parseCollectionPage, parseProductPage, readRscText } from "./rsc.js";
import { rankCandidates } from "./select.js";
import type { ListingProduct } from "./rsc.js";

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}\n      mong đợi: ${e}\n      nhận được: ${a}`);
    failed++;
  }
}

/** Dựng HTML giống trang Next.js: dữ liệu RSC nằm trong các lời gọi self.__next_f.push([1,"..."]) */
const rscPage = (...chunks: string[]) =>
  `<html><body>${chunks.map((chunk) => `<script>self.__next_f.push([1,${JSON.stringify(chunk)}])</script>`).join("")}</body></html>`;

console.log("\n[1] readRscText / findObjects");
{
  const html = rscPage('a:{"id":"1","name":"X {lạ}"}', ',b:{"id":"2"}');
  const text = readRscText(html);
  check("ghép và bỏ escape các đoạn", text, 'a:{"id":"1","name":"X {lạ}"},b:{"id":"2"}');

  const objects = findObjects(text, '{"id":"');
  check("tìm đủ đối tượng, đếm ngoặc bỏ qua { } trong chuỗi", objects, [{ id: "1", name: "X {lạ}" }, { id: "2" }]);

  check("chuỗi không có đoạn nào → rỗng", readRscText("<html></html>"), "");
}

console.log("\n[2] parseCollectionPage");
{
  const products = [
    { id: "1", name: 'Màn hình VSP G2410QS 24" IPS', slug: "man-hinh-vsp", price: 3190000, originalPrice: 3590000, imageUrl: "https://cdn.hstatic.net/a.jpg", inStock: true, brand: "VSP", specHighlights: [{ label: "Kích thước", value: "24 inch" }, { value: "IPS" }, { value: "" }] },
    { id: "2", name: "Chuột hết hàng", slug: "chuot-het", price: 500000, imageUrl: "https://cdn.hstatic.net/b.jpg", inStock: false },
    { id: "3", name: "Trùng slug", slug: "man-hinh-vsp", price: 1, imageUrl: null },
    { id: "4", name: "Không có giá", slug: "khong-gia", imageUrl: "x" },
  ];
  // Đối tượng `id` khác (menu, banner) cũng có trong RSC nhưng không phải sản phẩm
  const noise = { id: "menu", label: "Trang chủ", slug: "home" };
  const html = rscPage(`0:${JSON.stringify(noise)}`, `1:${JSON.stringify({ products })}`);

  const parsed = parseCollectionPage(html);
  check("chỉ lấy đối tượng đủ dạng sản phẩm, bỏ trùng slug", parsed.map((p) => p.slug), ["man-hinh-vsp", "chuot-het"]);
  check("đọc đúng giá, giá gốc, còn hàng, hãng", [parsed[0].price, parsed[0].originalPrice, parsed[0].inStock, parsed[0].brand], [3190000, 3590000, true, "VSP"]);
  check("thông số nổi bật bỏ giá trị rỗng", parsed[0].highlights, ["24 inch", "IPS"]);
  check("thiếu giá gốc/hãng → null", [parsed[1].originalPrice, parsed[1].brand, parsed[1].inStock], [null, null, false]);
}

console.log("\n[3] parseProductPage");
{
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: 'Màn hình VSP G2410QS 24" IPS',
    sku: "MAN-VSP-G2410QS",
    brand: { "@type": "Brand", name: "VSP" },
    image: ["https://cdn.hstatic.net/1.jpg", "http://insecure/2.jpg", "https://cdn.hstatic.net/3.jpg"],
    offers: { "@type": "Offer", price: "3190000", availability: "https://schema.org/InStock", priceSpecification: { price: 3590000 } },
  };
  const attributes = [
    { label: "Tấm nền", value: "IPS", group_name: "Thông số", is_highlight: true },
    { label: "Tần số quét", value: "100 Hz", group_name: "Thông số", is_highlight: false },
    { label: "Tấm nền", value: "trùng nhãn", group_name: "Thông số" },
    { label: "Không nhóm", value: "bị bỏ" },
    { label: "Quảng cáo", value: "x".repeat(300), group_name: "Thông số" },
  ];
  const html = `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head>${rscPage(`9:${JSON.stringify({ attributes })}`)}</html>`;

  const page = parseProductPage(html);
  check("tên, hãng, sku", [page.name, page.brand, page.sku], ['Màn hình VSP G2410QS 24" IPS', "VSP", "MAN-VSP-G2410QS"]);
  check("giá bán, giá niêm yết, còn hàng", [page.price, page.listPrice, page.inStock], [3190000, 3590000, true]);
  check("chỉ nhận ảnh https", page.images, ["https://cdn.hstatic.net/1.jpg", "https://cdn.hstatic.net/3.jpg"]);
  check(
    "bảng thuộc tính: giữ thứ tự, bỏ nhãn trùng, bỏ thiếu nhóm, bỏ giá trị quá dài",
    page.attributes,
    [
      { label: "Tấm nền", value: "IPS", highlight: true },
      { label: "Tần số quét", value: "100 Hz", highlight: false },
    ],
  );

  const empty = parseProductPage("<html></html>");
  check("trang không có dữ liệu → giá trị rỗng, không lỗi", [empty.name, empty.price, empty.images.length, empty.attributes.length, empty.inStock], [null, null, 0, 0, false]);
}

console.log("\n[4] rankCandidates");
{
  const plan: CategoryPlan = {
    category: "man-hinh",
    want: 4,
    collections: ["x"],
    pages: 1,
    nameMatches: /^màn hình/i,
    nameExcludes: /cong/i,
    minPrice: 1_000_000,
    maxPrice: 20_000_000,
  };
  const make = (name: string, brand: string, price: number, inStock = true): ListingProduct => ({
    name,
    slug: name,
    imageUrl: "https://x/y.jpg",
    price,
    originalPrice: null,
    inStock,
    brand,
    highlights: [],
  });

  const ranked = rankCandidates(
    [
      make("Màn hình A1", "A", 2_000_000),
      make("Màn hình A2", "A", 2_100_000),
      make("Màn hình A3", "A", 2_200_000),
      make("Màn hình B1", "B", 3_000_000),
      make("Màn hình C1", "C", 4_000_000),
      make("Màn hình D1", "D", 5_000_000, false),
      make("Màn hình cong E1", "E", 3_000_000),
      make("Chuột F1", "F", 3_000_000),
      make("Màn hình G1", "G", 500_000),
      make("Màn hình H1", "H", 90_000_000),
      make("Màn hình Combo I1", "I", 3_000_000),
    ],
    plan,
  ).map((p) => p.name);

  check("lọc theo tên, khoảng giá, loại combo/nameExcludes", ranked.includes("Màn hình cong E1") || ranked.includes("Chuột F1") || ranked.includes("Màn hình G1") || ranked.includes("Màn hình H1") || ranked.includes("Màn hình Combo I1"), false);
  check("xoay vòng theo hãng, hàng còn trước hàng hết", ranked, ["Màn hình A1", "Màn hình B1", "Màn hình C1", "Màn hình A2", "Màn hình A3", "Màn hình D1"]);
}

console.log("\n[5] Kế hoạch thu thập");
{
  const total = CATEGORY_PLAN.reduce((sum, plan) => sum + plan.want, 0);
  check("tổng số sản phẩm mục tiêu nằm trong 100–150 (chưa tính 14 mẫu seed)", total >= 100 && total <= 150, true);
  check("mỗi danh mục có ít nhất một bộ sưu tập và khoảng giá hợp lệ", CATEGORY_PLAN.every((plan) => plan.collections.length > 0 && plan.minPrice < plan.maxPrice), true);
  check("không danh mục nào trùng slug", new Set(CATEGORY_PLAN.map((plan) => plan.category)).size, CATEGORY_PLAN.length);
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
