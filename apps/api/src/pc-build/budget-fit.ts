// Tự điều chỉnh cho vừa ngân sách: hàm thuần (không DB, không mạng, không AI) — cùng đầu vào luôn ra cùng phương án.
// Chỉ đổi món đang có sang món RẺ HƠN cùng loại (không thêm/bớt loại), và chỉ nhận cấu hình đủ linh kiện, không có lỗi
// tương thích, tổng không vượt ngân sách. RAM được đổi cả số thanh (1 thanh 16GB đắt -> 2 thanh 8GB rẻ) nhưng không hạ dung lượng
// dưới MIN_RAM_GB; các loại khác giữ số lượng 1.
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
  if (!best) return null;

  const fitted = best.parts;
  const swaps = BUILD_SLOTS.flatMap((slot) => {
    const from = parts[slot];
    const to = fitted[slot];
    return from && to && (to.productId !== from.productId || to.quantity !== from.quantity) ? [{ slot, from, to }] : [];
  });
  return { parts: fitted, swaps, result: best.result };
}
