// Kiểm thử phần trích thông số laptop/PC cho bộ lọc trang danh mục, bằng đúng chuỗi thật lấy từ DB — không cần DB hay
// mạng. Chạy: npx tsx src/catalog/computer-specs.test.ts
import type { Prisma } from "@pczone/db";
import {
  CPU_LINES,
  cpuLineLabel,
  detectCpuBrand,
  detectCpuLine,
  detectGpu,
  gpuLabel,
  gpuSortKey,
  INTEGRATED_GPU,
  parseComputerSpecs,
  parseRamGb,
} from "./computer-specs.js";

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

console.log("\n[1] Dòng CPU — mọi cách viết đang có trong DB");
{
  const cases: [string, string | null][] = [
    ["Intel Core i7-13620H", "core-i7"],
    ["Intel Core i7 13620H (10 nhân 16 luồng, xung nhịp tối đa 4.9 GHz)", "core-i7"],
    ["Intel Core i9-14900HX (24 nhân, 32 luồng)", "core-i9"],
    ["Intel Core i5-12400F (6 nhân 12 luồng)", "core-i5"],
    ["i9-14900HX", "core-i9"],
    ["Intel Core 5 210H (8 nhân 12 luồng)", "core-5"],
    ["Intel Core 7-240H (10 nhân 16 luồng, xung nhịp tối đa 5.2 GHz)", "core-7"],
    ["Intel Core 3 N350", "core-3"],
    ["Intel Core Ultra 7 255H (16 nhân 16 luồng)", "core-ultra-7"],
    ["Intel Core Ultra 5-125H (14 nhân 18 luồng, xung nhịp tối đa 4.50 GHz)", "core-ultra-5"],
    ["Intel Core Ultra X7 358H (16 nhân 16 luồng, xung nhịp tối đa 4.8 GHz)", "core-ultra-x7"],
    ["Intel Core Ultra 9 285K (24 nhân 24 luồng)", "core-ultra-9"],
    ["AMD Ryzen 7 7735HS (8 nhân, 16 luồng, xung nhịp tối đa 4.7GHz)", "ryzen-7"],
    ["AMD Ryzen 5-7640HS (6 nhân 12 luồng, xung nhịp tối đa 5.0 GHz)", "ryzen-5"],
    ["AMD Ryzen 3", "ryzen-3"],
    ["AMD Ryzen AI 7-350 (8 nhân 16 luồng, xung nhịp tối đa 5 GHz)", "ryzen-ai-7"],
    ["AMD Ryzen AI 9 465 (10 nhân 20 luồng)", "ryzen-ai-9"],
    ["AMD Ryzen AI MAX+ 392 (12 nhân 24 luồng, xung nhịp tối đa 5.0 GHz)", "ryzen-ai-max"],
    ["Qualcomm Snapdragon X X1-26100 8C (8 nhân 16 luồng, xung nhịp tối đa 3.0 GHz)", "snapdragon-x"],
    ["Snapdragon X2 Elite Extreme X2E94100 (18 nhân 18 luồng)", "snapdragon-x2"],
    ["Apple M4 Pro 14 nhân", "apple-m4"],
    ["Intel Celeron N4500", "celeron"],
  ];
  for (const [raw, expected] of cases) check(`"${raw}" → ${expected}`, detectCpuLine(raw), expected);

  check("không nhận ra dòng → null", detectCpuLine("Bộ xử lý 8 nhân đời mới"), null);
  check("dòng không tồn tại (Core Ultra 8) → null, không bịa nhãn", detectCpuLine("Intel Core Ultra 8 300"), null);
  check("dòng thông số trống → null", detectCpuLine(null), null);
  check("mọi giá trị trong CPU_LINES là duy nhất", new Set(CPU_LINES.map((line) => line.value)).size, CPU_LINES.length);
  check('nhãn "core-ultra-x7"', cpuLineLabel("core-ultra-x7"), "Intel Core Ultra X7");
  check('nhãn "core-i5"', cpuLineLabel("core-i5"), "Intel Core i5");
  check("nhãn giá trị lạ (URL cũ) giữ nguyên", cpuLineLabel("core-x99"), "core-x99");
}

console.log("\n[2] Hãng CPU");
{
  check("theo dòng: Core → Intel", detectCpuBrand("Intel Core 5 120U (10 nhân)"), "intel");
  check("theo dòng: Ryzen → AMD", detectCpuBrand("AMD Ryzen 9 8940HX"), "amd");
  check("theo dòng: Snapdragon → Qualcomm", detectCpuBrand("Snapdragon X2 Elite X2E-88-100"), "qualcomm");
  check("không nhận ra dòng nhưng ghi hãng", detectCpuBrand("Intel Processor N100"), "intel");
  check("không có hãng → null", detectCpuBrand("8 nhân 16 luồng"), null);
}

console.log("\n[3] Dung lượng RAM lắp sẵn");
{
  check('"16 GB" → 16', parseRamGb("16 GB"), 16);
  check('"32GB DDR5" → 32', parseRamGb("32GB DDR5"), 32);
  check("lấy cụm đầu, bỏ phần nâng cấp tối đa", parseRamGb("8 GB DDR5 5200 MHz (nâng cấp tối đa 64 GB)"), 8);
  check("tổng ghi trước số thanh", parseRamGb("16GB DDR5 4800MHz (2 x 8GB, nâng cấp tối đa 32GB)"), 16);
  check('"2 x 8GB DDR4" → 16', parseRamGb("2 x 8GB DDR4"), 16);
  check('"2x16GB" → 32', parseRamGb("2x16GB"), 32);
  check('"LPDDR5X 16GB" không thành 5 x 16', parseRamGb("LPDDR5X 16GB"), 16);
  check('"32 GB LPDDR5X 8533 MHz" → 32', parseRamGb("32 GB LPDDR5X 8533 MHz"), 32);
  check("không có GB → null", parseRamGb("DDR5 5600 MHz"), null);
  check("ngoài 2–512 GB coi như đọc sai", parseRamGb("1024 GB"), null);
}

console.log("\n[4] Card đồ họa");
{
  const cases: [string, string | null][] = [
    ["NVIDIA GeForce RTX 4060 Laptop GPU 8GB GDDR6 (tối đa 140W)", "rtx-4060"],
    ["NVIDIA GeForce RTX 4070 Ti SUPER 16GB", "rtx-4070-ti-super"],
    ["NVIDIA GeForce RTX 4080 SUPER", "rtx-4080-super"],
    ["NVIDIA GeForce RTX 5070 Ti 12GB GDDR7", "rtx-5070-ti"],
    ["RTX 5060 Ti 8GB", "rtx-5060-ti"],
    ["RTX 4060", "rtx-4060"],
    ["NVIDIA GeForce RTX 3050 with 6GB of dedicated GDDR6 VRAM", "rtx-3050"],
    ["NVIDIA GeForce RTX 5060 với 8 GB VRAM GDDR7 chuyên dụng, hỗ trợ 3328 lõi NVIDIA CUDA, 572 TOPS", "rtx-5060"],
    ["GeForce RTX 5050 8GB GDDR7 AMD Radeon Graphics", "rtx-5050"],
    ["AMD Radeon RX 6500M", "rx-6500m"],
    ["RX 6500 XT 4GB", "rx-6500-xt"],
    ["Intel Arc B580 12GB", "arc-b580"],
    ["Intel Arc B390 GPU (đồ họa tích hợp)", INTEGRATED_GPU],
    ["Intel Arc 130T Graphics", INTEGRATED_GPU],
    ["Intel Arc", INTEGRATED_GPU],
    ["Intel UHD Graphics", INTEGRATED_GPU],
    ["Intel Iris Xe Graphics", INTEGRATED_GPU],
    ["AMD Radeon 840M Graphics", INTEGRATED_GPU],
    ["AMD Radeon 8060S Graphics", INTEGRATED_GPU],
    ["Card đồ họa tích hợp - Qualcomm Adreno", INTEGRATED_GPU],
    ["Qualcomm Adreno GPU", INTEGRATED_GPU],
  ];
  for (const [raw, expected] of cases) check(`"${raw}" → ${expected}`, detectGpu(raw), expected);

  check("Arc có mã nhưng không rõ rời hay tích hợp → null", detectGpu("Intel Arc A770"), null);
  check("không đọc được → null", detectGpu("Đang cập nhật"), null);
  check("nhãn RTX Ti SUPER", gpuLabel("rtx-4070-ti-super"), "GeForce RTX 4070 Ti SUPER");
  check("nhãn RX đuôi M", gpuLabel("rx-6500m"), "Radeon RX 6500M");
  check("nhãn RX XT", gpuLabel("rx-6500-xt"), "Radeon RX 6500 XT");
  check("nhãn Arc", gpuLabel("arc-b580"), "Intel Arc B580");
  check("nhãn tích hợp", gpuLabel(INTEGRATED_GPU), "Đồ họa tích hợp");

  const order = ["rx-6500-xt", INTEGRATED_GPU, "rtx-5060-ti", "arc-b580", "rtx-4060", "rtx-5060"].sort((a, b) => {
    const [x, y] = [gpuSortKey(a), gpuSortKey(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
  check("sắp xếp: NVIDIA theo số → AMD → Intel → tích hợp", order, ["rtx-4060", "rtx-5060", "rtx-5060-ti", "rx-6500-xt", "arc-b580", INTEGRATED_GPU]);
}

console.log("\n[5] Cả bảng thông số — nhãn khác nhau giữa các nguồn");
{
  check(
    "laptop (nhãn CPU / Card đồ họa / RAM / Ổ cứng)",
    parseComputerSpecs(
      rows({
        CPU: "AMD Ryzen 7 7735HS (8 nhân, 16 luồng, xung nhịp tối đa 4.7GHz)",
        "Card đồ họa": "NVIDIA GeForce RTX 4060 Laptop GPU 8GB GDDR6 (tối đa 140W)",
        RAM: "16GB DDR5 4800MHz (2 x 8GB, nâng cấp tối đa 32GB)",
        "Ổ cứng": "512GB SSD NVMe PCIe 4.0",
      }),
    ),
    { cpuBrand: "amd", cpuLine: "ryzen-7", ramGb: 16, gpu: "rtx-4060", storageGb: 512 },
  );
  check(
    "PC lắp sẵn (nhãn Bộ vi xử lý (CPU) / Card đồ họa (VGA) / Bộ nhớ RAM / Ổ cứng SSD)",
    parseComputerSpecs(
      rows({
        "Bộ vi xử lý (CPU)": "Intel Core i5-12400F (6 nhân 12 luồng)",
        "Card đồ họa (VGA)": "Intel Arc B580 12GB",
        "Bộ nhớ RAM": "16 GB",
        "Ổ cứng SSD": "1TB NVMe",
      }),
    ),
    { cpuBrand: "intel", cpuLine: "core-i5", ramGb: 16, gpu: "arc-b580", storageGb: 1000 },
  );
  check(
    "dạng object của crawler cũng đọc được",
    parseComputerSpecs({ CPU: "Intel Core Ultra 7 155H", RAM: "32 GB" }),
    { cpuBrand: "intel", cpuLine: "core-ultra-7", ramGb: 32, gpu: null, storageGb: null },
  );
  check("thiếu dòng card đồ họa → gpu null (không đoán theo CPU)", parseComputerSpecs(rows({ CPU: "Intel Core 5 120U" })).gpu, null);
  check("specifications null → toàn null", parseComputerSpecs(null), { cpuBrand: null, cpuLine: null, ramGb: null, gpu: null, storageGb: null });
  check("specifications rác → toàn null", parseComputerSpecs("rác"), { cpuBrand: null, cpuLine: null, ramGb: null, gpu: null, storageGb: null });
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
