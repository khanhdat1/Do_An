// Kiểm thử bước tự điều chỉnh theo ngân sách (hạ cấp cho vừa, nâng cấp khi dư nhiều), không cần DB/mạng/AI.
// Chạy: npx tsx src/pc-build/budget-fit.test.ts
// Thông số theo kiểu sản phẩm thật; giá là số giả lập đủ để thấy rõ từng phép đánh đổi.
import { fitToBudget, upgradeWithinBudget, type BuildCandidates } from "./budget-fit.js";
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
function swapsOf(fit: ReturnType<typeof fitToBudget | typeof upgradeWithinBudget>) {
  const label = (item: BuildPart) => `${item.productId}${item.quantity > 1 ? ` x${item.quantity}` : ""}`;
  return fit?.swaps.map((swap) => `${swap.slot}: ${label(swap.from)} -> ${label(swap.to)}`) ?? null;
}

const GAMING: Record<BuildSlot, number> = { VGA: 3, CPU: 1.5, RAM: 1, SSD: 0.8, MAINBOARD: 0.6, PSU: 0.6, CASE: 0.4 };
const GRAPHICS: Record<BuildSlot, number> = { CPU: 2, VGA: 2, RAM: 1.5, SSD: 1, MAINBOARD: 0.6, PSU: 0.6, CASE: 0.4 };
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

/* ------------------------------------------------------------------------------------------------------------------ */
/*  Nâng cấp khi dùng quá ít ngân sách                                                                                */
/* ------------------------------------------------------------------------------------------------------------------ */

const cpu5700g = part("cpu-5700g", 6_490_000, { socket: "AM4", tdpWatts: 65, hasIgpu: true, extra: { coolerIncluded: true } });
const cpu5800x = part("cpu-5800x", 5_990_000, { socket: "AM4", tdpWatts: 105, hasIgpu: false, extra: { coolerIncluded: false } });
const vga5070ti = part("vga-5070ti", 19_490_000, { tdpWatts: 300, gpuLengthMm: 304 });
const vgaLong = part("vga-4070-long", 15_990_000, { tdpWatts: 200, gpuLengthMm: 336 });
const vgaNoData = part("vga-nodata", 11_490_000, {});
const ssd1tbGen5 = part("ssd-1tb-gen5", 4_490_000, { storageCapacityGb: 1000 });
const ssd2tb = part("ssd-2tb", 4_990_000, { storageCapacityGb: 2000 });
const psu450 = part("psu-450", 790_000, { psuWattage: 450 });
const psu750 = part("psu-750", 1_990_000, { psuWattage: 750 });
const caseBig = part("case-big", 2_190_000, { caseFormFactors: ["E-ATX", "ATX", "mATX", "ITX"], caseMaxGpuMm: 400 });

// Bộ chơi game AI chọn quá tiết kiệm: 15.730.000đ, đủ linh kiện, không lỗi, không cảnh báo
const starter: BuildParts = { CPU: cpu5600gt, MAINBOARD: mbB550, RAM: ram16, VGA: vga6500, SSD: ssd512, PSU: psu450, CASE: caseAtx };
const pricier: BuildCandidates = {
  CPU: [cpu5500gt, cpu5600gt, cpu5700g, cpu5800x, cpu8400f],
  MAINBOARD: [mbA520, mbB550, mbB650],
  RAM: [ram8, ram16, ram16Rgb, ramKit32, ramDdr5],
  VGA: [vga6500, vgaB580, vga5060, vga5070ti],
  SSD: [ssd256, ssd512, ssd1tb, ssd1tbGen5, ssd2tb],
  PSU: [psu250, psu450, psu550, psu650, psu750],
  CASE: [caseMini, caseNoData, caseOk, caseAtx, caseBig],
};

console.log("\n[7] Nâng cấp: không cần hoặc không có cách nâng đáng");
{
  const base = checkBuild(starter);
  check("bộ tiết kiệm ban đầu: 15.730.000đ, không lỗi, không cảnh báo", [base.totalPrice, base.status], [15_730_000, "COMPATIBLE"]);
  check("đã dùng đúng bằng ngân sách -> null", upgradeWithinBudget(starter, pricier, 15_730_000, GAMING), null);
  check("đang vượt ngân sách -> null (việc của fitToBudget)", upgradeWithinBudget(starter, pricier, 15_000_000, GAMING), null);
  check("không có món nào đắt hơn -> null", upgradeWithinBudget(starter, {}, 30_000_000, GAMING), null);
  // Dư 270.000đ: chỉ đủ đổi nguồn 550W — nguồn đắt hơn không làm máy mạnh hơn nên không đổi
  check("chỉ đổi được món đi kèm (nguồn) -> null", upgradeWithinBudget(starter, pricier, 16_000_000, GAMING), null);
}

console.log("\n[8] Chơi game dư ~8 triệu: tiền vào card đồ họa trước, phần dư nâng RAM");
{
  const fit = upgradeWithinBudget(starter, pricier, 24_000_000, GAMING);
  // Tính tay: Arc B580 (+6,7 triệu) lợi 3×ln(10,49/3,79) ≈ 3,05 — hơn hẳn mọi cách rải vào CPU + RAM + SSD (≈ 2,04).
  // Còn 1,57 triệu: RAM 16GB -> kit 2×16GB (+1,2 triệu); SSD 1TB (+1,7 triệu) không còn đủ tiền
  check("card 6500 XT -> Arc B580, RAM 16GB -> 32GB", swapsOf(fit), ["RAM: ram-ddr4-1x16 -> ram-ddr4-2x16", "VGA: vga-6500xt -> vga-b580"]);
  check("tổng 23.630.000đ, không vượt ngân sách", fit?.result.totalPrice, 23_630_000);
  check("vẫn tương thích, không thêm cảnh báo", fit?.result.status, "COMPATIBLE");
  check("RAM 32GB lấy kit rẻ hơn, không lấy 2 thanh 16GB lẻ", fit?.parts.RAM?.price, 2_490_000);
  check("chạy lại ra đúng phương án cũ", swapsOf(upgradeWithinBudget(starter, pricier, 24_000_000, GAMING)), swapsOf(fit));
}

console.log("\n[9] Card mạnh hơn cần nguồn khỏe hơn: nâng nguồn kèm theo");
{
  const candidates: BuildCandidates = { VGA: [vga5070ti], PSU: [psu250, psu550, psu650, psu750] };
  // RTX 5070 Ti: ước tính 65 + 300 + 80 = 445 W, khuyến nghị 579 W — nguồn 450W/550W chỉ "đủ" sát nút (cảnh báo)
  const fit = upgradeWithinBudget(starter, candidates, 36_000_000, GAMING);
  check("đổi card thì đổi kèm nguồn 650W", swapsOf(fit), ["VGA: vga-6500xt -> vga-5070ti", "PSU: psu-450 -> psu-650"]);
  check("nguồn mới đạt mức khuyến nghị", fit?.result.checks.find((item) => item.rule === "PSU_WATTAGE")?.severity, "PASS");
  check("hai nguồn cùng đủ thì lấy nguồn rẻ hơn (650W, không lấy 750W)", fit?.parts.PSU?.productId, "psu-650");
  check("không đủ tiền nâng nguồn -> không nâng card (không chấp nhận nguồn dưới mức khuyến nghị)", upgradeWithinBudget(starter, candidates, 32_000_000, GAMING), null);
}

console.log("\n[10] Card dài hơn vỏ: đổi kèm vỏ lớn hơn");
{
  const fit = upgradeWithinBudget(starter, { VGA: [vgaLong], CASE: [caseMini, caseNoData, caseBig] }, 30_000_000, GAMING);
  check("card 336 mm không vừa vỏ 330 mm -> đổi kèm vỏ 400 mm", swapsOf(fit), ["VGA: vga-6500xt -> vga-4070-long", "CASE: case-atx -> case-big"]);
  check("kết quả không có lỗi nào", fit?.result.checks.filter((item) => item.severity === "ERROR").length, 0);
}

console.log("\n[11] Không phát sinh cảnh báo thật; card thiếu số liệu bị trừ điểm");
{
  check("CPU không kèm tản nhiệt -> không chọn", upgradeWithinBudget(starter, { CPU: [cpu5800x] }, 24_000_000, GAMING), null);
  check("có CPU khác kèm tản nhiệt thì chọn CPU đó", swapsOf(upgradeWithinBudget(starter, { CPU: [cpu5800x, cpu5700g] }, 24_000_000, GAMING)), [
    "CPU: cpu-5600gt -> cpu-5700g",
  ]);
  // Card thiếu số liệu đắt hơn B580 nhưng sinh 2 cảnh báo thiếu dữ liệu (chiều dài, điện năng)
  check("chọn card đủ số liệu thay vì card thiếu số liệu đắt hơn", swapsOf(upgradeWithinBudget(starter, { VGA: [vgaB580, vgaNoData] }, 28_000_000, GAMING)), [
    "VGA: vga-6500xt -> vga-b580",
  ]);
  check("card thiếu số liệu vẫn dùng được nếu là cách duy nhất", swapsOf(upgradeWithinBudget(starter, { VGA: [vgaNoData] }, 28_000_000, GAMING)), [
    "VGA: vga-6500xt -> vga-nodata",
  ]);
}

console.log("\n[12] RAM, SSD nâng theo dung lượng");
{
  check("đắt hơn nhưng vẫn 16GB (chỉ khác đèn RGB) -> không đổi", upgradeWithinBudget(starter, { RAM: [ram16Rgb] }, 19_500_000, GAMING), null);
  check("không nâng thành 4 thanh 8GB (chừa khe để nâng sau)", upgradeWithinBudget(starter, { RAM: [ram8] }, 24_000_000, GAMING), null);
  check("SSD 1TB: chọn ổ rẻ hơn trong hai ổ cùng 1TB", swapsOf(upgradeWithinBudget(starter, { SSD: [ssd1tb, ssd1tbGen5, ssd2tb] }, 18_000_000, GAMING)), [
    "SSD: ssd-512 -> ssd-1tb",
  ]);
  check("đủ tiền thì lên 2TB", swapsOf(upgradeWithinBudget(starter, { SSD: [ssd1tb, ssd1tbGen5, ssd2tb] }, 20_000_000, GAMING)), ["SSD: ssd-512 -> ssd-2tb"]);
}

console.log("\n[13] Cùng số tiền dư, ưu tiên theo nhu cầu");
{
  // Dư 7 triệu: đủ lên Arc B580 (+6,7 triệu), HOẶC nâng CPU + RAM + SSD 2TB (+6,9 triệu), không đủ cả hai
  check("chơi game: dồn vào card đồ họa", swapsOf(upgradeWithinBudget(starter, pricier, 22_730_000, GAMING)), ["VGA: vga-6500xt -> vga-b580"]);
  check("đồ họa - dựng video: nâng CPU, RAM, SSD", swapsOf(upgradeWithinBudget(starter, pricier, 22_730_000, GRAPHICS)), [
    "CPU: cpu-5600gt -> cpu-5700g",
    "RAM: ram-ddr4-1x16 -> ram-ddr4-2x16",
    "SSD: ssd-512 -> ssd-2tb",
  ]);
}

console.log("\n[14] Nâng cấp với kho lớn vẫn chạy nhanh");
{
  // 7 loại × 14 món đắt dần (RAM, SSD tăng dần dung lượng), cùng thông số tương thích
  const bigCandidates: BuildCandidates = {};
  for (const slot of Object.keys(starter) as BuildSlot[]) {
    const current = starter[slot] as BuildPart;
    bigCandidates[slot] = Array.from({ length: 14 }, (_, index) => {
      const spec = { ...current.spec };
      if (slot === "RAM") spec.ramCapacity = 16 * (index + 2);
      if (slot === "SSD") spec.storageCapacityGb = 512 * (index + 2);
      return { ...current, productId: `${current.productId}-${index}`, price: Math.round(current.price * (1.05 + index * 0.05)), spec };
    });
  }
  const started = performance.now();
  const fit = upgradeWithinBudget(starter, bigCandidates, 30_000_000, GAMING);
  const elapsed = performance.now() - started;
  check("tìm được phương án hợp lệ trong ngân sách", fit !== null && fit.result.totalPrice <= 30_000_000 && fit.result.isValid, true);
  check("dưới 2 giây", elapsed < 2000, true);
  console.log(`    (${Math.round(elapsed)} ms, đổi ${fit?.swaps.length} món, tổng ${fit?.result.totalPrice})`);
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
