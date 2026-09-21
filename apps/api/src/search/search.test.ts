/**
 * Kiểm thử bộ máy tìm kiếm (text, giá, từ đồng nghĩa, khớp và xếp hạng, bộ lọc, gợi ý) bằng một kho sản phẩm giả
 * mô phỏng dữ liệu thật, không cần DB hay mạng. Chạy: npx tsx src/search/search.test.ts
 */
import {
  buildDoc,
  buildFacets,
  buildIndex,
  filterMatches,
  matchQuery,
  sortMatches,
  suggestBrands,
  suggestCategories,
  type DocInput,
} from "./engine.js";
import { parsePriceIntent } from "./price-intent.js";
import { synonymsOf } from "./synonyms.js";
import { compact, editDistance, fold, normalize, tokenize } from "./text.js";

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

console.log("\n[1] Chuẩn hoá chữ");
{
  check("bỏ dấu, chữ thường, đ → d", [normalize("Bàn phím cơ"), normalize("ĐEN"), normalize("Đồ họa")], ["ban phim co", "den", "do hoa"]);
  check("dấu decomposed (NFD, macOS) cho kết quả như dấu dựng sẵn", normalize("Bàn phím".normalize("NFD")), normalize("Bàn phím"));
  check("fold giữ nguyên độ dài và ký tự khác", [fold("Đồ họa 5.000đ").length, fold("Đồ họa 5.000đ")], ["Đồ họa 5.000đ".length, "do hoa 5.000d"]);
  check("số thập phân giữ dấu chấm, dấu phẩy thành dấu chấm", [normalize("15,6 inch"), normalize("USB 3.2 Gen 2"), normalize("1.000.000đ")], ["15.6 inch", "usb 3.2 gen 2", "1.000.000d"]);
  check("dấu câu thành dấu cách", normalize("Wi-Fi 7 (802.11be)"), "wi fi 7 802.11be");
  check("compact bỏ dấu cách và chấm", compact("RTX 5070 Ti"), "rtx5070ti");
}

console.log("\n[2] Tách từ khoá");
{
  check("bỏ dấu và từ đệm", tokenize("Laptop cho sinh viên"), ["laptop", "sinh", "vien"]);
  check("ghép số với đơn vị: 32 gb, 240 hz, 5070 ti", tokenize("ram 32 gb màn 240 hz rtx 5070 ti"), ["ram", "32gb", "man", "240hz", "rtx", "5070ti"]);
  check("không ghép khi từ trước không phải số", tokenize("tai nghe ti"), ["tai", "nghe", "ti"]);
  check("bỏ từ trùng, tối đa 8 từ", tokenize("a b c d e f g h i j a").length, 8);
  check("câu trống hoặc chỉ dấu câu → không có từ khoá", [tokenize("").length, tokenize("  ...  ").length], [0, 0]);
  check("từ 'đen' không bị coi là từ đệm", tokenize("chuột đen"), ["chuot", "den"]);
}

console.log("\n[3] Khoảng cách sửa lỗi gõ");
{
  check("thiếu chữ, đổi chữ, đổi chỗ hai chữ liền nhau đều là 1", [editDistance("razr", "razer", 2), editDistance("lapton", "laptop", 2), editDistance("lpatop", "laptop", 2)], [1, 1, 1]);
  check("vượt ngưỡng trả về ngưỡng + 1", [editDistance("chuot", "laptop", 2), editDistance("a", "abcdef", 2)], [3, 3]);
  check("giống hệt = 0", editDistance("razer", "razer", 2), 0);
}

console.log("\n[4] Hiểu ý định về giá");
{
  const p = (query: string) => {
    const intent = parsePriceIntent(query);
    return intent ? { min: intent.min, max: intent.max, label: intent.label, rest: intent.rest } : null;
  };
  check("dưới 30 triệu", p("laptop gaming dưới 30 triệu"), { min: undefined, max: 30_000_000, label: "Dưới 30 triệu", rest: "laptop gaming" });
  check("trên 20tr", p("laptop trên 20tr"), { min: 20_000_000, max: undefined, label: "Trên 20 triệu", rest: "laptop" });
  check("từ 10 đến 20 triệu", p("màn hình từ 10 đến 20 triệu"), { min: 10_000_000, max: 20_000_000, label: "Từ 10 triệu đến 20 triệu", rest: "màn hình" });
  check("từ 500k đến 2 triệu (đơn vị của mỗi đầu)", p("chuột từ 500k đến 2 triệu"), { min: 500_000, max: 2_000_000, label: "Từ 500 nghìn đến 2 triệu", rest: "chuột" });
  check("10-20 triệu", p("ssd 10-20 triệu"), { min: 10_000_000, max: 20_000_000, label: "Từ 10 triệu đến 20 triệu", rest: "ssd" });
  check("gõ ngược 20-10 triệu vẫn đúng chiều", p("ssd 20-10 triệu")?.min, 10_000_000);
  check("khoảng 15 triệu → ±20%", p("laptop khoảng 15 triệu"), { min: 12_000_000, max: 18_000_000, label: "Khoảng 15 triệu", rest: "laptop" });
  check("15tr đứng một mình cũng là ngân sách", p("laptop 15tr")?.label, "Khoảng 15 triệu");
  check("dưới 2,5 triệu (dấu phẩy thập phân)", p("chuột dưới 2,5 triệu")?.max, 2_500_000);
  check("dưới 500k, đơn vị k chỉ nhận sau từ chỉ giá", p("chuột dưới 500k")?.max, 500_000);
  check("số đầy đủ: dưới 5.000.000đ", p("laptop dưới 5.000.000đ")?.max, 5_000_000);
  check("giữ dấu của phần còn lại", p("Ghế công thái học dưới 3 triệu")?.rest, "Ghế công thái học");
  check("4k (độ phân giải) không phải giá", p("màn hình 4k"), null);
  check("16gb - 32gb không phải giá", p("ram 16gb - 32gb"), null);
  check("dưới 30 (không đơn vị, quá nhỏ) không phải giá", p("laptop dưới 30"), null);
  check("số trần 2023 không phải giá", p("từ 2023"), null);
  check("không có cụm giá → null", p("bàn phím cơ akko"), null);
}

console.log("\n[5] Từ đồng nghĩa");
{
  check("mouse ↔ chuột, vga ↔ card màn hình", [synonymsOf("mouse"), synonymsOf("vga")], [["chuot"], ["card man hinh", "card do hoa", "gpu"]]);
  check("từ không có nhóm → rỗng", synonymsOf("razer"), []);
}

/* -------------------------------------------------------------------------- */
/*  Kho giả                                                                   */
/* -------------------------------------------------------------------------- */

const gear = { slug: "gaming-gear", name: "Gaming Gear" };
const parts = { slug: "linh-kien", name: "Linh kiện máy tính" };
const laptop = { slug: "laptop", name: "Laptop" };

let counter = 0;
function product(input: Partial<DocInput> & Pick<DocInput, "name" | "categories">): DocInput {
  counter++;
  return {
    id: `p${String(counter).padStart(2, "0")}`,
    slug: `sp-${counter}`,
    price: 1_000_000,
    soldCount: 0,
    publishedAt: new Date(2026, 8, counter),
    inStock: true,
    brand: null,
    extraTexts: [],
    ...input,
  };
}

const logitech = { slug: "logitech", name: "Logitech" };
const razer = { slug: "razer", name: "Razer" };
const asus = { slug: "asus", name: "ASUS" };
const hyperx = { slug: "hyperx", name: "HyperX" };
const lg = { slug: "lg", name: "LG" };
const corsair = { slug: "corsair", name: "Corsair" };

const inputs: DocInput[] = [
  product({ name: "Chuột Logitech G Pro X Superlight 2", price: 3_500_000, soldCount: 120, brand: logitech, categories: [{ slug: "chuot", name: "Chuột" }, gear], extraTexts: ["Cảm biến HERO 2", "Không dây"] }),
  product({ name: "Chuột Razer DeathAdder V3 HyperSpeed", price: 2_400_000, soldCount: 80, brand: razer, categories: [{ slug: "chuot", name: "Chuột" }, gear] }),
  product({ name: "Bàn phím cơ AKKO 3068B Plus", price: 1_600_000, soldCount: 60, categories: [{ slug: "ban-phim", name: "Bàn phím" }, gear], extraTexts: ["Switch Cream Yellow", "Bluetooth"] }),
  product({ name: "Bàn phím Logitech G Pro X TKL", price: 3_000_000, soldCount: 20, brand: logitech, categories: [{ slug: "ban-phim", name: "Bàn phím" }, gear] }),
  // Bán chạy hơn hẳn bàn phím cơ AKKO: bỏ dấu thì "co" (cơ) khớp cả "có" nên nó đứng đầu, gõ có dấu "cơ" thì phải sau AKKO
  product({ name: "Bàn phím có dây Veekos K75", price: 590_000, soldCount: 500, categories: [{ slug: "ban-phim", name: "Bàn phím" }, gear] }),
  product({ name: "Tai nghe HyperX Cloud III Wireless", price: 3_200_000, soldCount: 40, brand: hyperx, categories: [{ slug: "tai-nghe", name: "Tai nghe" }, gear], extraTexts: ["Không dây 2.4GHz", "Tương thích: PC, Laptop, PS5"] }),
  product({ name: "Ghế công thái học Sihoo M57", price: 4_500_000, soldCount: 15, categories: [{ slug: "ghe", name: "Ghế" }, gear] }),
  product({ name: "Bàn nâng hạ Warrior WGT606 Pro", price: 4_000_000, soldCount: 5, categories: [{ slug: "ban", name: "Bàn" }, gear], extraTexts: ["Mặt bàn 140 x 60 cm"] }),
  product({ name: "Laptop gaming ASUS ROG Strix G16 G614PM", price: 45_000_000, soldCount: 12, brand: asus, categories: [{ slug: "laptop-gaming", name: "Laptop Gaming" }, laptop], extraTexts: ["RTX 5060", "16GB RAM", "1TB SSD", "Màn 16 inch 240Hz"] }),
  product({ name: "Laptop ASUS Zenbook 14 UX3405", price: 32_000_000, soldCount: 30, brand: asus, categories: [{ slug: "laptop-van-phong", name: "Laptop Văn phòng" }, laptop], extraTexts: ["Core Ultra 7", "OLED 14 inch"] }),
  product({ name: "Laptop gram LG 16Z90S", price: 38_000_000, soldCount: 10, brand: lg, categories: [{ slug: "laptop-van-phong", name: "Laptop Văn phòng" }, laptop] }),
  product({ name: "Card màn hình GIGABYTE GeForce RTX 5070 Ti WINDFORCE OC 16G", price: 28_000_000, soldCount: 8, categories: [{ slug: "vga", name: "VGA – Card đồ họa" }, parts] }),
  product({ name: "Card màn hình MSI GeForce RTX 5060 Ventus 2X 8G", price: 11_000_000, soldCount: 50, categories: [{ slug: "vga", name: "VGA – Card đồ họa" }, parts] }),
  product({ name: "RAM Corsair Vengeance RGB 32GB (2x16GB) DDR5 6000", price: 4_800_000, soldCount: 70, brand: corsair, categories: [{ slug: "ram", name: "RAM" }, parts], extraTexts: ["DDR5", "Bus 6000 MHz"] }),
  product({ name: "Ổ cứng SSD Samsung 990 Pro 1TB", price: 3_600_000, soldCount: 90, categories: [{ slug: "ssd", name: "Ổ cứng SSD" }, parts] }),
  product({ name: "Màn hình LG UltraGear 27GS95QE 27 inch OLED 240Hz", price: 16_000_000, soldCount: 25, brand: lg, categories: [{ slug: "man-hinh", name: "Màn hình" }], extraTexts: ["Tần số quét 240 Hz"] }),
  product({ name: "Màn hình ASUS TUF Gaming VG27AQ 27 inch 165Hz", price: 6_500_000, soldCount: 45, brand: asus, categories: [{ slug: "man-hinh", name: "Màn hình" }] }),
];

const docs = inputs.map(buildDoc);
const index = buildIndex(docs, [
  { slug: "chuot", name: "Chuột" },
  { slug: "ban-phim", name: "Bàn phím" },
  { slug: "tai-nghe", name: "Tai nghe" },
  { slug: "ghe", name: "Ghế" },
  { slug: "ban", name: "Bàn" },
  { slug: "gaming-gear", name: "Gaming Gear" },
  { slug: "laptop", name: "Laptop" },
  { slug: "laptop-gaming", name: "Laptop Gaming" },
  { slug: "vga", name: "VGA – Card đồ họa" },
  { slug: "ram", name: "RAM" },
  { slug: "ssd", name: "Ổ cứng SSD" },
  { slug: "laptop-van-phong", name: "Laptop Văn phòng" },
  { slug: "man-hinh", name: "Màn hình" },
]);

const nameOf = new Map(inputs.map((item) => [item.id, item.name]));
const names = (query: string, limit = 3) =>
  matchQuery(index, query)
    .matches.slice(0, limit)
    .map((item) => nameOf.get(item.doc.id));

console.log("\n[6] Khớp: không dấu, theo đầu từ, mã hàng");
{
  check("'ban phim co' ra các bàn phím có chữ co/cơ/có, không ra bàn nâng hạ", names("ban phim co", 5).sort(), ["Bàn phím có dây Veekos K75", "Bàn phím cơ AKKO 3068B Plus"]);
  check("có dấu hay không cho cùng tập kết quả", names("BÀN PHÍM CƠ", 5).sort(), names("ban phim co", 5).sort());
  check("bỏ dấu: 'có dây' bán chạy hơn nên đứng đầu (không phân biệt được cơ / có)", names("ban phim co", 1), ["Bàn phím có dây Veekos K75"]);
  check("gõ có dấu 'cơ': đúng dấu được ưu tiên dù bán ít hơn", names("bàn phím cơ", 1), ["Bàn phím cơ AKKO 3068B Plus"]);
  check("'ban' (bàn) ra cả bàn phím và bàn nâng hạ", matchQuery(index, "ban").matches.length, 4);
  check("'chuot' ra hai con chuột, bán chạy trước", names("chuot"), ["Chuột Logitech G Pro X Superlight 2", "Chuột Razer DeathAdder V3 HyperSpeed"]);
  check("'ram' không ra 'LG gram'", names("ram", 5), ["RAM Corsair Vengeance RGB 32GB (2x16GB) DDR5 6000"]);
  check("'rtx 5070' ra card 5070 Ti trước", names("rtx 5070", 2)[0], "Card màn hình GIGABYTE GeForce RTX 5070 Ti WINDFORCE OC 16G");
  check("'rtx5070ti' (viết liền) khớp 'RTX 5070 Ti'", names("rtx5070ti"), ["Card màn hình GIGABYTE GeForce RTX 5070 Ti WINDFORCE OC 16G"]);
  check("'5070 ti' (tách rời) khớp", names("5070 ti"), ["Card màn hình GIGABYTE GeForce RTX 5070 Ti WINDFORCE OC 16G"]);
  check("'32 gb' khớp '32GB' trong tên", names("ram 32 gb"), ["RAM Corsair Vengeance RGB 32GB (2x16GB) DDR5 6000"]);
  check("'240 hz' khớp cả '240Hz' trong tên lẫn '240 Hz' trong thông số", matchQuery(index, "240 hz").matches.map((item) => nameOf.get(item.doc.id)).sort(), [
    "Laptop gaming ASUS ROG Strix G16 G614PM",
    "Màn hình LG UltraGear 27GS95QE 27 inch OLED 240Hz",
  ]);
  check("mọi từ đều phải có: 'laptop gaming asus' chỉ ra máy gaming", names("laptop gaming asus"), ["Laptop gaming ASUS ROG Strix G16 G614PM"]);
  check("từ trong thông số (không có trong tên) cũng tìm được: 'bluetooth'", names("bluetooth"), ["Bàn phím cơ AKKO 3068B Plus"]);
}

console.log("\n[7] Từ nói về loại hàng / hãng chỉ tính khi khớp ở tên, hãng, danh mục");
{
  check("'laptop' không ra tai nghe chỉ vì thông số ghi 'dùng cho laptop'", matchQuery(index, "laptop").matches.length, 3);
  check("'ram' không ra laptop có '16GB RAM' trong thông số", names("ram", 5), ["RAM Corsair Vengeance RGB 32GB (2x16GB) DDR5 6000"]);
  check("từ không thuộc tên danh mục / hãng vẫn tìm được trong thông số: '16gb', 'ram' đi cùng 'ddr5'", [names("16gb"), names("ddr5")], [["RAM Corsair Vengeance RGB 32GB (2x16GB) DDR5 6000", "Laptop gaming ASUS ROG Strix G16 G614PM"], ["RAM Corsair Vengeance RGB 32GB (2x16GB) DDR5 6000"]]);
  check("'ssd' ra ổ cứng, không ra laptop có '1TB SSD'", names("ssd", 5), ["Ổ cứng SSD Samsung 990 Pro 1TB"]);
  check("'ssd 1tb' ra đúng ổ 1TB", names("ssd 1tb"), ["Ổ cứng SSD Samsung 990 Pro 1TB"]);
  check("từ đồng nghĩa cũng là từ nói về loại hàng: 'headphone' không ra laptop", names("headphone", 5), ["Tai nghe HyperX Cloud III Wireless"]);
}

console.log("\n[7b] Từ đồng nghĩa và danh mục");
{
  check("'mouse' = chuột", names("mouse", 2), names("chuot", 2));
  check("'vga' ra các card màn hình", matchQuery(index, "vga").matches.length, 2);
  check("'headphone' = tai nghe", names("headphone"), ["Tai nghe HyperX Cloud III Wireless"]);
  check("'màn hình' / 'monitor' chỉ ra màn hình, không ra 'card màn hình' (VGA)", [matchQuery(index, "man hinh").matches.length, matchQuery(index, "monitor").matches.length, names("card man hinh", 3).length], [2, 2, 2]);
  check("'monitor' = màn hình", names("monitor", 2), ["Màn hình ASUS TUF Gaming VG27AQ 27 inch 165Hz", "Màn hình LG UltraGear 27GS95QE 27 inch OLED 240Hz"]);
  check("'chair' = ghế", names("chair"), ["Ghế công thái học Sihoo M57"]);
  check("tên hãng: 'razer' chỉ ra hàng của Razer", names("razer"), ["Chuột Razer DeathAdder V3 HyperSpeed"]);
  check("'game' = gaming", matchQuery(index, "game").matches.length >= 2, true);
}

console.log("\n[8] Sửa lỗi gõ, từ không có trong kho, khớp gần đúng");
{
  const typo = matchQuery(index, "razr chuot");
  check("'razr' được sửa thành 'razer'", [typo.corrections, typo.terms, names("razr chuot")], [[{ from: "razr", to: "razer" }], ["razer", "chuot"], ["Chuột Razer DeathAdder V3 HyperSpeed"]]);
  const transposed = matchQuery(index, "lpatop");
  check("đổi chỗ hai chữ: 'lpatop' → 'laptop'", [transposed.corrections[0]?.to, transposed.matches.length], ["laptop", 3]);
  const ignored = matchQuery(index, "laptop zzzzz");
  check("từ không có trong kho bị bỏ qua thay vì làm cả câu ra trống", [ignored.ignored, ignored.matches.length], [["zzzzz"], 3]);
  check("chỉ toàn từ lạ → không có kết quả", [matchQuery(index, "zzzzz").matches.length, matchQuery(index, "zzzzz").hasKeywords], [0, true]);
  check("mã hàng gõ sai không bị 'sửa' sang sản phẩm khác: rtx 9999", [matchQuery(index, "rtx 9999").corrections, matchQuery(index, "rtx 9999").ignored], [[], ["9999"]]);
  const relaxed = matchQuery(index, "chuot hyperx");
  check("không sản phẩm nào có đủ hai từ → hạ xuống sản phẩm khớp một từ", [relaxed.relaxed, relaxed.matches.length >= 2], [true, true]);
  check("khớp đủ thì không đánh dấu relaxed", matchQuery(index, "chuot logitech").relaxed, false);
}

console.log("\n[9] Cụm giá trong câu tìm kiếm");
{
  const m = matchQuery(index, "laptop dưới 40 triệu");
  check("cụm giá được cắt khỏi từ khoá", [m.terms, m.priceIntent?.max, m.hasKeywords], [["laptop"], 40_000_000, true]);
  const only = matchQuery(index, "dưới 5 triệu");
  check("chỉ có cụm giá: duyệt mọi sản phẩm, bán chạy trước", [only.hasKeywords, only.matches.length, nameOf.get(only.matches[0].doc.id)], [false, docs.length, "Bàn phím có dây Veekos K75"]);
  check("câu trống không có kết quả", [matchQuery(index, "").matches.length, matchQuery(index, "   ").hasKeywords], [0, false]);
}

console.log("\n[10] Bộ lọc, sắp xếp, thành phần");
{
  const all = matchQuery(index, "logitech").matches;
  check("lọc theo danh mục cha: gaming-gear", filterMatches(all, { category: "gaming-gear" }).length, 2);
  check("lọc theo danh mục lá: ban-phim", filterMatches(all, { category: "ban-phim" }).map((item) => nameOf.get(item.doc.id)), ["Bàn phím Logitech G Pro X TKL"]);
  check("lọc theo hãng và khoảng giá", filterMatches(matchQuery(index, "gaming").matches, { brands: ["asus"], minPrice: 5_000_000, maxPrice: 10_000_000 }).map((item) => nameOf.get(item.doc.id)), ["Màn hình ASUS TUF Gaming VG27AQ 27 inch 165Hz"]);

  // Cả "Card màn hình" cũng chứa cụm "màn hình": lọc về đúng danh mục màn hình để so thứ tự
  const monitors = filterMatches(matchQuery(index, "man hinh").matches, { category: "man-hinh" });
  check("sắp xếp giá tăng / giảm", [sortMatches(monitors, "price-asc")[0].doc.price, sortMatches(monitors, "price-desc")[0].doc.price], [6_500_000, 16_000_000]);
  check("sắp xếp bán chạy", nameOf.get(sortMatches(monitors, "best-selling")[0].doc.id), "Màn hình ASUS TUF Gaming VG27AQ 27 inch 165Hz");
  check("sắp xếp mới nhất: sản phẩm thêm sau đứng trước", nameOf.get(sortMatches(monitors, "newest")[0].doc.id), "Màn hình ASUS TUF Gaming VG27AQ 27 inch 165Hz");

  const gaming = matchQuery(index, "gaming").matches;
  const facets = buildFacets(gaming, { brands: ["asus"] });
  check("thành phần danh mục đếm trên kết quả đã lọc hãng", facets.categories.map((item) => `${item.slug}:${item.count}`).sort(), ["laptop-gaming:1", "man-hinh:1"]);
  check("thành phần hãng KHÔNG bị chính bộ lọc hãng thu hẹp", facets.brands.map((item) => item.slug).sort(), [...new Set(gaming.flatMap((item) => (item.doc.brand ? [item.doc.brand.slug] : [])))].sort());
  check("khoảng giá tính trên kết quả đã lọc các thứ khác, bỏ qua bộ lọc giá", buildFacets(gaming, { minPrice: 40_000_000 }).priceRange?.min, Math.min(...gaming.map((item) => item.doc.price)));
  check("không có kết quả → priceRange null", buildFacets([], {}).priceRange, null);
}

console.log("\n[11] Gợi ý danh mục và hãng");
{
  check("'ghe' gợi ý danh mục Ghế", suggestCategories(index, ["ghe"], 3).map((item) => item.slug), ["ghe"]);
  check("'mouse' gợi ý danh mục Chuột nhờ từ đồng nghĩa", suggestCategories(index, ["mouse"], 3).map((item) => item.slug), ["chuot"]);
  check("'gaming' gợi ý các danh mục có chữ gaming, nhiều sản phẩm trước", suggestCategories(index, ["gaming"], 3).map((item) => item.slug), ["gaming-gear", "laptop-gaming"]);
  check("'raz' gợi ý hãng Razer", suggestBrands(index, ["raz"], 3).map((item) => item.slug), ["razer"]);
  check("không khớp → rỗng", [suggestCategories(index, ["xyz"], 3).length, suggestBrands(index, [], 3).length], [0, 0]);
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
