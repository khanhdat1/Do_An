/**
 * Kiểm thử phần dựng dữ liệu demo (làm sạch thông số, đặt tên, thương hiệu, viết mô tả) trên bản chụp
 * data/demo-catalog.json, không cần mạng hay DB. Chạy: npx tsx src/demo/demo.test.ts
 *
 * Phần cuối duyệt TOÀN BỘ sản phẩm trong bản chụp và kiểm các bất biến mà DB và giao diện phụ thuộc
 * (độ dài cột, slug/SKU không trùng, không có chữ "undefined" lọt vào mô tả...), để sửa mẫu viết hoặc thu
 * thập lại dữ liệu mà lỗi nào lọt ra cũng bị bắt ngay.
 */
import fs from "node:fs";
import { SNAPSHOT_PATH, readImageBlocklist, type Catalog, type CatalogItem } from "../gearvn/snapshot.js";
import { toSlug } from "../utils.js";
import { Attrs, cleanValue, firstNumber, formatCapacity, toGigabytes } from "./attributes.js";
import { buildContent, hasBuilder } from "./content/index.js";
import { displayName, makeSku, pcParts, resolveBrand, stableFraction } from "./names.js";

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

const item = (category: string, name: string, extra: Partial<CatalogItem> = {}): CatalogItem => ({
  category,
  sourceUrl: `https://gearvn.com/products/${toSlug(name)}`,
  name,
  brand: null,
  price: 1_000_000,
  listPrice: null,
  images: ["https://cdn.hstatic.net/a.jpg"],
  attributes: [],
  highlights: [],
  ...extra,
});

console.log("\n[1] Làm sạch giá trị thông số");
{
  check("đơn vị GHz/MHz/W viết đúng", [cleanValue("4.2 Ghz"), cleanValue("6000Mhz"), cleanValue("125 w")], ["4.2 GHz", "6000 MHz", "125 W"]);
  check("bỏ ký hiệu ® ™", cleanValue("Intel® Core™ Ultra 9-386H"), "Intel Core Ultra 9-386H");
  check("đơn vị bị lặp", [cleanValue("24 MB KB"), cleanValue("1Gbps Gb/s")], ["24 MB", "1Gbps"]);
  check("khoảng trắng thừa quanh ngoặc, dấu phẩy và dấu chấm cuối", [cleanValue("AMD Ryzen 5 ( 3.3 GHz / 16MB )"), cleanValue("3 cell 42 Wh , Pin liền"), cleanValue("Aura Sync RGB (Logo)."), cleanValue("85 %")], ["AMD Ryzen 5 (3.3 GHz / 16MB)", "3 cell 42 Wh, Pin liền", "Aura Sync RGB (Logo)", "85%"]);
  check("dấu ; thành dấu phẩy", cleanValue("IPS; Chống chói;FHD"), "IPS, Chống chói, FHD");

  check("số đầu tiên trong chuỗi", [firstNumber("6000 MHz"), firstNumber("1,35 V"), firstNumber("không có")], [6000, 1.35, undefined]);
  check("dung lượng về GB", [toGigabytes("1000 GB"), toGigabytes("2 TB"), toGigabytes("512GB"), toGigabytes("n/a")], [1000, 2000, 512, undefined]);
  check("định dạng dung lượng", [formatCapacity(2000), formatCapacity(1000), formatCapacity(1024), formatCapacity(2048), formatCapacity(512), formatCapacity(256)], ["2 TB", "1 TB", "1 TB", "2 TB", "512 GB", "256 GB"]);

  const attrs = new Attrs([
    { label: "Socket", value: "AM5", highlight: false },
    { label: "Đồ họa tích hợp", value: "Không", highlight: false },
    { label: "RGB LED", value: "Có", highlight: false },
  ]);
  check("Attrs.get theo nhãn, ưu tiên mẫu đứng trước", [attrs.get(/^Socket$/), attrs.get(/^Nope$/, /^Socket$/), attrs.get(/^Nope$/)], ["AM5", "AM5", undefined]);
  check("Attrs.flag: Có/Không/không rõ", [attrs.flag(/^RGB LED$/), attrs.flag(/^Đồ họa tích hợp$/), attrs.flag(/^Socket$/)], [true, false, undefined]);
}

console.log("\n[2] Tên hiển thị");
{
  const cases: [string, string, string][] = [
    ["cpu", "Bộ vi xử lý AMD Ryzen 5 7500F / 3.7GHz Boost 5.0GHz / 6 nhân 12 luồng / 38MB / AM5 (Tray)", "CPU AMD Ryzen 5 7500F Tray"],
    ["cpu", "Bộ vi xử lý Intel Core Ultra 5 245KF / Turbo up to 5.2GHz / 14 Nhân 14 Luồng / 24MB / LGA 1851", "CPU Intel Core Ultra 5 245KF"],
    ["vga", "Card màn hình Gigabyte GeForce RTX 5060 Ti Windforce V2 Max OC 8GB (GV-N506TWF2MAX OC-8GD", "Card màn hình GIGABYTE GeForce RTX 5060 Ti Windforce V2 Max OC 8GB"],
    ["vga", "Card màn hình GIGABYTE GeForce RTX 5070 Ti WINDFORCE OC SFF 16G (GV-N507TWF3OC-16GD)", "Card màn hình GIGABYTE GeForce RTX 5070 Ti WINDFORCE OC SFF 16G"],
    ["laptop-gaming", 'Laptop gaming Acer Aspire 7 A715-59G-59RD (Core 5-210H/ RTX 3050 4GB/ 16GB/ 512GB/ 15.6" FHD/ Win 11)', "Laptop gaming Acer Aspire 7 A715-59G-59RD"],
    ["laptop-van-phong", 'Laptop Dell DC15250-5434BLK M4CFY (I5-1334U/ 8GB/ 512GB/ 15.6" FHD Touch/ Win 11) - Nhập Khẩu Chính Hãng', "Laptop Dell DC15250-5434BLK M4CFY"],
    ["laptop-van-phong", 'Laptop Asus Vivobook 14 X1404V (Core 5-120U/ 8GB/ 256GB/ 14" FHD/ Win 11)', "Laptop ASUS Vivobook 14 X1404V"],
    ["ram", "Ram Kingmax Blade X 1x16GB DDR4 Bus 3200Mhz", "RAM Kingmax Blade X 1x16GB DDR4 Bus 3200Mhz"],
    ["mainboard", "Bo Mạch Chủ Gigabyte A520M-K V2", "Bo mạch chủ GIGABYTE A520M-K V2"],
    ["mainboard", "Bo mạch chủ ASUS PRIME B760M-K (DDR5)", "Bo mạch chủ ASUS PRIME B760M-K (DDR5)"],
    ["case", "Vỏ máy tính ASUS ROG Hyperion GR701", "Vỏ case ASUS ROG Hyperion GR701"],
    ["psu", "Nguồn ASUS ROG THOR 1600T3 ATX 3.1, PCIe 5.0, 80 Plus Titanium, Full Modular (1600W)", "Nguồn máy tính ASUS ROG THOR 1600T3 ATX 3.1, PCIe 5.0, 80 Plus Titanium, Full Modular (1600W)"],
    ["ssd", "Ổ Cứng SSD Samsung 990 PRO 4TB M.2 PCIe Gen4 NVMe (MZ-V9P4T0BW)", "Ổ cứng SSD Samsung 990 PRO 4TB M.2 PCIe Gen4 NVMe"],
  ];
  for (const [category, source, expected] of cases) {
    check(`${category}: ${source.slice(0, 48)}…`, displayName(item(category, source)), expected);
  }

  const pc = item("pc-gaming", "PC GVN Intel i5-12400F/ VGA RTX 3050 (Main H)", {
    attributes: [
      { label: "CPU", value: "Intel Core i5-12400F", highlight: true },
      { label: "Card đồ họa", value: "RTX 3050 6GB", highlight: true },
    ],
  });
  check("PC gaming: tên lấy CPU + GPU, đổi nhãn cửa hàng", displayName(pc), "PC Gaming PCZone i5-12400F RTX 3050");
  const ws = item("pc-workstation", "PC GVN Intel i7-14700F/ VGA RTX 5070Ti (DDR5)", { attributes: [{ label: "CPU", value: "Intel Core I7-14700F", highlight: true }] });
  check("PC workstation: chuẩn hoá 5070Ti → 5070 Ti", displayName(ws), "PC Workstation PCZone i7-14700F RTX 5070 Ti");
}

console.log("\n[3] Bộ PC: tên máy là chuẩn khi bảng thông số ghi sai");
{
  const wrong = item("pc-workstation", "PC GVN Intel Core Ultra 7 265F/ VGA RTX 5080", {
    attributes: [
      { label: "CPU", value: "Intel Core Ultra 7 265KF", highlight: true },
      { label: "Card đồ họa", value: "RTX 5080 16GB", highlight: true },
    ],
  });
  check("bảng ghi 265KF nhưng tên máy là 265F → theo tên máy", pcParts(wrong), { cpu: "Intel Core Ultra 7 265F", gpu: "RTX 5080 16GB" });

  const right = item("pc-gaming", "PC GVN Intel i5-12400F/ VGA RTX 3050", {
    attributes: [
      { label: "CPU", value: "Intel Core i5-12400F", highlight: true },
      { label: "Card đồ họa", value: "RTX 3050 6GB", highlight: true },
    ],
  });
  check("bảng khớp tên → dùng cách viết đầy đủ của bảng", pcParts(right), { cpu: "Intel Core i5-12400F", gpu: "RTX 3050 6GB" });
}

console.log("\n[4] Thương hiệu");
{
  const brand = (category: string, name: string, raw: string | null = null) => resolveBrand(item(category, name, { brand: raw }))?.name ?? null;
  check("ROG thuộc ASUS ROG, TUF thuộc ASUS", [brand("man-hinh", "Màn hình ASUS ROG Swift PG27"), brand("man-hinh", "Màn hình ASUS TUF GAMING VG27AQ5F")], ["ASUS ROG", "ASUS"]);
  check("card đồ hoạ lấy hãng đối tác, không lấy NVIDIA/Intel", [brand("vga", "Card màn hình Zotac GeForce RTX 5080"), brand("vga", "Card màn hình SPARKLE Intel Arc B580 TWINSTAR", "Không thương hiệu")], ["Zotac", "Sparkle"]);
  check("CPU lấy AMD/Intel", [brand("cpu", "CPU AMD Ryzen 5 7500F"), brand("cpu", "CPU Intel Core Ultra 5 245KF")], ["AMD", "Intel"]);
  check("thông số trong ngoặc laptop không quyết định hãng", brand("laptop-gaming", "Laptop gaming Lenovo LOQ 15ARP10E (Ryzen 7 7735HS/ RTX 3050)"), "Lenovo");
  check("bộ PC bán dưới thương hiệu PCZone", brand("pc-gaming", "PC GVN Intel i5-12400F/ VGA RTX 3050", "GEARVN"), "PCZone");
  check("T-Group / TeamGroup gộp một hãng", [brand("ram", "Ram T-Group T-Force Delta 1x8GB"), brand("ram", "RAM TeamGroup Elite Plus")], ["TeamGroup", "TeamGroup"]);
  check("không nhận ra từ tên thì dùng hãng nguồn, trừ 'Không thương hiệu'", [brand("case", "Vỏ máy tính Foo Bar", "Foobar"), brand("case", "Vỏ máy tính Foo Bar", "Không thương hiệu")], ["Foobar", null]);
}

console.log("\n[5] Số giả lập ổn định");
{
  check("cùng chuỗi luôn ra cùng số", stableFraction("a") === stableFraction("a"), true);
  check("số nằm trong [0, 1)", [stableFraction("x"), stableFraction("y"), stableFraction("z")].every((v) => v >= 0 && v < 1), true);
  check("SKU cùng quy tắc seed: PCZ-<DANHMUC>-<HÃNG>-<HASH>", /^PCZ-CPU-AMD-[0-9A-F]{6}$/.test(makeSku("cpu", "amd", "cpu-amd-ryzen-7")), true);
}

console.log("\n[6] Duyệt toàn bộ bản chụp");
{
  const catalog = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8")) as Catalog;
  const products = catalog.products;

  check("bản chụp từ GEARVN, có ngày thu thập", [catalog.source, /^\d{4}-\d{2}-\d{2}$/.test(catalog.collectedAt)], ["GEARVN", true]);
  check("100–150 sản phẩm (cộng 14 mẫu seed ra khoảng 136)", products.length >= 100 && products.length <= 150, true);
  check("mọi danh mục trong bản chụp đều có mẫu nội dung", products.every((p) => hasBuilder(p.category)), true);
  check("URL nguồn không trùng", new Set(products.map((p) => p.sourceUrl)).size, products.length);
  check("mỗi sản phẩm có giá dương, ít nhất một ảnh https, bảng thông số ≥ 4 dòng", products.every((p) => p.price > 0 && p.images.length > 0 && p.images.every((u) => u.startsWith("https://")) && p.attributes.length >= 4), true);
  check("giá gốc (nếu có) cao hơn giá bán", products.every((p) => p.listPrice === null || p.listPrice > p.price), true);

  // Danh sách ảnh đã loại: mỗi địa chỉ phải còn nằm trong bản chụp (nếu không là mục cũ, nên dọn), và loại
  // xong sản phẩm nào cũng còn ít nhất một ảnh
  const blocked = await readImageBlocklist();
  const allUrls = new Set(products.flatMap((p) => p.images));
  check("mọi ảnh trong danh sách loại còn tồn tại trong bản chụp", [...blocked].filter((url) => !allUrls.has(url)), []);
  check("loại ảnh xong mọi sản phẩm vẫn còn ảnh", products.filter((p) => p.images.every((url) => blocked.has(url))).map((p) => p.name), []);

  const problems: string[] = [];
  const slugs = new Set<string>();
  const skus = new Set<string>();
  const BAD = [/undefined/, /\bNaN\b/, /\bnull\b/, /\[object/, /\(\s*\)/, /[ \t]{2,}/, /[ \t],/, /\.\./, /,\s*,/, /\(\s/, /\s\)/];

  for (const p of products) {
    const brand = resolveBrand(p);
    const name = displayName(p);
    const content = buildContent(p, name, brand?.name ?? null);
    const again = buildContent(p, name, brand?.name ?? null);
    const tag = `[${p.category}] ${name.slice(0, 50)}`;

    if (JSON.stringify(content) !== JSON.stringify(again)) problems.push(`${tag}: kết quả không ổn định giữa hai lần dựng`);
    if (name.length === 0 || name.length > 300) problems.push(`${tag}: tên dài ${name.length} (cột VarChar(300))`);
    if (/\(\s*$|\([^)]*$/.test(name)) problems.push(`${tag}: ngoặc bị cắt cụt trong tên`);

    const slug = toSlug(name);
    if (slugs.has(slug)) problems.push(`${tag}: slug trùng "${slug}" (loader sẽ thêm -2, nhưng tên nên khác nhau)`);
    slugs.add(slug);
    const sku = makeSku(p.category, brand?.slug, slug);
    if (skus.has(sku)) problems.push(`${tag}: SKU trùng ${sku}`);
    skus.add(sku);

    if (content.shortDescription.length === 0 || content.shortDescription.length > 500) problems.push(`${tag}: mô tả ngắn ${content.shortDescription.length} ký tự`);
    if (content.shortSpecs.length < 2 || content.shortSpecs.length > 6) problems.push(`${tag}: ${content.shortSpecs.length} chip`);
    if (content.shortSpecs.slice(0, 3).some((chip) => chip.length > 24)) problems.push(`${tag}: chip đầu quá dài cho thẻ sản phẩm: ${content.shortSpecs.slice(0, 3).join(" | ")}`);
    if (content.specifications.length < 5) problems.push(`${tag}: chỉ ${content.specifications.length} dòng thông số`);
    if (content.description.length < 1500) problems.push(`${tag}: mô tả chỉ ${content.description.length} ký tự`);
    if (!content.description.startsWith(`# ${name} Chính hãng`)) problems.push(`${tag}: tiêu đề bài mô tả không bắt đầu bằng tên sản phẩm`);
    if (!content.description.includes("## Dành cho ai?")) problems.push(`${tag}: thiếu mục "Dành cho ai?"`);

    const imageMarkers = [...content.description.matchAll(/^\[ảnh (\d+)/gm)].map((m) => Number(m[1]));
    if (imageMarkers.some((n) => n < 2 || n > 4)) problems.push(`${tag}: chỉ số ảnh ngoài 2–4: ${imageMarkers.join(",")}`);

    const texts: [string, string][] = [
      ["mô tả", content.description],
      ["mô tả ngắn", content.shortDescription],
      ...content.shortSpecs.map((s, i) => [`chip ${i}`, s] as [string, string]),
      ...content.specifications.map((r) => [`thông số ${r.label}`, `${r.label}: ${r.value}`] as [string, string]),
    ];
    for (const [where, text] of texts) {
      for (const pattern of BAD) if (pattern.test(text)) problems.push(`${tag}: ${where} khớp ${pattern}: …${text.match(pattern) ? text.slice(Math.max(0, (text.match(pattern)?.index ?? 0) - 25), (text.match(pattern)?.index ?? 0) + 35).replace(/\n/g, "⏎") : ""}…`);
    }
  }

  check(`không sản phẩm nào vi phạm bất biến (${products.length} sản phẩm)`, problems, []);
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
