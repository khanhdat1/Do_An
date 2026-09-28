// Kiểm thử bước tự điều chỉnh cho vừa ngân sách, không cần DB/mạng/AI. Chạy: npx tsx src/pc-build/budget-fit.test.ts
// Thông số theo kiểu sản phẩm thật; giá là số giả lập đủ để thấy rõ từng phép đánh đổi.
import { fitToBudget, type BuildCandidates } from "./budget-fit.js";
import { checkBuild, type BuildPart, type BuildParts } from "./compatibility.js";
import type { BuildSlot } from "./slots.js";
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

function part(productId: string, price: number, spec: Partial<NormalizedSpec>, quantity = 1): BuildPart {
  return { productId, quantity, price, spec: { ...emptySpec(), ...spec } };
}

/** Rút gọn các lần đổi thành "ô: món cũ -> món mới" cho dễ đọc (kèm " x2" khi nhiều hơn 1 cái) */
function swapsOf(fit: ReturnType<typeof fitToBudget>) {
  const label = (item: BuildPart) => `${item.productId}${item.quantity > 1 ? ` x${item.quantity}` : ""}`;
  return fit?.swaps.map((swap) => `${swap.slot}: ${label(swap.from)} -> ${label(swap.to)}`) ?? null;
}

const GAMING: Record<BuildSlot, number> = { VGA: 3, CPU: 1.5, RAM: 1, SSD: 0.8, MAINBOARD: 0.6, PSU: 0.6, CASE: 0.4 };
const EVEN: Record<BuildSlot, number> = { CPU: 1, MAINBOARD: 1, RAM: 1, VGA: 1, SSD: 1, PSU: 1, CASE: 1 };

const cpu5600gt = part("cpu-5600gt", 4_490_000, { socket: "AM4", tdpWatts: 65, hasIgpu: true, extra: { coolerIncluded: true } });
const cpu5500gt = part("cpu-5500gt", 3_990_000, { socket: "AM4", tdpWatts: 65, hasIgpu: true, extra: { coolerIncluded: true } });
const cpu8400f = part("cpu-8400f", 3_500_000, { socket: "AM5", tdpWatts: 65, hasIgpu: false, extra: { coolerIncluded: true } });

const mbB550 = part("mb-b550", 2_490_000, { socket: "AM4", ramType: "DDR4", ramSlots: 4, formFactor: "ATX" });
const mbA520 = part("mb-a520", 1_790_000, { socket: "AM4", ramType: "DDR4", ramSlots: 2, formFactor: "mATX" });
const mbB650 = part("mb-b650", 1_500_000, { socket: "AM5", ramType: "DDR5", ramSlots: 4, formFactor: "mATX" });

const ramKit32 = part("ram-ddr4-2x16", 2_490_000, { ramType: "DDR4", ramModules: 2, ramCapacity: 32 });
const ram16 = part("ram-ddr4-1x16", 1_290_000, { ramType: "DDR4", ramModules: 1, ramCapacity: 16 });
const ram16Rgb = part("ram-ddr4-1x16-rgb", 3_490_000, { ramType: "DDR4", ramModules: 1, ramCapacity: 16 });
const ram8 = part("ram-ddr4-1x8", 490_000, { ramType: "DDR4", ramModules: 1, ramCapacity: 8 });
const ramDdr5 = part("ram-ddr5-1x16", 900_000, { ramType: "DDR5", ramModules: 1, ramCapacity: 16 });

const vga5060 = part("vga-5060", 13_490_000, { tdpWatts: 145, gpuLengthMm: 240 });
const vgaB580 = part("vga-b580", 10_490_000, { tdpWatts: 190, gpuLengthMm: 272 });
const vga6500 = part("vga-6500xt", 3_790_000, { tdpWatts: 107, gpuLengthMm: 200 });

const ssd1tb = part("ssd-1tb", 2_990_000, { storageCapacityGb: 1000 });
const ssd512 = part("ssd-512", 1_290_000, { storageCapacityGb: 512 });
const ssd256 = part("ssd-256", 490_000, { storageCapacityGb: 256 });

const psu650 = part("psu-650", 1_490_000, { psuWattage: 650 });
const psu550 = part("psu-550", 990_000, { psuWattage: 550 });
const psu250 = part("psu-250", 590_000, { psuWattage: 250 });

const caseAtx = part("case-atx", 1_590_000, { caseFormFactors: ["ATX", "mATX", "ITX"], caseMaxGpuMm: 330 });
const caseMini = part("case-mini", 1_090_000, { caseFormFactors: ["mATX", "ITX"], caseMaxGpuMm: 250 });
const caseNoData = part("case-nodata", 1_190_000, { caseFormFactors: ["ATX", "mATX"], caseMaxGpuMm: null });
const caseOk = part("case-ok", 1_190_000, { caseFormFactors: ["ATX", "mATX"], caseMaxGpuMm: 300 });

// Bộ chơi game ban đầu: 29.030.000đ, đủ linh kiện, không lỗi, không cảnh báo
const gaming: BuildParts = { CPU: cpu5600gt, MAINBOARD: mbB550, RAM: ramKit32, VGA: vga5060, SSD: ssd1tb, PSU: psu650, CASE: caseAtx };
const everything: BuildCandidates = {
  CPU: [cpu5600gt, cpu5500gt, cpu8400f],
  MAINBOARD: [mbB550, mbA520, mbB650],
  RAM: [ramKit32, ram16, ram8, ramDdr5],
  VGA: [vga5060, vgaB580, vga6500],
  SSD: [ssd1tb, ssd512, ssd256],
  PSU: [psu650, psu550, psu250],
  CASE: [caseAtx, caseMini, caseNoData],
};

console.log("\n[1] Không cần hoặc không thể điều chỉnh");
{
  const base = checkBuild(gaming);
  check("bộ ban đầu: 29.030.000đ, không lỗi, không cảnh báo", [base.totalPrice, base.status], [29_030_000, "COMPATIBLE"]);
  check("không vượt ngân sách -> null", fitToBudget(gaming, everything, 30_000_000, GAMING), null);
  check("đúng bằng ngân sách -> null", fitToBudget(gaming, everything, 29_030_000, GAMING), null);
  check("ngân sách thấp hơn cả bộ rẻ nhất có thể -> null", fitToBudget(gaming, everything, 5_000_000, GAMING), null);
  check("không có món nào rẻ hơn -> null", fitToBudget(gaming, {}, 28_000_000, GAMING), null);
}

console.log("\n[2] Chơi game vượt ~1 triệu: cắt ở chỗ ít thiệt nhất, giữ nguyên card");
{
  const fit = fitToBudget(gaming, everything, 28_000_000, GAMING);
  // Tính tay: mainboard -700.000 (x0,6) + vỏ -500.000 (x0,4) thiệt ít nhất; SSD hay RAM một mình đều thiệt hơn;
  // vỏ nhỏ chỉ lắp được khi đổi kèm mainboard mATX
  check("đổi mainboard mATX + vỏ nhỏ", swapsOf(fit), ["MAINBOARD: mb-b550 -> mb-a520", "CASE: case-atx -> case-mini"]);
  check("card đồ họa giữ nguyên", fit?.parts.VGA?.productId, "vga-5060");
  check("tổng 27.830.000đ, không vượt ngân sách", fit?.result.totalPrice, 27_830_000);
  check("vẫn tương thích, không thêm cảnh báo", fit?.result.status, "COMPATIBLE");
  const picked = Object.values(fit?.parts ?? {}).map((item) => item.productId);
  check("không chọn món gây lỗi (mainboard AM5, RAM DDR5, nguồn 250W)", ["mb-b650", "ram-ddr5-1x16", "psu-250"].filter((id) => picked.includes(id)), []);
  check("chạy lại ra đúng phương án cũ", swapsOf(fitToBudget(gaming, everything, 28_000_000, GAMING)), swapsOf(fit));
}

console.log("\n[3] Chỉ còn cách hạ card: hạ ít nhất có thể");
{
  const fit = fitToBudget(gaming, { VGA: [vga5060, vgaB580, vga6500] }, 27_030_000, GAMING);
  check("vượt 2 triệu -> xuống Arc B580 (bớt 3 triệu), không nhảy xuống card rẻ nhất", swapsOf(fit), ["VGA: vga-5060 -> vga-b580"]);
  check("nguồn 650W vẫn đủ cho card mới", fit?.result.checks.find((item) => item.rule === "PSU_WATTAGE")?.severity, "PASS");
}

console.log("\n[4] Không phát sinh lỗi tương thích");
{
  // Chỉ nguồn rẻ hơn mới vừa ngân sách, nhưng 250W không đủ (cần ~290W) -> không có cách hợp lệ
  check("nguồn không đủ công suất thì không chọn", fitToBudget(gaming, { PSU: [psu250] }, 28_500_000, GAMING), null);
  // CPU rẻ hơn khác socket chỉ hợp lệ khi đổi kèm mainboard + RAM cùng chuẩn
  const fit = fitToBudget(gaming, { CPU: [cpu8400f], MAINBOARD: [mbB650], RAM: [ramDdr5] }, 26_000_000, GAMING);
  check("đổi CPU AM5 thì đổi kèm mainboard AM5 và RAM DDR5", swapsOf(fit), [
    "CPU: cpu-5600gt -> cpu-8400f",
    "MAINBOARD: mb-b550 -> mb-b650",
    "RAM: ram-ddr4-2x16 -> ram-ddr5-1x16",
  ]);
  check("kết quả không có lỗi nào", fit?.result.checks.filter((item) => item.severity === "ERROR").length, 0);
  // Bộ không card rời (13.260.000đ): CPU rẻ hơn đủ tiền nhưng không có đồ họa tích hợp -> bắt buộc thêm card -> không nhận
  const cpu8600g = part("cpu-8600g", 6_990_000, { socket: "AM5", tdpWatts: 65, hasIgpu: true, extra: { coolerIncluded: true } });
  const office: BuildParts = { CPU: cpu8600g, MAINBOARD: mbB650, RAM: ramDdr5, SSD: ssd512, PSU: psu550, CASE: caseAtx };
  check("bộ văn phòng ban đầu hợp lệ", [checkBuild(office).totalPrice, checkBuild(office).status], [13_260_000, "COMPATIBLE"]);
  check("bộ không card rời: không đổi sang CPU không có đồ họa tích hợp", fitToBudget(office, { CPU: [cpu8400f] }, 12_260_000, EVEN), null);
}

console.log("\n[5] RAM: được đổi số thanh nhưng không hạ dưới 16GB; hạn chế cảnh báo mới");
{
  // 1 thanh 16GB đắt (tổng 30.030.000đ), cần bớt ≥ 2 triệu: 1 thanh 8GB thì hụt dung lượng, 2 thanh 8GB vẫn đủ 16GB
  const rgb: BuildParts = { ...gaming, RAM: ram16Rgb };
  const rgbFit = fitToBudget(rgb, { RAM: [ram16Rgb, ram8] }, 28_030_000, GAMING);
  check("1 thanh 16GB đắt -> 2 thanh 8GB rẻ, vẫn đủ 16GB", swapsOf(rgbFit), ["RAM: ram-ddr4-1x16-rgb -> ram-ddr4-1x8 x2"]);
  check("tổng tính theo số thanh", rgbFit?.result.totalPrice, 30_030_000 - 3_490_000 + 2 * 490_000);
  check("không hạ xuống 8GB dù đó là cách duy nhất đủ tiền", fitToBudget(rgb, { RAM: [ram8] }, 27_130_000, GAMING), null);
  check(
    "cấu hình vốn chỉ 8GB thì được đổi sang thanh 8GB rẻ hơn",
    swapsOf(fitToBudget({ ...gaming, RAM: { ...ram8, productId: "ram-ddr4-1x8-rgb", price: 1_990_000 } }, { RAM: [ram8] }, 27_500_000, GAMING)),
    ["RAM: ram-ddr4-1x8-rgb -> ram-ddr4-1x8"],
  );

  // 2 thanh 16GB (tổng 29.120.000đ): bớt 1 thanh là thiệt ít nhất mà vẫn đủ 16GB
  const doubleRam: BuildParts = { ...gaming, RAM: { ...ram16, quantity: 2 } };
  const fit = fitToBudget(doubleRam, { RAM: [ram16, ram8] }, 28_000_000, EVEN);
  check("2 thanh 16GB -> 1 thanh 16GB", swapsOf(fit), ["RAM: ram-ddr4-1x16 x2 -> ram-ddr4-1x16"]);
  check("số tiền bớt tính theo số lượng", fit?.result.totalPrice, 29_030_000 - 2_490_000 + 1_290_000);

  const caseFit = fitToBudget(gaming, { CASE: [caseNoData, caseOk] }, 28_730_000, GAMING);
  check("cùng giá, chọn vỏ có số liệu độ dài card thay vì vỏ thiếu số liệu", swapsOf(caseFit), ["CASE: case-atx -> case-ok"]);
  check("vỏ thiếu số liệu vẫn dùng được nếu là cách duy nhất", swapsOf(fitToBudget(gaming, { CASE: [caseNoData] }, 28_730_000, GAMING)), [
    "CASE: case-atx -> case-nodata",
  ]);
}

console.log("\n[6] Kho lớn vẫn chạy nhanh");
{
  // 7 loại × 14 món rẻ dần, cùng thông số tương thích: 15^7 tổ hợp nếu duyệt hết
  const bigCandidates: BuildCandidates = {};
  const slots = Object.keys(gaming) as BuildSlot[];
  for (const slot of slots) {
    const current = gaming[slot] as BuildPart;
    bigCandidates[slot] = Array.from({ length: 14 }, (_, index) => ({ ...current, productId: `${current.productId}-${index}`, price: Math.round(current.price * (0.95 - index * 0.05)) }));
  }
  const started = performance.now();
  const fit = fitToBudget(gaming, bigCandidates, 20_000_000, GAMING);
  const elapsed = performance.now() - started;
  check("tìm được phương án hợp lệ trong ngân sách", fit !== null && fit.result.totalPrice <= 20_000_000 && fit.result.isValid, true);
  check("dưới 2 giây", elapsed < 2000, true);
  console.log(`    (${Math.round(elapsed)} ms, đổi ${fit?.swaps.length} món)`);
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
