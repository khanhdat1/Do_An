/**
 * Kiểm thử bộ đọc thông số laptop từ tên sản phẩm (title-specs.ts) bằng các tên thật của GEARVN, không cần mạng.
 * Chạy: npx tsx src/gearvn/title-specs.test.ts
 */
import { attributesFromLaptopTitle, normalizeCpu, normalizeGpu } from "./title-specs.js";

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

/** Danh sách "nhãn=giá trị" gọn để so sánh */
const flat = (name: string, highlights: string[] = []) =>
  attributesFromLaptopTitle(name, highlights).map((entry) => `${entry.label}=${entry.value}`);

console.log("\n[1] Laptop gaming: đủ CPU, card đồ họa, RAM, SSD, màn hình, hệ điều hành");
check(
  "ROG Strix: Ryzen 9-8940HX / RTX 5060 8GB / 16GB / 512GB / 16\" WQXGA 300Hz",
  flat('Laptop gaming ASUS ROG Strix G16 G614PM-TS147W (Ryzen 9-8940HX/ RTX 5060 8GB/ 16GB/ 512GB/ 16" WQXGA 300Hz/ Win 11)'),
  [
    "CPU=AMD Ryzen 9 8940HX",
    "Card đồ họa=NVIDIA GeForce RTX 5060 8GB",
    "Dung lượng RAM=16 GB",
    "Dung lượng SSD=512 GB",
    "Kích thước màn hình=16 inch",
    "Độ phân giải=WQXGA (2560x1600)",
    "Tần số quét=300 Hz",
    "Hệ điều hành=Windows 11",
  ],
);
check(
  "Intel Core i7 + card ghi kiểu GeForce RTX™",
  flat('Laptop gaming Gigabyte A16 CMHH2VN893SH (Core i5-13420H/ GeForce RTX™ 4050/ 16GB/ 512GB/ Win 11)'),
  ["CPU=Intel Core i5-13420H", "Card đồ họa=NVIDIA GeForce RTX 4050", "Dung lượng RAM=16 GB", "Dung lượng SSD=512 GB", "Hệ điều hành=Windows 11"],
);
check(
  "Panel, tần số quét và SSD 2TB",
  flat('Laptop gaming Acer Predator Helios Neo 16S PHN16S-71-95MS (Ultra 9-275HX/ RTX 5070 Ti 12GB/ 64GB/ 2TB/ 16.0" 2K+ IPS 180Hz/ Win 11)'),
  [
    "CPU=Intel Core Ultra 9 275HX",
    "Card đồ họa=NVIDIA GeForce RTX 5070 Ti 12GB",
    "Dung lượng RAM=64 GB",
    "Dung lượng SSD=2 TB",
    "Kích thước màn hình=16 inch",
    "Độ phân giải=2K+",
    "Tấm nền=IPS",
    "Tần số quét=180 Hz",
    "Hệ điều hành=Windows 11",
  ],
);

console.log("\n[2] Laptop văn phòng: không có card đồ họa rời");
check(
  "Core 5 120U, màn 14\" FHD IPS, DOS",
  flat('Laptop Dell 15 Pro Essential PV15250 VKVKD (I5-120U/ 16GB/ 512GB/ 14" FHD IPS/DOS) - Nhập Khẩu Chính Hãng'),
  [
    "CPU=Intel Core 5 120U",
    "Dung lượng RAM=16 GB",
    "Dung lượng SSD=512 GB",
    "Kích thước màn hình=14 inch",
    "Độ phân giải=Full HD (1920x1080)",
    "Tấm nền=IPS",
    "Hệ điều hành=DOS (chưa kèm Windows)",
  ],
);
check(
  "OLED 3K",
  flat('Laptop ASUS Zenbook 14 UX3405CA (Ultra 9-185H/ 32GB/ 1TB/ 14" 3K OLED 120Hz/ Win 11)').filter((row) => /^(Độ phân giải|Tấm nền|Tần số quét)/.test(row)),
  ["Độ phân giải=3K", "Tấm nền=OLED", "Tần số quét=120 Hz"],
);

console.log("\n[3] Chuẩn hoá CPU và GPU");
check("Core 5-210H", normalizeCpu("Core 5-210H"), "Intel Core 5 210H");
check("I7-13620H (model 5 chữ số giữ dạng i7)", normalizeCpu("I7-13620H"), "Intel Core i7-13620H");
check("I5-120U (model 3 chữ số = dòng Core 5)", normalizeCpu("I5-120U"), "Intel Core 5 120U");
check("Ultra 9-290HX Plus", normalizeCpu("Ultra 9-290HX Plus"), "Intel Core Ultra 9 290HX Plus");
check("Ultra X9 (Panther Lake)", normalizeCpu("Ultra X9"), "Intel Core Ultra X9");
check("Ryzen AI 7 350", normalizeCpu("Ryzen AI 7 350"), "AMD Ryzen AI 7 350");
check("Ryzen AI Max+ 392", normalizeCpu("Ryzen AI Max+ 392"), "AMD Ryzen AI Max+ 392");
check("Ryzen 5 40 (model cụt) → chỉ giữ dòng chip", normalizeCpu("Ryzen 5 40"), "AMD Ryzen 5");
check("QC X126100", normalizeCpu("QC X126100"), "Qualcomm Snapdragon X X1-26-100");
check("Chip lạ giữ nguyên chữ của nguồn", normalizeCpu("Kirin X90"), "Kirin X90");
check("RTX 5070 Ti", normalizeGpu("RTX 5070 Ti"), "NVIDIA GeForce RTX 5070 Ti");
check("RTX 4060 8GB", normalizeGpu("RTX 4060 8GB"), "NVIDIA GeForce RTX 4060 8GB");
check("Radeon RX 7600S", normalizeGpu("Radeon RX 7600S"), "AMD Radeon RX 7600S");
check("Không nhận ra card → undefined", normalizeGpu("Iris Xe"), undefined);

console.log("\n[4] Tên thiếu thông tin → không đoán");
check("Không có ngoặc thông số → rỗng", flat("Laptop gaming ASUS ROG Zephyrus G14 GA403WW QS136WS"), []);
check("Chỉ một dung lượng (không biết RAM hay SSD) → rỗng", flat("Laptop X (Core 5-210H/ 16GB/ Win 11)"), []);
check("Đầu ngoặc không phải CPU → rỗng", flat("Laptop X (Đen/ 16GB/ 512GB/ Win 11)"), []);
check(
  "Tên thiếu card đồ họa → lấy từ dòng nổi bật của trang danh sách",
  flat("Laptop gaming ASUS ROG Zephyrus Duo 16 GX651AX (Ultra 9-386H/ 64GB/ 2TB/ 16\" 3K OLED/ Win 11)", ["Ultra 9", "RTX 5090", "16 inch"]).filter((row) => row.startsWith("Card")),
  ["Card đồ họa=NVIDIA GeForce RTX 5090"],
);
check(
  "Tên thiếu cỡ màn hình → lấy từ dòng nổi bật",
  flat("Laptop gaming Acer Nitro ProPanel ANV16-72-782F (Core 7-240H/ RTX 5050/ 16GB/ 512GB/ Win 11)", ["16 inch"]).filter((row) => row.startsWith("Kích thước")),
  ["Kích thước màn hình=16 inch"],
);

console.log(`\nKết quả: ${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exitCode = 1;
