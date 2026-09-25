// Kiểm thử bộ kiểm tra tương thích, không cần DB hay mạng. Chạy: npx tsx src/pc-build/compatibility.test.ts
// Thông số lấy theo sản phẩm thật trong DB; giá chỉ là số giả lập cho phép cộng tổng tiền.
import {
  checkBuild,
  evaluateCandidate,
  type BuildCheckResult,
  type BuildPart,
  type BuildParts,
  type CheckRule,
} from "./compatibility.js";
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

function part(productId: string, spec: Partial<NormalizedSpec>, options: { price?: number; quantity?: number } = {}): BuildPart {
  return { productId, quantity: options.quantity ?? 1, price: options.price ?? 1_000_000, spec: { ...emptySpec(), ...spec } };
}

/** Rút gọn một luật thành {severity, insufficientData} (null nếu luật không chạy) để so cho dễ đọc */
function rule(result: BuildCheckResult, name: CheckRule) {
  const found = result.checks.find((item) => item.rule === name);
  return found ? { severity: found.severity, insufficientData: found.insufficientData ?? false } : null;
}

function message(result: BuildCheckResult, name: CheckRule) {
  return result.checks.find((item) => item.rule === name)?.message ?? null;
}

const ERROR = { severity: "ERROR", insufficientData: false };
const WARNING = { severity: "WARNING", insufficientData: false };
const MISSING_DATA = { severity: "WARNING", insufficientData: true };
const PASS = { severity: "PASS", insufficientData: false };

// --- Linh kiện theo thông số thật ------------------------------------------------------------
const cpu265K = part("cpu-265k", { socket: "LGA1851", tdpWatts: 125, hasIgpu: true, ramType: "DDR5", extra: { maxPowerW: 250 } });
const cpu8600G = part("cpu-8600g", { socket: "AM5", tdpWatts: 65, hasIgpu: true, ramType: "DDR5" });
const cpu8400F = part("cpu-8400f", { socket: "AM5", tdpWatts: 65, hasIgpu: false, ramType: "DDR5" });
const cpu7800X3D = part("cpu-7800x3d", { socket: "AM5", tdpWatts: 120, hasIgpu: true, ramType: "DDR5", extra: { coolerIncluded: false } });

const boardZ790 = part("mb-z790", { socket: "LGA1700", chipset: "Z790", ramType: "DDR5", ramSlots: 4, formFactor: "ATX" });
const boardX870 = part("mb-x870", { socket: "AM5", chipset: "X870", ramType: "DDR5", ramSlots: 4, formFactor: "ATX" });
const boardB650M = part("mb-b650m", { socket: "AM5", chipset: "B650", ramType: "DDR5", ramSlots: 4, formFactor: "mATX" });
const boardH610M = part("mb-h610m", { socket: "LGA1700", chipset: "H610", ramType: "DDR4", ramSlots: 2, formFactor: "mATX" });
const boardKccshop = part("mb-kccshop", { socket: "LGA1700", chipset: "B760", ramType: "DDR5", ramSlots: 4 });

const ramDdr5Kit = part("ram-ddr5-2x16", { ramType: "DDR5", ramCapacity: 32, ramModules: 2 });
const ramDdr4Single = part("ram-ddr4-1x8", { ramType: "DDR4", ramCapacity: 8, ramModules: 1 });

const vgaAstral5080 = part("vga-astral-5080", { vramGb: 16, tdpWatts: 340, gpuLengthMm: 358 });
const vga5070Ti = part("vga-5070ti-windforce", { vramGb: 16, tdpWatts: 250, gpuLengthMm: 304, extra: { recommendedPsuW: 750 } });
const vga5060NoTdp = part("vga-5060-windforce", { vramGb: 8, gpuLengthMm: 199, extra: { recommendedPsuW: 450 } });

const ssd = part("ssd-1tb", { storageCapacityGb: 1000 });

const psu = (watts: number | null) => part(`psu-${watts ?? "unknown"}`, { psuWattage: watts });

const caseXigmatek = part("case-xigmatek", { caseFormFactors: ["E-ATX", "ATX", "mATX", "ITX"], caseMaxGpuMm: 350 });
const caseGungnir = part("case-gungnir", { caseFormFactors: ["E-ATX", "ATX", "mATX", "ITX"], caseMaxGpuMm: 405 });
const caseA21 = part("case-a21", { caseFormFactors: ["mATX", "ITX"] });
const case5000D = part("case-5000d", { caseFormFactors: ["E-ATX"] });
const caseElite301 = part("case-elite-301", { caseFormFactors: ["ATX"] });

console.log("\n[1] CPU_SOCKET");
{
  const mismatch = checkBuild({ CPU: cpu8600G, MAINBOARD: boardZ790 });
  check("AM5 + LGA1700 -> ERROR", rule(mismatch, "CPU_SOCKET"), ERROR);
  check("thông báo nêu đúng 2 socket", message(mismatch, "CPU_SOCKET"), "CPU dùng socket AM5 nhưng mainboard dùng socket LGA1700 — không lắp được.");
  check("đánh dấu đúng 2 sản phẩm liên quan", mismatch.checks.find((item) => item.rule === "CPU_SOCKET")?.productIds, ["cpu-8600g", "mb-z790"]);
  check("cùng AM5 -> PASS", rule(checkBuild({ CPU: cpu8600G, MAINBOARD: boardX870 }), "CPU_SOCKET"), PASS);
  check(
    "thiếu socket -> WARNING thiếu dữ liệu, không phải PASS",
    rule(checkBuild({ CPU: part("cpu-x", { tdpWatts: 65 }), MAINBOARD: boardX870 }), "CPU_SOCKET"),
    MISSING_DATA,
  );
  check("chưa chọn mainboard -> luật không chạy", rule(checkBuild({ CPU: cpu8600G }), "CPU_SOCKET"), null);
}

console.log("\n[2] RAM_TYPE");
{
  check("RAM DDR4 + mainboard DDR5 -> ERROR", rule(checkBuild({ RAM: ramDdr4Single, MAINBOARD: boardX870 }), "RAM_TYPE"), ERROR);
  check("cùng DDR5 -> PASS", rule(checkBuild({ RAM: ramDdr5Kit, MAINBOARD: boardX870 }), "RAM_TYPE"), PASS);
  check(
    "RAM thiếu loại -> thiếu dữ liệu",
    rule(checkBuild({ RAM: part("ram-x", { ramModules: 1 }), MAINBOARD: boardX870 }), "RAM_TYPE"),
    MISSING_DATA,
  );
}

console.log("\n[3] VGA_LENGTH");
{
  const tooLong = checkBuild({ VGA: vgaAstral5080, CASE: caseXigmatek });
  check("card 358 mm + vỏ tối đa 350 mm -> ERROR", rule(tooLong, "VGA_LENGTH"), ERROR);
  check("thông báo nêu đúng 2 con số", message(tooLong, "VGA_LENGTH"), "Card dài 358 mm nhưng vỏ case chỉ chứa được card tối đa 350 mm.");
  check("vỏ 405 mm -> PASS", rule(checkBuild({ VGA: vgaAstral5080, CASE: caseGungnir }), "VGA_LENGTH"), PASS);
  check("dài đúng bằng mức tối đa -> PASS", rule(checkBuild({ VGA: part("vga-350", { gpuLengthMm: 350 }), CASE: caseXigmatek }), "VGA_LENGTH"), PASS);
  const noData = checkBuild({ VGA: vgaAstral5080, CASE: caseA21 });
  check("vỏ không ghi độ dài VGA tối đa -> WARNING thiếu dữ liệu, KHÔNG phải PASS", rule(noData, "VGA_LENGTH"), MISSING_DATA);
  check("nói rõ thiếu thông số nào", message(noData, "VGA_LENGTH"), "Chưa có thông số độ dài card tối đa của vỏ case để kiểm tra card có vừa vỏ không.");
}

console.log("\n[4] PSU_WATTAGE và ước tính công suất");
{
  const weak = checkBuild({ CPU: cpu265K, VGA: vgaAstral5080, PSU: psu(550) });
  check("265K (tối đa 250 W) + RTX 5080 (340 W) + nguồn 550 W -> ERROR", rule(weak, "PSU_WATTAGE"), ERROR);
  check(
    "ước tính dùng mức tối đa của CPU: 250 + 340 + 80 = 670 W, khuyến nghị ⌈670 × 1,3⌉ = 871 W",
    weak.power,
    { cpuW: 250, gpuW: 340, baseW: 80, estimatedW: 670, recommendedPsuW: 871 },
  );
  check("nguồn 750 W: đủ tải nhưng dưới khuyến nghị -> WARNING", rule(checkBuild({ CPU: cpu265K, VGA: vgaAstral5080, PSU: psu(750) }), "PSU_WATTAGE"), WARNING);
  check("nguồn 1200 W -> PASS", rule(checkBuild({ CPU: cpu265K, VGA: vgaAstral5080, PSU: psu(1200) }), "PSU_WATTAGE"), PASS);

  const belowVendor = checkBuild({ CPU: cpu8600G, VGA: vga5070Ti, PSU: psu(650) });
  check("đạt ⌈395 × 1,3⌉ = 514 W nhưng dưới mức hãng card khuyến nghị 750 W -> WARNING", rule(belowVendor, "PSU_WATTAGE"), WARNING);
  check("thông báo nêu mức hãng khuyến nghị", message(belowVendor, "PSU_WATTAGE"), "Nguồn 650 W thấp hơn mức hãng card đồ họa khuyến nghị (750 W).");

  const noTdp = checkBuild({ CPU: cpu8600G, VGA: vga5060NoTdp, PSU: psu(650) });
  check("card chưa có TDP -> chưa ước tính được, WARNING thiếu dữ liệu", rule(noTdp, "PSU_WATTAGE"), MISSING_DATA);
  check("card chưa có TDP -> tổng công suất null", [noTdp.power.gpuW, noTdp.power.estimatedW, noTdp.power.recommendedPsuW], [null, null, null]);
  check(
    "card chưa có TDP nhưng nguồn dưới mức hãng khuyến nghị -> WARNING thật",
    rule(checkBuild({ CPU: cpu265K, VGA: vga5060NoTdp, PSU: psu(400) }), "PSU_WATTAGE"),
    WARNING,
  );
  check(
    "card chưa có TDP nhưng riêng CPU + phần còn lại đã vượt nguồn -> vẫn ERROR",
    rule(checkBuild({ CPU: cpu265K, VGA: vga5060NoTdp, PSU: psu(300) }), "PSU_WATTAGE"),
    ERROR,
  );

  const igpuBuild = checkBuild({ CPU: cpu8600G, PSU: psu(550) });
  check("không card rời: 65 + 0 + 80 = 145 W -> PASS", [igpuBuild.power.estimatedW, rule(igpuBuild, "PSU_WATTAGE")], [145, PASS]);
  check("CPU không ghi mức tối đa -> dùng TDP", checkBuild({ CPU: cpu7800X3D }).power.cpuW, 120);
  check("nguồn không có công suất -> thiếu dữ liệu", rule(checkBuild({ CPU: cpu8600G, PSU: psu(null) }), "PSU_WATTAGE"), MISSING_DATA);
  check("chưa chọn CPU -> luật không chạy", rule(checkBuild({ VGA: vgaAstral5080, PSU: psu(550) }), "PSU_WATTAGE"), null);
  check(
    "500 W × 1,3 ra đúng 650, không bị sai số dấu phẩy động đẩy lên 651",
    checkBuild({ CPU: part("cpu-170", { tdpWatts: 170 }), VGA: part("vga-250", { tdpWatts: 250 }) }).power.recommendedPsuW,
    650,
  );
}

console.log("\n[5] MAINBOARD_FORM_FACTOR");
{
  const tooBig = checkBuild({ MAINBOARD: boardX870, CASE: caseA21 });
  check("mainboard ATX + vỏ chỉ nhận mATX/ITX -> ERROR", rule(tooBig, "MAINBOARD_FORM_FACTOR"), ERROR);
  check("thông báo nêu cỡ lớn nhất vỏ nhận", message(tooBig, "MAINBOARD_FORM_FACTOR"), "Mainboard ATX lớn hơn cỡ lớn nhất vỏ case hỗ trợ (mATX).");
  check('vỏ chỉ ghi "E-ATX" vẫn nhận mainboard ATX', rule(checkBuild({ MAINBOARD: boardX870, CASE: case5000D }), "MAINBOARD_FORM_FACTOR"), PASS);
  check('vỏ chỉ ghi "ATX" vẫn nhận mainboard mATX', rule(checkBuild({ MAINBOARD: boardB650M, CASE: caseElite301 }), "MAINBOARD_FORM_FACTOR"), PASS);
  check(
    "mainboard không có form factor (KCCSHOP) -> thiếu dữ liệu",
    rule(checkBuild({ MAINBOARD: boardKccshop, CASE: caseGungnir }), "MAINBOARD_FORM_FACTOR"),
    MISSING_DATA,
  );
}

console.log("\n[6] RAM_SLOTS");
{
  const overflow = checkBuild({ RAM: { ...ramDdr4Single, quantity: 3 }, MAINBOARD: boardH610M });
  check("3 thanh + mainboard 2 khe -> ERROR", rule(overflow, "RAM_SLOTS"), ERROR);
  check("thông báo nêu số khe", message(overflow, "RAM_SLOTS"), "Cần 3 khe cho 3 thanh RAM nhưng mainboard chỉ có 2 khe.");
  check("2 bộ × 2 thanh = 4/4 khe -> PASS", rule(checkBuild({ RAM: { ...ramDdr5Kit, quantity: 2 }, MAINBOARD: boardX870 }), "RAM_SLOTS"), PASS);
  check("3 bộ × 2 thanh = 6 > 4 khe -> ERROR", rule(checkBuild({ RAM: { ...ramDdr5Kit, quantity: 3 }, MAINBOARD: boardX870 }), "RAM_SLOTS"), ERROR);
  check("RAM thiếu số thanh -> thiếu dữ liệu", rule(checkBuild({ RAM: part("ram-x", { ramType: "DDR5" }), MAINBOARD: boardX870 }), "RAM_SLOTS"), MISSING_DATA);
}

console.log("\n[7] NO_DISPLAY_OUTPUT — CPU không có đồ họa tích hợp làm card rời thành bắt buộc");
{
  const noIgpu = checkBuild({ CPU: cpu8400F });
  check("8400F không chọn card -> WARNING", rule(noIgpu, "NO_DISPLAY_OUTPUT"), WARNING);
  check("8400F -> card đồ họa nằm trong danh sách còn thiếu", noIgpu.missingSlots.includes("VGA"), true);
  check("8400F + card rời -> luật không chạy", rule(checkBuild({ CPU: cpu8400F, VGA: vga5070Ti }), "NO_DISPLAY_OUTPUT"), null);
  const igpu = checkBuild({ CPU: cpu8600G });
  check("8600G không chọn card -> PASS (dùng đồ họa tích hợp)", rule(igpu, "NO_DISPLAY_OUTPUT"), PASS);
  check("8600G -> card đồ họa KHÔNG bắt buộc", igpu.missingSlots.includes("VGA"), false);
  const unknown = checkBuild({ CPU: part("cpu-x", { socket: "AM5", tdpWatts: 65 }) });
  check("chưa rõ có iGPU -> thiếu dữ liệu, và vẫn bắt buộc card rời", [rule(unknown, "NO_DISPLAY_OUTPUT"), unknown.missingSlots.includes("VGA")], [MISSING_DATA, true]);
}

console.log("\n[8] CPU_COOLER");
{
  check("ghi rõ không kèm tản nhiệt -> WARNING", rule(checkBuild({ CPU: cpu7800X3D }), "CPU_COOLER"), WARNING);
  check(
    "không ghi rõ -> chỉ INFO thiếu dữ liệu",
    rule(checkBuild({ CPU: cpu8600G }), "CPU_COOLER"),
    { severity: "INFO", insufficientData: true },
  );
  check("ghi rõ có kèm -> PASS", rule(checkBuild({ CPU: part("cpu-box", { extra: { coolerIncluded: true } }) }), "CPU_COOLER"), PASS);
}

console.log("\n[9] Trạng thái, tổng tiền, thứ tự");
{
  const empty = checkBuild({});
  check(
    "chưa chọn gì -> INCOMPLETE, thiếu 6 ô (chưa chọn CPU nên chưa kết luận card rời)",
    { status: empty.status, missing: empty.missingSlots, isValid: empty.isValid, rules: empty.checks.map((item) => item.rule) },
    { status: "INCOMPLETE", missing: ["CPU", "MAINBOARD", "RAM", "SSD", "PSU", "CASE"], isValid: false, rules: ["INCOMPLETE_BUILD"] },
  );

  const valid: BuildParts = {
    CPU: { ...cpu8600G, price: 5_000_000 },
    MAINBOARD: { ...boardX870, price: 6_000_000 },
    RAM: { ...ramDdr5Kit, price: 3_000_000, quantity: 2 },
    VGA: { ...vga5070Ti, price: 20_000_000 },
    SSD: { ...ssd, price: 2_000_000 },
    PSU: { ...psu(750), price: 2_500_000 },
    CASE: { ...caseGungnir, price: 3_500_000 },
  };
  const validResult = checkBuild(valid);
  check(
    "cấu hình đủ và không lỗi -> COMPATIBLE",
    { status: validResult.status, isComplete: validResult.isComplete, isValid: validResult.isValid, missing: validResult.missingSlots },
    { status: "COMPATIBLE", isComplete: true, isValid: true, missing: [] },
  );
  check("tổng tiền nhân đúng số lượng RAM", validResult.totalPrice, 5_000_000 + 6_000_000 + 3_000_000 * 2 + 20_000_000 + 2_000_000 + 2_500_000 + 3_500_000);

  const needsReview = checkBuild({ ...valid, CASE: caseElite301 });
  check(
    "đủ linh kiện, chỉ thiếu dữ liệu độ dài VGA -> NEEDS_REVIEW nhưng vẫn hợp lệ",
    { status: needsReview.status, isValid: needsReview.isValid },
    { status: "NEEDS_REVIEW", isValid: true },
  );

  const broken = checkBuild({ ...valid, CASE: caseA21 });
  check("có ERROR -> INCOMPATIBLE, không hợp lệ", { status: broken.status, isValid: broken.isValid }, { status: "INCOMPATIBLE", isValid: false });
  check("ERROR xếp đầu danh sách", broken.checks[0].severity, "ERROR");
  check("ERROR được ưu tiên hơn thiếu linh kiện", checkBuild({ CPU: cpu8600G, MAINBOARD: boardZ790 }).status, "INCOMPATIBLE");
  check("thiếu linh kiện được ưu tiên hơn WARNING", checkBuild({ CPU: cpu8400F }).status, "INCOMPLETE");
  check("chạy 2 lần ra y hệt", checkBuild(valid), checkBuild(valid));
}

console.log("\n[10] Huy hiệu trong bảng chọn linh kiện");
{
  const withZ790: BuildParts = { MAINBOARD: boardZ790 };
  const amdCpu = evaluateCandidate(withZ790, "CPU", cpu8600G);
  check("đã chọn mainboard LGA1700 -> CPU AM5 'Không tương thích'", amdCpu.fit, "INCOMPATIBLE");
  check("kèm lý do", amdCpu.reasons, ["CPU dùng socket AM5 nhưng mainboard dùng socket LGA1700 — không lắp được."]);
  check(
    "CPU cùng socket -> 'Tương thích'",
    evaluateCandidate(withZ790, "CPU", part("cpu-lga1700", { socket: "LGA1700", tdpWatts: 65, hasIgpu: true })).fit,
    "COMPATIBLE",
  );
  check("chưa chọn gì khác -> không gắn huy hiệu", evaluateCandidate({}, "CPU", cpu8600G), { fit: null, reasons: [] });
  check("CPU không kèm tản nhiệt -> 'Cần lưu ý' ngay cả khi chưa chọn gì", evaluateCandidate({}, "CPU", cpu7800X3D).fit, "WARNING");
  check("vỏ thiếu độ dài VGA khi đã chọn card -> 'Thiếu dữ liệu'", evaluateCandidate({ VGA: vgaAstral5080 }, "CASE", caseElite301).fit, "UNKNOWN");
  check(
    "thay đúng ô đang chọn: đổi mainboard AM5 sang LGA1700 khi đã có CPU AM5",
    evaluateCandidate({ CPU: cpu8600G, MAINBOARD: boardX870 }, "MAINBOARD", boardZ790).fit,
    "INCOMPATIBLE",
  );
  check(
    "RAM tính theo số lượng đang chọn",
    evaluateCandidate({ MAINBOARD: boardH610M }, "RAM", { ...ramDdr4Single, quantity: 3 }).fit,
    "INCOMPATIBLE",
  );
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
