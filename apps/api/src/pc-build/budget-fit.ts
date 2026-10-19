// Tự điều chỉnh theo ngân sách: hàm thuần (không DB, không mạng, không AI) — cùng đầu vào luôn ra cùng phương án.
// `fitToBudget` đổi món đang có sang món RẺ HƠN cùng loại khi vượt ngân sách; `upgradeWithinBudget` ngược lại, đổi sang món
// ĐẮT HƠN khi dùng quá ít ngân sách. Cả hai không thêm/bớt loại, và chỉ nhận cấu hình đủ linh kiện, không có lỗi tương thích,
// tổng không vượt ngân sách. RAM được đổi cả số thanh (1 thanh 16GB đắt -> 2 thanh 8GB rẻ) nhưng khi hạ không xuống dưới
// MIN_RAM_GB; các loại khác giữ số lượng 1.
import { checkBuild, type BuildCheckResult, type BuildPart, type BuildParts } from "./compatibility.js";
import { BUILD_SLOTS, type BuildSlot } from "./slots.js";

/** Tổng RAM không hạ xuống dưới mức này, trừ khi cấu hình ban đầu vốn đã ít hơn */
const MIN_RAM_GB = 16;
/** Số thanh RAM được thử: bỏ 3 thanh cho khỏi lệch kênh đôi */
const RAM_QUANTITIES = [1, 2, 4];

/** Phạt mỗi món phải đổi (tính như bớt ngần ấy đồng đã nhân trọng số) — cùng mức thiệt thì đổi ít món hơn */
const CHANGE_PENALTY = 300_000;
/** Phạt mỗi cảnh báo mới so với cấu hình ban đầu (vd. vỏ mới không có số liệu độ dài card tối đa, nguồn sát mức khuyến nghị) */
const WARNING_PENALTY = 2_000_000;
/** Trần số nút duyệt, đủ rộng cho kho ~100 linh kiện; chạm trần thì dùng phương án tốt nhất đã tìm thấy */
const MAX_NODES = 200_000;

export type BuildCandidates = Partial<Record<BuildSlot, BuildPart[]>>;

export interface BudgetSwap {
  slot: BuildSlot;
  from: BuildPart;
  to: BuildPart;
}

export interface BudgetFit {
  parts: BuildParts;
  /** Theo thứ tự ô của Build PC */
  swaps: BudgetSwap[];
  result: BuildCheckResult;
}

interface Best {
  score: number;
  parts: BuildParts;
  result: BuildCheckResult;
}

function countWarnings(result: BuildCheckResult): number {
  return result.checks.filter((check) => check.severity === "WARNING").length;
}

const costOf = (part: BuildPart) => part.price * part.quantity;

/** Các lựa chọn rẻ hơn cho một ô, kèm số lượng; RAM thử nhiều số thanh nhưng giữ dung lượng tối thiểu */
function cheaperOptions(slot: BuildSlot, current: BuildPart, candidates: BuildPart[]): BuildPart[] {
  if (slot !== "RAM") {
    return candidates
      .filter((candidate) => candidate.price < current.price && candidate.productId !== current.productId)
      .map((candidate) => ({ ...candidate, quantity: current.quantity }));
  }
  const currentGb = current.spec.ramCapacity === null ? null : current.spec.ramCapacity * current.quantity;
  const floorGb = currentGb === null ? MIN_RAM_GB : Math.min(currentGb, MIN_RAM_GB);
  return candidates.flatMap((candidate) => {
    const gb = candidate.spec.ramCapacity;
    if (gb === null) return []; // không rõ dung lượng thì không dám đổi sang
    return RAM_QUANTITIES.filter(
      (quantity) =>
        !(candidate.productId === current.productId && quantity === current.quantity) &&
        candidate.price * quantity < costOf(current) &&
        gb * quantity >= floorGb,
    ).map((quantity) => ({ ...candidate, quantity }));
  });
}

/**
 * Tìm cách đổi ÍT THIỆT NHẤT để tổng không vượt `budget`. Thiệt = Σ trọng số của loại × số tiền bớt ở loại đó (loại quan
 * trọng với nhu cầu có trọng số cao nên được giữ lâu nhất) + phạt mỗi món đổi + phạt mỗi cảnh báo mới. Duyệt nhánh-và-cận.
 * `null`: không vượt ngân sách, hoặc không có cách đổi nào hợp lệ.
 */
export function fitToBudget(parts: BuildParts, candidates: BuildCandidates, budget: number, weights: Record<BuildSlot, number>): BudgetFit | null {
  const original = checkBuild(parts);
  if (original.totalPrice <= budget) return null;

  // Loại quan trọng xét trước: nhánh "giữ nguyên" của chúng được duyệt trước, nên phương án đầu tiên tìm thấy đã cắt ở loại
  // ít quan trọng — cận của nó chặt, cắt bỏ được nhiều nhánh
  const slots = BUILD_SLOTS.filter((slot) => parts[slot] !== undefined).sort((a, b) => weights[b] - weights[a]);
  const currentOf = (slot: BuildSlot) => parts[slot] as BuildPart;
  const options = slots.map((slot) =>
    cheaperOptions(slot, currentOf(slot), candidates[slot] ?? [])
      // Rẻ hơn ít nhất trước = thiệt ít nhất trước, nên gặp món đã quá thiệt là bỏ được cả phần còn lại
      .sort((a, b) => costOf(b) - costOf(a) || a.productId.localeCompare(b.productId) || a.quantity - b.quantity),
  );

  // Số tiền bớt được nhiều nhất từ loại thứ i trở đi (mỗi loại đổi sang món rẻ nhất) — bỏ sớm nhánh không thể vừa ngân sách
  const maxSavingFrom = new Array<number>(slots.length + 1).fill(0);
  for (let index = slots.length - 1; index >= 0; index--) {
    const cheapest = options[index].at(-1);
    maxSavingFrom[index] = maxSavingFrom[index + 1] + (cheapest ? costOf(currentOf(slots[index])) - costOf(cheapest) : 0);
  }
  if (original.totalPrice - maxSavingFrom[0] > budget) return null;

  const baseWarnings = countWarnings(original);
  const working: BuildParts = { ...parts };
  // Khai báo kiểu qua `as`: best được gán trong hàm lồng, TypeScript không theo dõi được nên sẽ hiểu nhầm luôn là null
  let best = null as Best | null;
  let nodes = 0;

  function visit(index: number, total: number, loss: number, changes: number): void {
    if (++nodes > MAX_NODES) return;
    const bound = loss + changes * CHANGE_PENALTY;
    if (best && bound >= best.score) return;
    if (total - maxSavingFrom[index] > budget) return;

    if (index === slots.length) {
      // Tới đây tổng chắc chắn ≤ ngân sách (maxSavingFrom cuối = 0) và đã đổi ít nhất một món
      const result = checkBuild(working);
      if (!result.isComplete || result.checks.some((check) => check.severity === "ERROR")) return;
      const score = bound + Math.max(0, countWarnings(result) - baseWarnings) * WARNING_PENALTY;
      if (!best || score < best.score) best = { score, parts: { ...working }, result };
      return;
    }

    const slot = slots[index];
    const current = currentOf(slot);
    visit(index + 1, total, loss, changes);
    for (const candidate of options[index]) {
      const saving = costOf(current) - costOf(candidate);
      const nextLoss = loss + weights[slot] * saving;
      if (best && nextLoss + (changes + 1) * CHANGE_PENALTY >= best.score) break;
      working[slot] = candidate;
      visit(index + 1, total - saving, nextLoss, changes + 1);
    }
    working[slot] = current;
  }

  visit(0, original.totalPrice, 0, 0);
  return best ? { parts: best.parts, swaps: swapsBetween(parts, best.parts), result: best.result } : null;
}

function swapsBetween(parts: BuildParts, fitted: BuildParts): BudgetSwap[] {
  return BUILD_SLOTS.flatMap((slot) => {
    const from = parts[slot];
    const to = fitted[slot];
    return from && to && (to.productId !== from.productId || to.quantity !== from.quantity) ? [{ slot, from, to }] : [];
  });
}

/* ------------------------------------------------------------------------------------------------------------------ */
/*  Nâng cấp khi dùng quá ít ngân sách                                                                                */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Mainboard, nguồn, vỏ đắt hơn không làm máy mạnh hơn: khi nâng cấp chỉ đổi kèm khi món được nâng cần (socket, công suất, độ dài card) */
const COMPANION_SLOTS: readonly BuildSlot[] = ["MAINBOARD", "PSU", "CASE"];
/** Nâng RAM không dùng quá ngần ấy thanh (trừ khi bộ ban đầu đã nhiều hơn): chừa khe để nâng sau, kênh đôi chạy ổn định */
const MAX_UPGRADE_RAM_STICKS = 2;
/** Phạt mỗi món đổi, tính theo đơn vị lợi ích (≈ món trọng số 1 đắt thêm 10%) — bỏ qua những lần nâng lặt vặt */
const UPGRADE_CHANGE_PENALTY = 0.1;
/** Phạt mỗi cảnh báo "thiếu dữ liệu" mới (vd. card mới chưa có số liệu chiều dài); cảnh báo thật thì không được phát sinh */
const UPGRADE_WARNING_PENALTY = 0.3;
/** Sai số dấu phẩy động khi so điểm */
const EPSILON = 1e-9;

interface UpgradeOption {
  part: BuildPart;
  /** Số tiền thêm so với món đang có */
  extra: number;
  gain: number;
}

const isCompanion = (slot: BuildSlot) => COMPANION_SLOTS.includes(slot);

function countRealWarnings(result: BuildCheckResult): number {
  return result.checks.filter((check) => check.severity === "WARNING" && !check.insufficientData).length;
}

/** Tổng dung lượng: RAM tính theo GB × số bộ, SSD theo GB; các loại khác không xét dung lượng */
function capacityOf(slot: BuildSlot, part: BuildPart): number | null {
  if (slot === "RAM") return part.spec.ramCapacity === null ? null : part.spec.ramCapacity * part.quantity;
  if (slot === "SSD") return part.spec.storageCapacityGb;
  return null;
}

const cheaperFirst = (a: BuildPart, b: BuildPart) => costOf(a) - costOf(b) || a.productId.localeCompare(b.productId) || a.quantity - b.quantity;

/**
 * Các lựa chọn không rẻ hơn cho một ô. RAM, SSD: không giảm dung lượng, và cùng chuẩn + dung lượng + số thanh thì chỉ giữ món rẻ
 * nhất — đắt hơn mà cùng dung lượng thường chỉ khác đèn RGB, thương hiệu, không phải nâng cấp. RAM thử nhiều số thanh.
 */
function pricierOptions(slot: BuildSlot, current: BuildPart, candidates: BuildPart[]): BuildPart[] {
  const quantities = slot === "RAM" ? RAM_QUANTITIES : [current.quantity];
  const options = candidates
    .flatMap((candidate) => quantities.map((quantity) => ({ ...candidate, quantity })))
    .filter((option) => !(option.productId === current.productId && option.quantity === current.quantity) && costOf(option) >= costOf(current))
    .sort(cheaperFirst);
  if (slot !== "RAM" && slot !== "SSD") return options;

  const currentCapacity = capacityOf(slot, current);
  if (currentCapacity === null) return []; // không rõ dung lượng đang có thì không biết món nào là nâng
  const sticksOf = (part: BuildPart) => (part.spec.ramModules === null ? null : part.spec.ramModules * part.quantity);
  const currentSticks = sticksOf(current) ?? 0;
  // Món đang có đứng đầu: món đắt hơn mà cùng nhóm với nó không bao giờ là nâng cấp
  const cheapestByGroup = new Map<string, BuildPart>();
  for (const option of [current, ...options]) {
    const capacity = capacityOf(slot, option);
    if (capacity === null || capacity < currentCapacity) continue;
    const sticks = sticksOf(option);
    if (slot === "RAM" && option !== current && (sticks === null || sticks > Math.max(MAX_UPGRADE_RAM_STICKS, currentSticks))) continue;
    const group = slot === "RAM" ? `${option.spec.ramType}|${capacity}|${sticks}` : String(capacity);
    if (!cheapestByGroup.has(group)) cheapestByGroup.set(group, option);
  }
  return [...cheapestByGroup.values()].filter((option) => option !== current);
}

/**
 * Lợi của một lần đổi = trọng số × ln(giá mới / giá cũ); RAM, SSD tính theo dung lượng thay vì giá. Lấy log nên mỗi đồng thêm
 * vào món đã đắt đáng ít dần: tiền dư được rải theo trọng số (tối ưu khi tiền mỗi loại tỉ lệ với trọng số) thay vì dồn hết
 * vào một món. Món đi kèm (mainboard, nguồn, vỏ) không có lợi.
 */
function upgradeGain(slot: BuildSlot, from: BuildPart, to: BuildPart, weight: number): number {
  if (isCompanion(slot)) return 0;
  const byCapacity = slot === "RAM" || slot === "SSD";
  const before = byCapacity ? capacityOf(slot, from) : costOf(from);
  const after = byCapacity ? capacityOf(slot, to) : costOf(to);
  return before && after && after > before ? weight * Math.log(after / before) : 0;
}

/**
 * Ngược với `fitToBudget`: cấu hình dùng quá ít ngân sách thì nâng vài món lên món đắt hơn cùng loại, chọn phương án LỢI NHẤT
 * (xem `upgradeGain`) trừ phạt mỗi món đổi và mỗi cảnh báo thiếu dữ liệu mới. Chỉ nhận cấu hình tổng không vượt `budget`, đủ
 * linh kiện, không lỗi tương thích, không thêm cảnh báo thật (vd. nguồn dưới mức khuyến nghị — phải nâng nguồn kèm theo, CPU
 * không kèm tản nhiệt). Bên gọi quyết định khi nào cần nâng. Duyệt nhánh-và-cận.
 * `null`: không còn tiền dư, hoặc không có cách nâng nào đáng.
 */
export function upgradeWithinBudget(parts: BuildParts, candidates: BuildCandidates, budget: number, weights: Record<BuildSlot, number>): BudgetFit | null {
  const original = checkBuild(parts);
  const room = budget - original.totalPrice;
  if (room <= 0) return null;

  // Loại có lợi xét trước, trọng số cao trước — nhánh nâng nó được duyệt sớm nên sớm có phương án tốt, cận chặt; món đi kèm sau cùng
  const slots = BUILD_SLOTS.filter((slot) => parts[slot] !== undefined).sort(
    (a, b) => Number(isCompanion(a)) - Number(isCompanion(b)) || weights[b] - weights[a],
  );
  const currentOf = (slot: BuildSlot) => parts[slot] as BuildPart;
  const options: UpgradeOption[][] = slots.map((slot) => {
    const current = currentOf(slot);
    return pricierOptions(slot, current, candidates[slot] ?? [])
      .map((part) => ({ part, extra: costOf(part) - costOf(current), gain: upgradeGain(slot, current, part, weights[slot]) }))
      .filter((option) => option.extra <= room)
      // Món đi kèm rẻ trước; món có lợi thì lợi nhiều trước, cùng lợi thì rẻ trước
      .sort((a, b) => (isCompanion(slot) ? a.extra - b.extra : b.gain - a.gain || a.extra - b.extra) || cheaperFirst(a.part, b.part));
  });

  // Mỗi loại: lợi lớn nhất mua được với từng mức tiền thêm (bậc thang tăng dần) — cận trên cho phần chưa xét với số tiền còn lại
  const ladders = options.map((list) => {
    let top = 0;
    return [...list].sort((a, b) => a.extra - b.extra).map((option) => ({ extra: option.extra, gain: (top = Math.max(top, option.gain)) }));
  });
  function gainBound(from: number, money: number): number {
    let sum = 0;
    for (let index = from; index < slots.length; index++) {
      let gain = 0;
      for (const step of ladders[index]) {
        if (step.extra > money) break;
        gain = step.gain;
      }
      sum += gain;
    }
    return sum;
  }

  const baseWarnings = countWarnings(original);
  const baseRealWarnings = countRealWarnings(original);
  const working: BuildParts = { ...parts };
  let best = null as (Best & { total: number }) | null;
  let nodes = 0;

  function visit(index: number, total: number, gain: number, changes: number): void {
    if (++nodes > MAX_NODES) return;
    const score = gain - changes * UPGRADE_CHANGE_PENALTY;
    if (best && score + gainBound(index, budget - total) < best.score - EPSILON) return;

    if (index === slots.length) {
      if (changes === 0 || score <= 0) return;
      const result = checkBuild(working);
      if (!result.isComplete || result.checks.some((check) => check.severity === "ERROR") || countRealWarnings(result) > baseRealWarnings) return;
      const finalScore = score - Math.max(0, countWarnings(result) - baseWarnings) * UPGRADE_WARNING_PENALTY;
      if (finalScore <= 0) return;
      // Cùng điểm thì lấy phương án rẻ hơn (vd. hai nguồn cùng đủ công suất)
      if (!best || finalScore > best.score + EPSILON || (finalScore > best.score - EPSILON && total < best.total)) {
        best = { score: finalScore, total, parts: { ...working }, result };
      }
      return;
    }

    const slot = slots[index];
    const current = currentOf(slot);
    // Món đi kèm: giữ nguyên trước (chỉ đổi khi bắt buộc); món có lợi: thử nâng trước
    if (isCompanion(slot)) visit(index + 1, total, gain, changes);
    for (const option of options[index]) {
      if (total + option.extra > budget) continue;
      working[slot] = option.part;
      visit(index + 1, total + option.extra, gain + option.gain, changes + 1);
    }
    working[slot] = current;
    if (!isCompanion(slot)) visit(index + 1, total, gain, changes);
  }

  visit(0, original.totalPrice, 0, 0);
  return best ? { parts: best.parts, swaps: swapsBetween(parts, best.parts), result: best.result } : null;
}
