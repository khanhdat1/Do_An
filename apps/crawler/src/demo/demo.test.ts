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
import { lowerList, warrantyMonths } from "./content/common.js";
import { buildContent, hasBuilder } from "./content/index.js";
import { cpuNote, gpuNote, memoryNote, screenNotes, storageNote } from "./content/laptop-notes.js";
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
    ["tai-nghe", "Tai Nghe Gaming Không Dây Predator Galea 550 (PHR235)", "Tai nghe Gaming Không Dây Predator Galea 550"],
    ["tai-nghe", "Tai nghe HP HYPERX Cloud Earbuds III S Black", "Tai nghe HyperX Cloud Earbuds III S Black"],
    ["loa", "Loa máy tính Edifier MR5 White", "Loa máy tính Edifier MR5 White"],
    ["ghe", "Ghế chơi game Warrior lmmortal Series WGC225 Xanh Navy", "Ghế chơi game Warrior Immortal Series WGC225 Xanh Navy"],
    ["ghe", "Ghế gaming Razer Iskur V2 X NewGen Quartz (RZ38-05311000-R3CA)", "Ghế gaming Razer Iskur V2 X NewGen Quartz"],
    ["ban", "Bàn CoolerMaster GD120 ARGB", "Bàn Cooler Master GD120 ARGB"],
    ["ban", "Bàn nâng hạ WARRIOR Duke Series WWT801 Grove Brown", "Bàn nâng hạ Warrior Duke Series WWT801 Grove Brown"],
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
  check("tai nghe 'HP HYPERX' bán dưới hãng HyperX chứ không phải HP", brand("tai-nghe", "Tai nghe HP HYPERX Cloud III Red", "HyperX"), "HyperX");
  check("loa Acoustic Energy (nguồn ghi hãng AERO) và loa Mitchell (nguồn không ghi hãng)", [brand("loa", "Loa Acoustic Energy Aego BT2", "AERO"), brand("loa", "Loa Active Mitchell Acoustic - uStream One", "Không thương hiệu")], ["Acoustic Energy", "Mitchell Acoustics"]);
  check("hãng ghế và bàn", [brand("ghe", "Ghế công thái học Sihoo M77C Xám"), brand("ghe", "Ghế chơi game Warrior Raider Series WGC207"), brand("ban", "Bàn CoolerMaster GD120 ARGB")], ["Sihoo", "Warrior", "Cooler Master"]);
}

console.log("\n[5] Số giả lập ổn định");
{
  check("cùng chuỗi luôn ra cùng số", stableFraction("a") === stableFraction("a"), true);
  check("số nằm trong [0, 1)", [stableFraction("x"), stableFraction("y"), stableFraction("z")].every((v) => v >= 0 && v < 1), true);
  check("SKU cùng quy tắc seed: PCZ-<DANHMUC>-<HÃNG>-<HASH>", /^PCZ-CPU-AMD-[0-9A-F]{6}$/.test(makeSku("cpu", "amd", "cpu-amd-ryzen-7")), true);
}

console.log("\n[6] Mẫu nội dung mới: tai nghe, ghế, bàn và ghi chú laptop");
{
  const attr = (label: string, value: string) => ({ label, value, highlight: false });

  // Tai nghe: bảo hành ghi số trần là số tháng; ô "Độ nhạy" điền nhầm dải tần bị bỏ; "40mm" → "40 mm"; dấu "..." bị bỏ
  const headset = item("tai-nghe", "Tai nghe Foo X", {
    attributes: [
      attr("Bảo hành", "24"),
      attr("Kiểu tai nghe", "Over-ear"),
      attr("Phương thức kết nối", "Wireless 2.4Ghz (USB Receiver), Bluetooth"),
      attr("Kích thước màng loa", "40mm"),
      attr("Độ nhạy", "70 Hz-20 KHz dB"),
      attr("Tương thích", "PC, PS5, Nintendo Switch..."),
      attr("Micro", "Có"),
      attr("Tính năng micro", "Micro thu âm đa hướng, Tháo rời"),
      attr("Thời lượng pin", "Bluetooth (25 giờ), Dongle (20 giờ)"),
    ],
  });
  const headsetContent = buildContent(headset, "Tai nghe Foo X", "Foo");
  const spec = (content: ReturnType<typeof buildContent>, label: string) => content.specifications.find((row) => row.label === label)?.value;
  check("tai nghe: bảo hành '24' là 24 tháng", headsetContent.warrantyMonths, 24);
  check("tai nghe: ô Độ nhạy chứa dải tần không lọt vào thông số", spec(headsetContent, "Độ nhạy"), undefined);
  check("tai nghe: '40mm' → '40 mm', bỏ dấu ba chấm", [spec(headsetContent, "Màng loa"), spec(headsetContent, "Tương thích")], ["40 mm", "PC, PS5, Nintendo Switch"]);
  check("tai nghe: chip trên thẻ ngắn, không có chữ 'Micro micro'", [headsetContent.shortSpecs.slice(0, 3).every((chip) => chip.length <= 24), /micro micro/i.test(headsetContent.description)], [true, false]);

  // Ghế: độ ngả lưng kèm lời quảng cáo chỉ giữ số độ; tay ghế 4D và trục Class 4 được giải thích
  const chair = item("ghe", "Ghế Foo", {
    attributes: [
      attr("Bảo hành", "12 tháng"),
      attr("Kiểu thiết kế", "Gaming"),
      attr("Độ ngả lưng", "152 độ (Reactive Seat Tilt - ngả lưng phản hồi theo trọng lượng)"),
      attr("Loại tay ghế", "4D"),
      attr("Loại trụ thủy lực", "Class 4"),
      attr("Tải trọng tối đa", "136 kg"),
    ],
  });
  const chairContent = buildContent(chair, "Ghế Foo", "Foo");
  check("ghế: độ ngả lưng chỉ còn số độ", spec(chairContent, "Độ ngả lưng"), "152°");
  check("ghế: tay ghế 4D chỉnh đủ bốn hướng, trục Class 4 là cấp cao nhất", [/nâng hạ độ cao, tiến\/lùi, trái\/phải và xoay góc/.test(chairContent.description), /Class 4, cấp cao nhất/.test(chairContent.description)], [true, true]);

  // Bàn: trang nguồn chỉ ghi vài dòng vẫn ra bài mô tả đủ dài, không có chữ "undefined"
  const thinDesk = item("ban", "Bàn Gaming Foo", { attributes: [attr("Bảo hành", "24 tháng"), attr("Kiểu thiết kế", "Bàn Gaming / Văn phòng"), attr("Màu sắc", "Đen"), attr("Tính năng đặc biệt", "Đèn LED RGB")] });
  const deskContent = buildContent(thinDesk, "Bàn Gaming Foo", "Foo");
  check("bàn ít thông số vẫn ra mô tả ≥ 1500 ký tự, không lỗi chữ", [deskContent.description.length >= 1500, /undefined|NaN/.test(deskContent.description)], [true, false]);

  const liftDesk = item("ban", "Bàn nâng hạ Foo", {
    attributes: [attr("Bảo hành", "12 tháng"), attr("Loại bàn", "Bàn nâng hạ (Có motor)"), attr("Kích thước mặt bàn", "140 x 60 x 1.6 cm"), attr("Độ cao bàn (Tùy chỉnh)", "71 - 119 cm"), attr("Tải trọng tối đa mặt bàn", "60 kg")],
  });
  const liftContent = buildContent(liftDesk, "Bàn nâng hạ Foo", "Foo");
  check("bàn nâng hạ: chip kích thước và độ cao", liftContent.shortSpecs.slice(0, 3), ["Nâng hạ điện", "140×60 cm", "Cao 71-119cm"]);

  check("số bảo hành trần: 24 tháng, 2 năm, có đơn vị, không có", [warrantyMonths("24", 12), warrantyMonths("2", 12), warrantyMonths("36 tháng", 12), warrantyMonths("5 năm", 12), warrantyMonths(undefined, 12)], [24, 24, 36, 60, 12]);
  check("lowerList hạ chữ đầu từng ý", lowerList("Gaming, Giải trí, Đàm thoại."), "gaming, giải trí, đàm thoại");
  check("cleanValue bỏ dấu ba chấm của nguồn", cleanValue("PC, Nintendo Switch..."), "PC, Nintendo Switch");

  const has = (text: string | undefined, pattern: RegExp) => pattern.test(text ?? "");
  check("cpuNote: HX mạnh nhất, Core Ultra có NPU, hậu tố U tiết kiệm điện", [has(cpuNote("AMD Ryzen 9 8940HX"), /HX là nhóm chip laptop mạnh nhất/), has(cpuNote("Intel Core Ultra 7 255H"), /NPU/), has(cpuNote("Intel Core 5 120U"), /tiết kiệm điện/)], [true, true, true]);
  check("cpuNote: chip không nhận ra → không bịa", cpuNote("Kirin X90"), undefined);
  check("gpuNote: RTX 5060 8GB nêu đời, phân khúc, bộ nhớ", [has(gpuNote("NVIDIA GeForce RTX 5060 8GB"), /Blackwell/), has(gpuNote("NVIDIA GeForce RTX 5060 8GB"), /tầm trung/), has(gpuNote("NVIDIA GeForce RTX 5060 8GB"), /8 GB/)], [true, true, true]);
  check("gpuNote: RTX 4050 là Ada Lovelace, đồ họa Radeon tích hợp thì không có ghi chú", [has(gpuNote("NVIDIA GeForce RTX 4050 6GB"), /Ada Lovelace/), gpuNote("AMD Radeon 780M")], [true, undefined]);
  check("screenNotes: 16\" WUXGA 165 Hz OLED", screenNotes("16 inch", "WUXGA (1920x1200)", "165 Hz", "OLED").map((note) => note.slice(0, 22)), ["Cỡ 16 inch rộng rãi, x", "Tỷ lệ 16:10 hiển thị t", "Tần số quét 165 Hz cho", "Tấm nền OLED cho màu đ"]);
  check("screenNotes: QHD+ không khẳng định tỷ lệ 16:10 vì nhãn này có cả 16:9", screenNotes(undefined, "QHD+", undefined, undefined).some((note) => note.includes("16:10")), false);
  check("memoryNote và storageNote theo mức dung lượng", [has(memoryNote("8 GB"), /học tập, văn phòng/), has(memoryNote("16 GB"), /cân bằng/), has(memoryNote("32 GB"), /dư dả/), has(storageNote("256 GB"), /nhanh đầy/), has(storageNote("512 GB"), /vài tựa game lớn/), has(storageNote("1 TB"), /rộng rãi/)], [true, true, true, true, true, true]);
}

console.log("\n[7] Duyệt toàn bộ bản chụp");
{
  const catalog = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8")) as Catalog;
  const products = catalog.products;

  check("bản chụp từ GEARVN, có ngày thu thập", [catalog.source, /^\d{4}-\d{2}-\d{2}$/.test(catalog.collectedAt)], ["GEARVN", true]);
  check("400–450 sản phẩm (cộng 14 mẫu seed ra khoảng 436)", products.length >= 400 && products.length <= 450, true);

  // Mục tiêu theo yêu cầu: nhóm Laptop 150 sản phẩm, nhóm Gaming Gear 150 sản phẩm (đã tính các mẫu trong seed.ts:
  // 3 laptop gaming, 1 chuột)
  const count = (...categories: string[]) => products.filter((p) => categories.includes(p.category)).length;
  check("Laptop: 147 sản phẩm demo + 3 mẫu seed = 150", count("laptop-gaming", "laptop-van-phong") + 3, 150);
  check("Gaming Gear: 149 sản phẩm demo + 1 mẫu seed = 150", count("ban-phim", "chuot", "tai-nghe", "loa", "ghe", "ban") + 1, 150);
  check("bốn danh mục Gaming Gear mới đều có sản phẩm", [count("tai-nghe") > 0, count("loa") > 0, count("ghe") > 0, count("ban") > 0], [true, true, true, true]);
  // Laptop đọc thông số từ tên phải có đủ CPU, RAM, ổ cứng; laptop gaming còn phải có card đồ họa
  const laptopSpecs = (p: CatalogItem) => new Attrs(p.attributes);
  check(
    "mọi laptop có CPU, RAM, SSD; laptop gaming có card đồ họa",
    products
      .filter((p) => p.category.startsWith("laptop"))
      .filter((p) => {
        const a = laptopSpecs(p);
        return !a.get(/^CPU$/) || !a.get(/^Dung lượng RAM$/, /^RAM$/) || !a.get(/^Dung lượng SSD$/, /^SSD$/) || (p.category === "laptop-gaming" && !a.get(/^Card đồ họa$/));
      })
      .map((p) => p.name),
    [],
  );
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
