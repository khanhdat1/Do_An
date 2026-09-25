// Kiểm thử bộ đọc thông số bằng đúng chuỗi thật lấy từ DB — không cần DB hay mạng. Chạy: npx tsx src/pc-build/spec-parser.test.ts
import type { Prisma } from "@pczone/db";
import type { BuildSlot } from "./slots.js";
import {
  normalizeBoardSize,
  normalizeChipset,
  normalizeRamType,
  normalizeSocket,
  normalizeStorageFormFactor,
  normalizeStorageInterface,
  parseCaseFormFactors,
  parseCpuPower,
  parseGb,
  parseGpuLengthMm,
  parseProductSpec,
  parseSlotWidth,
  parseWatts,
} from "./spec-parser.js";
import { emptySpec, type NormalizedSpec } from "./spec-types.js";

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

/** Dạng mảng [{label, value}] như sản phẩm GEARVN/SEED trong DB */
function rows(entries: Record<string, string>): Prisma.JsonValue {
  return Object.entries(entries).map(([label, value]) => ({ label, value }));
}

/** So TOÀN BỘ kết quả, không chỉ các trường mong đợi — bắt cả trường bị điền nhầm */
function expectSpec(label: string, componentType: BuildSlot, name: string, specifications: Prisma.JsonValue | null, expected: Partial<NormalizedSpec>) {
  check(label, parseProductSpec({ componentType, name, specifications }), { ...emptySpec(), ...expected });
}

console.log("\n[1] Socket / loại RAM / chipset");
{
  check('"LGA 1700" -> "LGA1700"', normalizeSocket("LGA 1700"), "LGA1700");
  check('"LGA 1851" -> "LGA1851"', normalizeSocket("LGA 1851"), "LGA1851");
  check('"AM5" giữ nguyên', normalizeSocket("AM5"), "AM5");
  check(
    "socket nằm trong câu tiếng Anh dài (KCCSHOP)",
    normalizeSocket("- Supports 14 th , 13 th & 12 th Gen Intel ® Core™ Processors (LGA1700) - Supports Intel ® Hybrid Technology -"),
    "LGA1700",
  );
  check("không có socket -> null", normalizeSocket("Intel Core thế hệ 14"), null);
  check('"DDR5-5200, tối đa 128GB" -> DDR5', normalizeRamType("DDR5-5200, tối đa 128GB"), "DDR5");
  check('"DDR4, 2 khe, tối đa 64 GB" -> DDR4', normalizeRamType("DDR4, 2 khe, tối đa 64 GB"), "DDR4");
  check('"AMD B650" -> B650', normalizeChipset("AMD B650"), "B650");
  check('"- Intel ® B760" (KCCSHOP) -> B760', normalizeChipset("- Intel ® B760"), "B760");
}

console.log("\n[2] Cỡ bo mạch — mọi cách ghi có thật trong DB");
{
  check('mainboard "Micro-ATX" -> mATX', normalizeBoardSize("Micro-ATX"), "mATX");
  check('mainboard "ATX" -> ATX', normalizeBoardSize("ATX"), "ATX");
  check('"Micro-ATX, Mini-ITX"', parseCaseFormFactors("Micro-ATX, Mini-ITX"), ["mATX", "ITX"]);
  check(
    "bỏ phần trong ngoặc, xếp lớn -> nhỏ",
    parseCaseFormFactors("ITX, Micro-ATX, ATX (khi không lắp tản nhiệt dưới)"),
    ["ATX", "mATX", "ITX"],
  );
  check('chỉ ghi "ATX" trơn', parseCaseFormFactors("ATX"), ["ATX"]);
  check('chỉ ghi "E-ATX" trơn', parseCaseFormFactors("E-ATX"), ["E-ATX"]);
  check('lỗi gõ "Micro-TX" vẫn là mATX', parseCaseFormFactors("E-ATX, ATX, Micro-TX, Mini-ITX"), ["E-ATX", "ATX", "mATX", "ITX"]);
  check('"Mini iTX, m-ATX" (thứ tự ngược)', parseCaseFormFactors("Mini iTX, m-ATX, ATX, E-ATX"), ["E-ATX", "ATX", "mATX", "ITX"]);
  check('"M-ATX"', parseCaseFormFactors("E-ATX, ATX, M-ATX, Mini-ITX"), ["E-ATX", "ATX", "mATX", "ITX"]);
  check("thứ tự lộn xộn", parseCaseFormFactors("E-ATX, Micro-ATX, Mini-ITX, ATX"), ["E-ATX", "ATX", "mATX", "ITX"]);
  check("không nhận ra cỡ nào -> null", parseCaseFormFactors("Mid Tower"), null);
}

console.log("\n[3] Công suất, kích thước, dung lượng");
{
  check('CPU "125 W (tối đa 250 W)"', parseCpuPower("125 W (tối đa 250 W)"), { tdp: 125, max: 250 });
  check('CPU "120W" (không có mức tối đa)', parseCpuPower("120W"), { tdp: 120, max: null });
  check('"750W trở lên" -> 750', parseWatts("750W trở lên"), 750);
  check('"White" trong tên không phải số oát', parseWatts("Corsair RM1200x SHIFT White ATX 3.1 - 80 Plus Gold (1200W)"), 1200);
  check("số thập phân, làm tròn lên", parseGpuLengthMm("357.6 x 149.3 x 76 mm"), 358);
  check("chiều dài không đứng đầu -> lấy số lớn nhất", parseGpuLengthMm("199 x 40 x 116 mm"), 199);
  check("bỏ phần trong ngoặc", parseGpuLengthMm("305 x 138 x 65mm (chiếm 3.25 khe)"), 305);
  check("không có số hợp lệ -> null", parseGpuLengthMm("2 quạt"), null);
  check('"3 quạt, 3.8 slot" -> 3.8', parseSlotWidth("3 quạt, 3.8 slot"), 3.8);
  check('"(chiếm 3.25 khe)" -> 3.3', parseSlotWidth(null, "305 x 138 x 65mm (chiếm 3.25 khe)"), 3.3);
  check("không ghi số khe -> null", parseSlotWidth("WINDFORCE 3 quạt"), null);
  check('"1 TB" -> 1000 GB', parseGb("1 TB"), 1000);
  check('"16GB GDDR6X, 21 Gbps" -> 16 (không nhầm Gbps)', parseGb("16GB GDDR6X, 21 Gbps, bus 256-bit"), 16);
}

console.log("\n[4] Chuẩn SSD");
{
  check('"NVMe PCIe Gen 4.0 x4"', normalizeStorageInterface("NVMe PCIe Gen 4.0 x4"), "NVMe PCIe 4.0 x4");
  check("chuỗi 31 ký tự gộp form factor", normalizeStorageInterface("M.2 2280, NVMe 2.0 PCIe 4.0 x4"), "NVMe PCIe 4.0 x4");
  check("form factor lẫn trong dòng chuẩn kết nối", normalizeStorageFormFactor("M.2 2280, NVMe 2.0 PCIe 4.0 x4"), "M.2 2280");
}

console.log("\n[5] Sản phẩm thật, từng loại");
{
  expectSpec(
    "CPU Intel Core Ultra 7 265K",
    "CPU",
    "CPU Intel Core Ultra 7 265K",
    rows({
      Socket: "LGA 1851",
      "Số nhân / luồng": "20 nhân / 20 luồng (8 P-core + 12 E-core)",
      "Xung nhịp": "Cơ bản 3.9 GHz, tối đa 5.5 GHz",
      "Bộ nhớ đệm": "30 MB",
      TDP: "125 W (tối đa 250 W)",
      "Đồ họa tích hợp": "Intel Graphics",
      "Bộ nhớ hỗ trợ": "DDR5, tối đa 6400 MHz, 2 kênh",
    }),
    {
      socket: "LGA1851",
      cpuCores: 20,
      cpuThreads: 20,
      baseClock: 3.9,
      boostClock: 5.5,
      hasIgpu: true,
      ramType: "DDR5",
      tdpWatts: 125,
      extra: { maxPowerW: 250 },
    },
  );

  expectSpec(
    'CPU AMD Ryzen 5 8400F — "Không có (cần card đồ họa rời)" -> không có iGPU',
    "CPU",
    "CPU AMD Ryzen 5 8400F",
    rows({
      Socket: "AM5",
      "Số nhân / luồng": "6 nhân / 12 luồng",
      "Xung nhịp": "Cơ bản 4.2 GHz, tối đa 4.7 GHz",
      TDP: "65 W",
      "Đồ họa tích hợp": "Không có (cần card đồ họa rời)",
      "Bộ nhớ hỗ trợ": "DDR5, tối đa 5200 MHz, 2 kênh",
    }),
    { socket: "AM5", cpuCores: 6, cpuThreads: 12, baseClock: 4.2, boostClock: 4.7, hasIgpu: false, ramType: "DDR5", tdpWatts: 65 },
  );

  expectSpec(
    'CPU Ryzen 7 7800X3D bản "Box" (nguồn SEED) — ghi rõ không kèm tản nhiệt',
    "CPU",
    "CPU AMD Ryzen 7 7800X3D Box Chính Hãng",
    rows({
      Socket: "AM5",
      "Số nhân / luồng": "8 nhân, 16 luồng",
      "Xung nhịp": "Cơ bản 4.2GHz, tối đa 5.0GHz",
      TDP: "120W",
      "Bộ nhớ hỗ trợ": "DDR5-5200, tối đa 128GB",
      "Đồ họa tích hợp": "AMD Radeon (2 nhân)",
      "Tản nhiệt kèm theo": "Không (cần mua riêng)",
    }),
    {
      socket: "AM5",
      cpuCores: 8,
      cpuThreads: 16,
      baseClock: 4.2,
      boostClock: 5,
      hasIgpu: true,
      ramType: "DDR5",
      tdpWatts: 120,
      extra: { coolerIncluded: false },
    },
  );

  expectSpec(
    "Mainboard GIGABYTE Z790 EAGLE AX DDR5",
    "MAINBOARD",
    "Bo mạch chủ GIGABYTE Z790 EAGLE AX DDR5",
    rows({
      Chipset: "Intel Z790",
      Socket: "LGA 1700",
      "Kích thước (form factor)": "ATX",
      "CPU hỗ trợ": "Intel Core thế hệ 12, 13, 14",
      "Bộ nhớ": "DDR5, 4 khe, tối đa 256 GB",
    }),
    { socket: "LGA1700", chipset: "Z790", ramType: "DDR5", ramSlots: 4, maxRamGb: 256, formFactor: "ATX" },
  );

  expectSpec(
    "Mainboard MSI B450M-A PRO MAX II (2 khe)",
    "MAINBOARD",
    "Bo mạch chủ MSI B450M-A PRO MAX II",
    rows({ Chipset: "AMD B450", Socket: "AM4", "Kích thước (form factor)": "Micro-ATX", "Bộ nhớ": "DDR4, 2 khe, tối đa 64 GB" }),
    { socket: "AM4", chipset: "B450", ramType: "DDR4", ramSlots: 2, maxRamGb: 64, formFactor: "mATX" },
  );

  expectSpec(
    "Mainboard KCCSHOP dạng object tiếng Anh — không ghi form factor thì để null, không suy từ chữ M trong tên",
    "MAINBOARD",
    "Mainboard ASRock B760M Pro RS DDR5",
    {
      CPU: "- Supports 14 th , 13 th & 12 th Gen Intel ® Core™ Processors (LGA1700) - Supports Intel ® Hybrid Technology",
      Memory:
        "- Dual Channel DDR5 Memory Technology - 4 x DDR5 DIMM Slots - Supports DDR5 non-ECC, un-buffered memory up to 7200+(OC) - Max. capacity of system memory: 256GB - Supports Intel ® Extreme Memory Profile (XMP) 3.0",
      Chipset: "- Intel ® B760",
    },
    { socket: "LGA1700", chipset: "B760", ramType: "DDR5", ramSlots: 4, maxRamGb: 256 },
  );

  expectSpec(
    "RAM kit 2 thanh",
    "RAM",
    "RAM Corsair Dominator Titanium Black 32GB (2x16GB) RGB 6000 DDR5",
    rows({ "Dung lượng": "32 GB (2 x 16 GB)", "Loại RAM": "DDR5", "Tốc độ (Bus)": "6000 MHz", "Chế độ kênh": "Dual Channel (kit nhiều thanh)" }),
    { ramType: "DDR5", ramSpeed: 6000, ramCapacity: 32, ramModules: 2 },
  );

  expectSpec(
    'RAM nguồn SEED — nhãn "Tốc độ", đơn vị MT/s',
    "RAM",
    "RAM Corsair Vengeance RGB DDR5 32GB 6000MHz",
    rows({ "Dung lượng": "32GB (2 x 16GB)", "Loại RAM": "DDR5", "Tốc độ": "6000MT/s (PC5-48000)" }),
    { ramType: "DDR5", ramSpeed: 6000, ramCapacity: 32, ramModules: 2 },
  );

  expectSpec(
    'RAM 1 thanh không ghi tốc độ — không lấy số "3200" trong tên',
    "RAM",
    "RAM Kingston Fury 1x8GB 3200 Beast",
    rows({ "Dung lượng": "8 GB", "Loại RAM": "DDR4", "Chế độ kênh": "Single Channel (một thanh)" }),
    { ramType: "DDR4", ramCapacity: 8, ramModules: 1 },
  );

  expectSpec(
    "VGA ASUS ROG Astral RTX 5080",
    "VGA",
    "Card màn hình ASUS ROG Astral GeForce RTX 5080 16GB GDDR7 OC Edition",
    rows({
      "Bộ nhớ": "16 GB GDDR7, 256-bit",
      "Công suất (TDP)": "340 W",
      "Tản nhiệt": "3 quạt, 3.8 slot",
      "Kích thước card": "357.6 x 149.3 x 76 mm",
    }),
    { vramGb: 16, gpuLengthMm: 358, gpuSlotWidth: 3.8, tdpWatts: 340 },
  );

  expectSpec(
    'VGA nguồn SEED — nhãn "Kích thước"/"Nguồn cấp"/"Nguồn khuyến nghị"',
    "VGA",
    "Card màn hình ASUS TUF RTX 4070 Ti SUPER",
    rows({
      "Bộ nhớ": "16GB GDDR6X, 21 Gbps, bus 256-bit",
      "Kích thước": "305 x 138 x 65mm (chiếm 3.25 khe)",
      "Nguồn cấp": "1 x 16-pin",
      "Nguồn khuyến nghị": "750W trở lên",
      "Làm mát": "3 quạt Axial-tech",
    }),
    { vramGb: 16, gpuLengthMm: 305, gpuSlotWidth: 3.3, gpuPowerPins: "1 x 16-pin", extra: { recommendedPsuW: 750 } },
  );

  expectSpec(
    "VGA không ghi kích thước -> độ dài null (không đoán)",
    "VGA",
    "Card màn hình SPARKLE Intel Arc B580 TWINSTAR OC 12GB GDDR6",
    rows({
      "Bộ nhớ": "12 GB GDDR6, 192-bit",
      "Đầu cấp nguồn": "1 x 8-pin",
      "Công suất (TDP)": "200 W",
      "Nguồn đề xuất": "650 W",
      "Tản nhiệt": "2 quạt, 2 slot",
    }),
    { vramGb: 12, gpuSlotWidth: 2, gpuPowerPins: "1 x 8-pin", tdpWatts: 200, extra: { recommendedPsuW: 650 } },
  );

  expectSpec(
    "SSD 1 TB",
    "SSD",
    "Ổ cứng SSD Corsair MP600 CORE XT 1TB PCIe 4.0 Gen4",
    rows({ "Dung lượng": "1 TB", "Chuẩn kết nối": "NVMe PCIe Gen 4.0 x4", "Form factor": "M.2 2280" }),
    { storageCapacityGb: 1000, storageInterface: "NVMe PCIe 4.0 x4", storageFormFactor: "M.2 2280" },
  );

  expectSpec(
    "SSD nguồn SEED — không có dòng form factor, lấy từ dòng chuẩn kết nối",
    "SSD",
    "Ổ cứng SSD Samsung 990 Pro 2TB NVMe M.2",
    rows({ "Dung lượng": "2TB", "Chuẩn kết nối": "M.2 2280, NVMe 2.0 PCIe 4.0 x4" }),
    { storageCapacityGb: 2000, storageInterface: "NVMe PCIe 4.0 x4", storageFormFactor: "M.2 2280" },
  );

  expectSpec(
    'PSU Deepcool PF550 — không có dòng "Công suất", lấy 550W từ tên kèm ghi chú',
    "PSU",
    "Nguồn máy tính Deepcool PF550 - 80 Plus (550W)",
    rows({ "Chứng nhận hiệu suất": "80 Plus Gold", "Chuẩn nguồn": "ATX 12V", "Kiểu dây": "Full Modular" }),
    {
      psuWattage: 550,
      psuEfficiency: "80 Plus Gold",
      psuModular: "Full",
      psuFormFactor: "ATX",
      extra: { notes: ['Không có dòng "Công suất" — lấy 550W từ tên sản phẩm'] },
    },
  );

  expectSpec(
    "PSU MSI MAG A1250GL — tên ghi 1250W, thông số ghi 1300W -> dùng 1250W (an toàn hơn) kèm ghi chú",
    "PSU",
    "Nguồn máy tính MSI MAG A1250GL PCIE5 - 80 Plus Gold - Full Modular (1250W)",
    rows({ "Công suất": "1300 W", "Chứng nhận hiệu suất": "80 Plus Gold", "Chuẩn nguồn": "ATX 3.0", "Kiểu dây": "Full Modular" }),
    {
      psuWattage: 1250,
      psuEfficiency: "80 Plus Gold",
      psuModular: "Full",
      psuFormFactor: "ATX",
      extra: { notes: ["Công suất mâu thuẫn: thông số ghi 1300W, tên ghi 1250W — dùng 1250W (an toàn hơn)"] },
    },
  );

  expectSpec(
    'PSU tên có "RM1200x"/"White", khớp thông số -> không ghi chú',
    "PSU",
    "Nguồn máy tính Corsair RM1200x SHIFT White ATX 3.1 - 80 Plus Gold - Full Modular (1200W)",
    rows({ "Công suất": "1200 W", "Chứng nhận hiệu suất": "80 Plus Gold", "Chuẩn nguồn": "ATX 3.0", "Kiểu dây": "Full Modular" }),
    { psuWattage: 1200, psuEfficiency: "80 Plus Gold", psuModular: "Full", psuFormFactor: "ATX" },
  );

  expectSpec(
    "PSU Non-Modular",
    "PSU",
    "Nguồn máy tính Corsair CX650 - 80 Plus Bronze (650W) CP-9020278-NA",
    rows({ "Công suất": "650 W", "Chứng nhận hiệu suất": "80 Plus Bronze", "Chuẩn nguồn": "ATX 12V, ATX 2.4", "Kiểu dây": "Non-Modular" }),
    { psuWattage: 650, psuEfficiency: "80 Plus Bronze", psuModular: "Non", psuFormFactor: "ATX" },
  );

  expectSpec(
    "Vỏ case Xigmatek QUANTUM ARCTIC 3GF — có độ dài VGA tối đa",
    "CASE",
    "Vỏ case Xigmatek QUANTUM ARCTIC 3GF",
    rows({ "Hỗ trợ bo mạch chủ": "E-ATX, ATX, M-ATX, Mini-ITX", "Chiều cao tản CPU tối đa": "165 mm", "Độ dài VGA tối đa": "350 mm" }),
    { caseFormFactors: ["E-ATX", "ATX", "mATX", "ITX"], caseMaxGpuMm: 350, caseMaxCoolerMm: 165 },
  );

  expectSpec(
    "Vỏ case chỉ ghi form factor (8/13 vỏ thật thiếu độ dài VGA)",
    "CASE",
    "Vỏ case Cooler Master ELITE 301 BLACK",
    rows({ "Hỗ trợ bo mạch chủ": "ATX" }),
    { caseFormFactors: ["ATX"] },
  );
}

console.log("\n[6] Dữ liệu xấu / thiếu -> toàn null, không ném lỗi");
{
  expectSpec("specifications null", "CPU", "CPU không tên", null, {});
  expectSpec("specifications là chuỗi rác", "VGA", "VGA", "rác", {});
  expectSpec("dòng thiếu nhãn / giá trị không phải chữ", "PSU", "Nguồn không ghi công suất", [{ label: 1, value: {} }, { value: "650 W" }], {});
  expectSpec("có nhãn đúng nhưng giá trị không đọc được", "CPU", "CPU", rows({ Socket: "không rõ", TDP: "đang cập nhật" }), {});

  const input = {
    componentType: "MAINBOARD" as const,
    name: "Bo mạch chủ ASUS TUF GAMING B650M-E WIFI (DDR5)",
    specifications: rows({ Chipset: "AMD B650", Socket: "AM5", "Kích thước (form factor)": "Micro-ATX", "Bộ nhớ": "DDR5, 4 khe, tối đa 192 GB" }),
  };
  check("chạy 2 lần ra y hệt", parseProductSpec(input), parseProductSpec(input));
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
