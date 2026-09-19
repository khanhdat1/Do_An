/**
 * Kiểm thử thuật toán so khớp. Chạy: npx tsx src/images/normalize.test.ts
 *
 * Mỗi ca kiểm thử dưới đây tương ứng một lỗi thật của code cũ.
 */
import { matchProduct, tokenize, type CatalogEntry } from "./normalize.js";

// Danh mục mô phỏng — trong thực tế dựng từ sitemap Gigabyte / trang ASRock
const ASROCK: CatalogEntry[] = [
  { model: "B760M Pro RS", url: "https://www.asrock.com/mb/Intel/B760M Pro RS/index.asp" },
  { model: "B760M Pro RS/D4", url: "https://www.asrock.com/mb/Intel/B760M Pro RS D4/index.asp" },
  { model: "B760M Steel Legend WiFi", url: "https://www.asrock.com/mb/Intel/B760M Steel Legend WiFi/index.asp" },
  { model: "B760M Steel Legend", url: "https://www.asrock.com/mb/Intel/B760M Steel Legend/index.asp" },
  { model: "X670E Taichi", url: "https://www.asrock.com/mb/AMD/X670E Taichi/index.asp" },
];

const GIGABYTE: CatalogEntry[] = [
  { model: "B760M GAMING X", url: "https://www.gigabyte.com/Motherboard/B760M-GAMING-X" },
  { model: "B760M GAMING X AX", url: "https://www.gigabyte.com/Motherboard/B760M-GAMING-X-AX" },
  { model: "B760M GAMING X AX DDR4", url: "https://www.gigabyte.com/Motherboard/B760M-GAMING-X-AX-DDR4" },
  { model: "GeForce RTX 4060 EAGLE OC 8G", url: "https://www.gigabyte.com/Graphics-Card/GV-N4060EAGLE-OC-8GD" },
];

let passed = 0;
let failed = 0;

function check(label: string, actual: string, expected: string) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    console.log(`      ${actual}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    console.log(`      mong đợi: ${expected}`);
    console.log(`      nhận được: ${actual}`);
    failed++;
  }
}

function describe(outcome: ReturnType<typeof matchProduct>): string {
  switch (outcome.status) {
    case "MATCHED":
      return (
        `MATCHED -> ${outcome.result.entry.model}` +
        (outcome.result.warning ? " [cần rà]" : "")
      );
    case "AMBIGUOUS":
      return `AMBIGUOUS [${outcome.candidates.join(" | ")}]`;
    case "NOT_FOUND":
      return "NOT_FOUND";
  }
}

console.log("\n── Tách token ──────────────────────────────────────────");
{
  const cases: [string, string][] = [
    ["Mainboard ASRock B760M Pro RS DDR5", "B760M,PRO,RS,DDR5"],
    ["Bo mạch chủ Gigabyte B760M GAMING X", "B760M,GAMING,X"],
    ["Mainboard Gigabyte B760M DS3H (rev. 1.0)", "B760M,DS3H"],
    ["VGA Gigabyte GeForce RTX 4060 EAGLE OC 8G", "GEFORCE,RTX,4060,EAGLE,OC,8G"],
  ];
  for (const [input, expected] of cases) {
    check(input, tokenize(input).join(","), expected);
  }
}

console.log("\n── Lỗi cũ 1: includes() nhận nhầm model dài hơn ────────");
{
  // Code cũ: normalize("B760M GAMING X AX").includes(normalize("B760M GAMING X")) == true
  //          -> lấy ảnh của bo AX gắn cho bo thường. Phải khớp đúng bo thường.
  const out = matchProduct("Mainboard Gigabyte B760M GAMING X", GIGABYTE);
  check("Tên shop ngắn không được ăn model dài hơn", describe(out), "MATCHED -> B760M GAMING X");
}

console.log("\n── Lỗi cũ 2: hậu tố shop thêm làm trượt hoàn toàn ──────");
{
  // Code cũ cắt cứng /\s+ddr5$/ nên chỉ đúng khi DDR5 nằm cuối.
  const out = matchProduct("Mainboard ASRock B760M Pro RS DDR5", ASROCK);
  check(
    "DDR5 là bản mặc định -> khớp B760M Pro RS, có cờ rà lại",
    describe(out),
    "MATCHED -> B760M Pro RS [cần rà]"
  );
}

console.log("\n── Biến thể DDR4 phải ra đúng bản /D4 ──────────────────");
{
  const out = matchProduct("Mainboard ASRock B760M Pro RS DDR4", ASROCK);
  check("DDR4 -> phải là bản D4, không phải bản gốc", describe(out), "MATCHED -> B760M Pro RS/D4");
}

console.log("\n── Ưu tiên model khớp được nhiều token nhất ────────────");
{
  const out = matchProduct("Mainboard ASRock B760M Steel Legend WiFi", ASROCK);
  check("Có WiFi -> chọn bản WiFi", describe(out), "MATCHED -> B760M Steel Legend WiFi");

  const out2 = matchProduct("Mainboard ASRock B760M Steel Legend", ASROCK);
  check("Không WiFi -> chọn bản thường", describe(out2), "MATCHED -> B760M Steel Legend");
}

console.log("\n── Không có trong danh mục thì nói không có ────────────");
{
  const out = matchProduct("Mainboard ASRock Z999 Imaginary", ASROCK);
  check("Model không tồn tại", describe(out), "NOT_FOUND");
}

console.log("\n── Card đồ hoạ dùng chung một thuật toán ───────────────");
{
  const out = matchProduct("VGA Gigabyte GeForce RTX 4060 EAGLE OC 8G", GIGABYTE);
  check("Không cần resolver riêng cho VGA", describe(out), "MATCHED -> GeForce RTX 4060 EAGLE OC 8G");
}

console.log("\n── Nhập nhằng thì từ chối, không đoán bừa ──────────────");
{
  const tricky: CatalogEntry[] = [
    { model: "Challenger Pro", url: "u1" },
    { model: "Pro Challenger", url: "u2" },
  ];
  const out = matchProduct("Mainboard ASRock Challenger Pro", tricky);
  check("Hai ứng viên ngang điểm -> AMBIGUOUS", describe(out), "AMBIGUOUS [Challenger Pro | Pro Challenger]");
}

console.log(`\n═══ Kết quả: ${passed} đạt, ${failed} trượt ═══\n`);
process.exit(failed > 0 ? 1 : 0);