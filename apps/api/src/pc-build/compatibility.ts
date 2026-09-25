// Kiểm tra tương thích linh kiện: hàm thuần (không DB, không mạng, không AI) — cùng đầu vào luôn ra cùng kết quả.
import { BUILD_SLOTS, SLOT_LABEL_VI, type BuildSlot } from "./slots.js";
import { BOARD_SIZES, type NormalizedSpec } from "./spec-types.js";

export type CheckSeverity = "ERROR" | "WARNING" | "INFO" | "PASS";

export type CheckRule =
  | "CPU_SOCKET"
  | "RAM_TYPE"
  | "VGA_LENGTH"
  | "PSU_WATTAGE"
  | "MAINBOARD_FORM_FACTOR"
  | "RAM_SLOTS"
  | "NO_DISPLAY_OUTPUT"
  | "CPU_COOLER"
  | "INCOMPLETE_BUILD";

export interface CompatibilityCheck {
  rule: CheckRule;
  severity: CheckSeverity;
  message: string;
  productIds: string[];
  /** Thiếu thông số nên chưa kiểm tra được — không bao giờ được coi là "đạt" */
  insufficientData?: true;
}

export interface BuildPart {
  productId: string;
  quantity: number;
  price: number;
  spec: NormalizedSpec;
}

export type BuildParts = Partial<Record<BuildSlot, BuildPart>>;

export interface PowerEstimate {
  /** null: chưa chọn CPU hoặc thiếu dữ liệu */
  cpuW: number | null;
  /** 0: không dùng card rời; null: card chưa có dữ liệu TDP */
  gpuW: number | null;
  baseW: number;
  estimatedW: number | null;
  recommendedPsuW: number | null;
}

export type BuildStatus = "INCOMPATIBLE" | "INCOMPLETE" | "NEEDS_REVIEW" | "COMPATIBLE";

export interface BuildCheckResult {
  checks: CompatibilityCheck[];
  power: PowerEstimate;
  totalPrice: number;
  missingSlots: BuildSlot[];
  isComplete: boolean;
  isValid: boolean;
  status: BuildStatus;
}

export type CandidateFit = "COMPATIBLE" | "WARNING" | "INCOMPATIBLE" | "UNKNOWN";

export interface CandidateEvaluation {
  /** null: chưa có linh kiện nào khác để so */
  fit: CandidateFit | null;
  reasons: string[];
}

/** Ước tính chung cho mainboard, RAM, ổ cứng, quạt — giao diện ghi rõ con số này */
export const BASE_POWER_W = 80;

const SEVERITY_ORDER: Record<CheckSeverity, number> = { ERROR: 0, WARNING: 1, INFO: 2, PASS: 3 };

function result(rule: CheckRule, severity: CheckSeverity, message: string, productIds: string[]): CompatibilityCheck {
  return { rule, severity, message, productIds };
}

function insufficient(rule: CheckRule, message: string, productIds: string[], severity: CheckSeverity = "WARNING"): CompatibilityCheck {
  return { rule, severity, message, productIds, insufficientData: true };
}

/** CPU tính theo mức tối đa hãng công bố nếu có (Core Ultra 7 265K: 125 W thường, 250 W tối đa) */
export function estimatePower(parts: BuildParts): PowerEstimate {
  const cpu = parts.CPU?.spec;
  const cpuW = cpu ? (cpu.extra.maxPowerW ?? cpu.tdpWatts) : null;
  const gpuW = parts.VGA ? parts.VGA.spec.tdpWatts : 0;
  const estimatedW = cpuW !== null && gpuW !== null ? cpuW + gpuW + BASE_POWER_W : null;
  // Nhân 13 rồi chia 10 thay vì nhân 1.3 để không bị sai số dấu phẩy động đẩy ceil lên thêm 1
  const recommendedPsuW = estimatedW === null ? null : Math.ceil((estimatedW * 13) / 10);
  return { cpuW, gpuW, baseW: BASE_POWER_W, estimatedW, recommendedPsuW };
}

function checkCpuSocket({ CPU: cpu, MAINBOARD: board }: BuildParts): CompatibilityCheck | null {
  if (!cpu || !board) return null;
  const ids = [cpu.productId, board.productId];
  const cpuSocket = cpu.spec.socket;
  const boardSocket = board.spec.socket;
  if (!cpuSocket || !boardSocket) return insufficient("CPU_SOCKET", "Chưa đủ dữ liệu socket để kiểm tra CPU có lắp vừa mainboard không.", ids);
  if (cpuSocket !== boardSocket) {
    return result("CPU_SOCKET", "ERROR", `CPU dùng socket ${cpuSocket} nhưng mainboard dùng socket ${boardSocket} — không lắp được.`, ids);
  }
  return result("CPU_SOCKET", "PASS", `CPU và mainboard cùng socket ${cpuSocket}.`, ids);
}

function checkRamType({ RAM: ram, MAINBOARD: board }: BuildParts): CompatibilityCheck | null {
  if (!ram || !board) return null;
  const ids = [ram.productId, board.productId];
  const ramType = ram.spec.ramType;
  const boardType = board.spec.ramType;
  if (!ramType || !boardType) return insufficient("RAM_TYPE", "Chưa đủ dữ liệu chuẩn RAM (DDR4/DDR5) để kiểm tra.", ids);
  if (ramType !== boardType) return result("RAM_TYPE", "ERROR", `RAM ${ramType} không cắm được vào mainboard chỉ hỗ trợ ${boardType}.`, ids);
  return result("RAM_TYPE", "PASS", `RAM và mainboard cùng chuẩn ${ramType}.`, ids);
}

function checkVgaLength({ VGA: vga, CASE: pcCase }: BuildParts): CompatibilityCheck | null {
  if (!vga || !pcCase) return null;
  const ids = [vga.productId, pcCase.productId];
  const length = vga.spec.gpuLengthMm;
  const maxLength = pcCase.spec.caseMaxGpuMm;
  if (length === null || maxLength === null) {
    const missing = [length === null && "chiều dài card đồ họa", maxLength === null && "độ dài card tối đa của vỏ case"].filter(Boolean).join(" và ");
    return insufficient("VGA_LENGTH", `Chưa có thông số ${missing} để kiểm tra card có vừa vỏ không.`, ids);
  }
  if (length > maxLength) {
    return result("VGA_LENGTH", "ERROR", `Card dài ${length} mm nhưng vỏ case chỉ chứa được card tối đa ${maxLength} mm.`, ids);
  }
  return result("VGA_LENGTH", "PASS", `Card dài ${length} mm, vỏ case chứa được card tới ${maxLength} mm.`, ids);
}

function checkPsuWattage({ PSU: psu, CPU: cpu, VGA: vga }: BuildParts, power: PowerEstimate): CompatibilityCheck | null {
  if (!psu || !cpu) return null;
  const ids = [psu.productId, cpu.productId, ...(vga ? [vga.productId] : [])];
  const psuW = psu.spec.psuWattage;
  if (psuW === null) return insufficient("PSU_WATTAGE", "Chưa có thông số công suất nguồn để kiểm tra.", ids);
  if (power.cpuW === null) return insufficient("PSU_WATTAGE", "Chưa có thông số điện năng CPU để ước tính công suất cần.", ids);

  const vendorPsuW = vga?.spec.extra.recommendedPsuW;

  if (power.estimatedW === null || power.recommendedPsuW === null) {
    // Card chưa có TDP: vẫn bắt được trường hợp chắc chắn thiếu (chưa tính card đã vượt công suất nguồn)
    const withoutGpuW = power.cpuW + BASE_POWER_W;
    if (psuW < withoutGpuW) {
      return result("PSU_WATTAGE", "ERROR", `Nguồn ${psuW} W không đủ: chưa tính card đồ họa, hệ thống đã cần khoảng ${withoutGpuW} W.`, ids);
    }
    if (vendorPsuW !== undefined && psuW < vendorPsuW) {
      return result("PSU_WATTAGE", "WARNING", `Nguồn ${psuW} W thấp hơn mức hãng card đồ họa khuyến nghị (${vendorPsuW} W).`, ids);
    }
    const vendorNote = vendorPsuW !== undefined ? `; nguồn ${psuW} W đạt mức hãng card khuyến nghị (${vendorPsuW} W)` : "";
    return insufficient("PSU_WATTAGE", `Card đồ họa chưa có thông số điện năng nên chưa ước tính được tổng công suất${vendorNote}.`, ids);
  }

  const { estimatedW, recommendedPsuW } = power;
  if (psuW < estimatedW) {
    return result("PSU_WATTAGE", "ERROR", `Nguồn ${psuW} W không đủ: ước tính hệ thống cần khoảng ${estimatedW} W.`, ids);
  }
  if (psuW < recommendedPsuW) {
    return result(
      "PSU_WATTAGE",
      "WARNING",
      `Nguồn ${psuW} W đủ cho mức ước tính ${estimatedW} W nhưng dưới mức khuyến nghị ${recommendedPsuW} W (chừa 30% cho tải đỉnh).`,
      ids,
    );
  }
  if (vendorPsuW !== undefined && psuW < vendorPsuW) {
    return result("PSU_WATTAGE", "WARNING", `Nguồn ${psuW} W thấp hơn mức hãng card đồ họa khuyến nghị (${vendorPsuW} W).`, ids);
  }
  return result("PSU_WATTAGE", "PASS", `Nguồn ${psuW} W đủ cho mức ước tính ${estimatedW} W (khuyến nghị từ ${recommendedPsuW} W).`, ids);
}

/** Vỏ case nhận cỡ lớn nhất nó liệt kê và mọi cỡ nhỏ hơn — dữ liệu hay chỉ ghi "ATX" trơn */
function checkBoardFormFactor({ MAINBOARD: board, CASE: pcCase }: BuildParts): CompatibilityCheck | null {
  if (!board || !pcCase) return null;
  const ids = [board.productId, pcCase.productId];
  const size = board.spec.formFactor;
  const accepted = pcCase.spec.caseFormFactors;
  if (!size || !accepted || accepted.length === 0) {
    return insufficient("MAINBOARD_FORM_FACTOR", "Chưa đủ dữ liệu kích thước mainboard / vỏ case để kiểm tra.", ids);
  }
  const largest = BOARD_SIZES[Math.min(...accepted.map((item) => BOARD_SIZES.indexOf(item)))];
  if (BOARD_SIZES.indexOf(size) < BOARD_SIZES.indexOf(largest)) {
    return result("MAINBOARD_FORM_FACTOR", "ERROR", `Mainboard ${size} lớn hơn cỡ lớn nhất vỏ case hỗ trợ (${largest}).`, ids);
  }
  return result("MAINBOARD_FORM_FACTOR", "PASS", `Vỏ case nhận mainboard tới cỡ ${largest}, lắp vừa mainboard ${size}.`, ids);
}

function checkRamSlots({ RAM: ram, MAINBOARD: board }: BuildParts): CompatibilityCheck | null {
  if (!ram || !board) return null;
  const ids = [ram.productId, board.productId];
  const modules = ram.spec.ramModules;
  const slots = board.spec.ramSlots;
  if (modules === null || slots === null) return insufficient("RAM_SLOTS", "Chưa đủ dữ liệu số thanh RAM / số khe RAM của mainboard để kiểm tra.", ids);
  const sticks = modules * ram.quantity;
  if (sticks > slots) return result("RAM_SLOTS", "ERROR", `Cần ${sticks} khe cho ${sticks} thanh RAM nhưng mainboard chỉ có ${slots} khe.`, ids);
  return result("RAM_SLOTS", "PASS", `Dùng ${sticks}/${slots} khe RAM của mainboard.`, ids);
}

function checkDisplayOutput({ CPU: cpu, VGA: vga }: BuildParts): CompatibilityCheck | null {
  if (!cpu || vga) return null;
  const ids = [cpu.productId];
  if (cpu.spec.hasIgpu === null) {
    return insufficient("NO_DISPLAY_OUTPUT", "Chưa rõ CPU có đồ họa tích hợp không — nên chọn thêm card đồ họa rời để chắc chắn có hình ảnh.", ids);
  }
  if (!cpu.spec.hasIgpu) {
    return result("NO_DISPLAY_OUTPUT", "WARNING", "CPU này không có đồ họa tích hợp — cần thêm card đồ họa rời thì máy mới xuất được hình.", ids);
  }
  return result("NO_DISPLAY_OUTPUT", "PASS", "Chưa chọn card đồ họa rời: máy xuất hình qua đồ họa tích hợp của CPU.", ids);
}

function checkCpuCooler({ CPU: cpu }: BuildParts): CompatibilityCheck | null {
  if (!cpu) return null;
  const ids = [cpu.productId];
  const included = cpu.spec.extra.coolerIncluded;
  if (included === false) {
    return result("CPU_COOLER", "WARNING", "CPU này không kèm tản nhiệt — cần mua thêm tản nhiệt riêng (Build PC chưa có ô chọn tản nhiệt).", ids);
  }
  if (included === true) return result("CPU_COOLER", "PASS", "CPU có kèm tản nhiệt theo hộp.", ids);
  return insufficient("CPU_COOLER", "Thông tin sản phẩm không ghi rõ CPU có kèm tản nhiệt không — nên hỏi lại trước khi mua.", ids, "INFO");
}

/** VGA bắt buộc khi CPU đã chọn không chắc có đồ họa tích hợp; chưa chọn CPU thì chưa kết luận được */
function requiredSlots(parts: BuildParts): BuildSlot[] {
  const cpu = parts.CPU;
  return BUILD_SLOTS.filter((slot) => slot !== "VGA" || (cpu !== undefined && cpu.spec.hasIgpu !== true));
}

export function checkBuild(parts: BuildParts): BuildCheckResult {
  const power = estimatePower(parts);
  const missingSlots = requiredSlots(parts).filter((slot) => !parts[slot]);

  const checks = [
    checkCpuSocket(parts),
    checkRamType(parts),
    checkVgaLength(parts),
    checkPsuWattage(parts, power),
    checkBoardFormFactor(parts),
    checkRamSlots(parts),
    checkDisplayOutput(parts),
    checkCpuCooler(parts),
    missingSlots.length > 0
      ? result("INCOMPLETE_BUILD", "INFO", `Còn thiếu: ${missingSlots.map((slot) => SLOT_LABEL_VI[slot]).join(", ")}.`, [])
      : null,
  ]
    .filter((check): check is CompatibilityCheck => check !== null)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const hasError = checks.some((check) => check.severity === "ERROR");
  const isComplete = missingSlots.length === 0;
  const status: BuildStatus = hasError
    ? "INCOMPATIBLE"
    : !isComplete
      ? "INCOMPLETE"
      : checks.some((check) => check.severity === "WARNING")
        ? "NEEDS_REVIEW"
        : "COMPATIBLE";

  const totalPrice = BUILD_SLOTS.reduce((sum, slot) => {
    const part = parts[slot];
    return part ? sum + part.price * part.quantity : sum;
  }, 0);

  return { checks, power, totalPrice, missingSlots, isComplete, isValid: isComplete && !hasError, status };
}

/** Huy hiệu cho một lựa chọn trong bảng chọn linh kiện: thay vào ô của nó rồi xem các luật liên quan tới nó */
export function evaluateCandidate(parts: BuildParts, slot: BuildSlot, candidate: BuildPart): CandidateEvaluation {
  const relevant = checkBuild({ ...parts, [slot]: candidate }).checks.filter(
    (check) => check.severity !== "INFO" && check.productIds.includes(candidate.productId),
  );
  const messages = (predicate: (check: CompatibilityCheck) => boolean) => relevant.filter(predicate).map((check) => check.message);

  const errors = messages((check) => check.severity === "ERROR");
  if (errors.length > 0) return { fit: "INCOMPATIBLE", reasons: errors };
  const warnings = messages((check) => check.severity === "WARNING" && !check.insufficientData);
  if (warnings.length > 0) return { fit: "WARNING", reasons: warnings };
  const unknown = messages((check) => check.insufficientData === true);
  if (unknown.length > 0) return { fit: "UNKNOWN", reasons: unknown };
  // "Tương thích" chỉ khi thật sự đã so với ít nhất một linh kiện khác
  if (relevant.some((check) => check.severity === "PASS" && check.productIds.length > 1)) return { fit: "COMPATIBLE", reasons: [] };
  return { fit: null, reasons: [] };
}
