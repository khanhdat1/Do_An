// AI gợi ý cấu hình: hàm thuần, không gọi mạng/DB. AI chỉ được trả MÃ trong danh sách ứng viên server đưa ra;
// mọi thứ nó trả về đều được kiểm lại ở đây như dữ liệu không tin cậy.
import { z } from "zod";
import type { BuildCheckResult } from "../pc-build/compatibility.js";
import { BUILD_SLOTS, isBuildSlot, MAX_RAM_QUANTITY, SLOT_LABEL_VI, type BuildSlot } from "../pc-build/slots.js";
import { formatMoneyLabel, parsePriceIntent } from "../search/price-intent.js";
import { normalize } from "../search/text.js";
import type { SpecRowDto } from "../types/dto.js";
import { formatPrice } from "../utils/format.js";

export const BUILD_PURPOSES = ["Chơi game", "Đồ họa - dựng video", "Văn phòng - học tập", "Lập trình - AI", "Đa dụng"] as const;
export type BuildPurpose = (typeof BUILD_PURPOSES)[number];

/** Nhu cầu này thì bắt buộc có card đồ họa rời, kể cả khi CPU có đồ họa tích hợp */
const NEEDS_DISCRETE_GPU: readonly BuildPurpose[] = ["Chơi game", "Đồ họa - dựng video", "Lập trình - AI"];

/**
 * Bước tự điều chỉnh cho vừa ngân sách (không dùng AI — pc-build/budget-fit.ts): mức "tiếc" khi phải hạ cấp từng loại, càng
 * cao càng được giữ lâu. Chỉ để xếp thứ tự đánh đổi giữa các loại theo nhu cầu, không phải điểm hiệu năng.
 */
const DOWNGRADE_WEIGHTS: Record<BuildPurpose, Record<BuildSlot, number>> = {
  "Chơi game": { VGA: 3, CPU: 1.5, RAM: 1, SSD: 0.8, MAINBOARD: 0.6, PSU: 0.6, CASE: 0.4 },
  "Đồ họa - dựng video": { CPU: 2, VGA: 2, RAM: 1.5, SSD: 1, MAINBOARD: 0.6, PSU: 0.6, CASE: 0.4 },
  "Lập trình - AI": { CPU: 2, VGA: 2, RAM: 1.5, SSD: 1, MAINBOARD: 0.6, PSU: 0.6, CASE: 0.4 },
  "Văn phòng - học tập": { CPU: 1.5, RAM: 1.2, SSD: 1.2, VGA: 0.6, MAINBOARD: 0.6, PSU: 0.6, CASE: 0.4 },
  "Đa dụng": { CPU: 1.5, VGA: 1.5, RAM: 1.2, SSD: 1, MAINBOARD: 0.6, PSU: 0.6, CASE: 0.4 },
};

export function downgradeWeights(purpose: BuildPurpose): Record<BuildSlot, number> {
  return DOWNGRADE_WEIGHTS[purpose];
}

const MIN_BUDGET = 1_000_000;
const MAX_BUDGET = 1_000_000_000;
const SUMMARY_MAX_LENGTH = 1200;
const NOTE_MAX_LENGTH = 300;

const CODE_PREFIX: Record<BuildSlot, string> = { CPU: "C", MAINBOARD: "M", RAM: "R", VGA: "V", SSD: "S", PSU: "P", CASE: "K" };

export interface CatalogEntry {
  slot: BuildSlot;
  productId: string;
  name: string;
  price: number;
  keySpecs: SpecRowDto[];
}

export interface CatalogItem extends CatalogEntry {
  code: string;
}

export interface Catalog {
  items: CatalogItem[];
  byCode: Map<string, CatalogItem>;
}

/** Mã đánh theo thứ tự đầu vào trong từng loại — bên gọi đã xếp giá tăng dần */
export function buildCatalog(entries: CatalogEntry[]): Catalog {
  const counters = new Map<BuildSlot, number>();
  const items = entries.map((entry) => {
    const index = (counters.get(entry.slot) ?? 0) + 1;
    counters.set(entry.slot, index);
    return { ...entry, code: `${CODE_PREFIX[entry.slot]}${index}` };
  });
  return { items, byCode: new Map(items.map((item) => [item.code, item])) };
}

export function formatCatalog(catalog: Catalog): string {
  return BUILD_SLOTS.map((slot) => {
    const lines = catalog.items
      .filter((item) => item.slot === slot)
      .map((item) => `${item.code} | ${item.name} | ${formatPrice(item.price)} | ${item.keySpecs.map((spec) => `${spec.label}: ${spec.value}`).join("; ")}`);
    return `[${slot} — ${SLOT_LABEL_VI[slot]}]\n${lines.length > 0 ? lines.join("\n") : "(hiện hết hàng)"}`;
  }).join("\n\n");
}

export function buildSystemPrompt(catalog: Catalog): string {
  return `Bạn là chuyên gia tư vấn build PC của PCZone. Hãy chọn ĐÚNG MỘT cấu hình PC đầy đủ cho yêu cầu của khách, CHỈ dùng mã linh kiện trong "Kho linh kiện" bên dưới (hàng thật đang bán, giá cập nhật ngay lúc này).

Luật bắt buộc:
1. Mỗi loại chọn 1 mã lấy đúng từ mục của loại đó. Tuyệt đối không tự đặt mã, không nhắc sản phẩm ngoài danh sách.
2. Bắt buộc có CPU, MAINBOARD, RAM, SSD, PSU, CASE. Có VGA (card đồ họa rời) khi CPU không có đồ họa tích hợp hoặc khi nhu cầu là chơi game, đồ họa - dựng video, lập trình - AI. Chỉ để VGA là null khi CPU có đồ họa tích hợp và nhu cầu nhẹ (văn phòng, học tập).
3. Tương thích: Socket CPU trùng Socket mainboard. Loại RAM trùng Loại RAM của mainboard. Số thanh RAM × ramQuantity không vượt Số khe RAM. Kích thước mainboard phải được vỏ case hỗ trợ (vỏ nhận cỡ lớn nhất nó ghi và mọi cỡ nhỏ hơn: E-ATX > ATX > mATX > ITX). Chiều dài card không vượt "VGA dài tối đa" của vỏ (nếu có số liệu). Công suất nguồn ≥ (điện năng CPU theo mức tối đa nếu có + TDP card + 80 W) × 1,3 và không thấp hơn "Nguồn hãng khuyến nghị" của card.
4. Tổng giá không vượt ngân sách khách nêu, nhưng tận dụng ngân sách: tổng nên đạt khoảng 85–100% ngân sách (trừ khi khách muốn tiết kiệm). Phân bổ theo nhu cầu: chơi game, đồ họa ưu tiên card đồ họa (thường khoảng 35–45% ngân sách); lập trình - AI ưu tiên CPU, RAM và card; văn phòng thì tiết kiệm. Ngân sách quá thấp cho một bộ đủ linh kiện thì chọn bộ rẻ nhất có thể và nói rõ trong summary.
5. Hạn chế CPU có "Tản nhiệt kèm theo: Không" (PCZone chưa bán tản nhiệt rời); nếu vẫn chọn thì nhắc khách mua thêm tản nhiệt. Chỉ nói một CPU không kèm tản nhiệt khi thông số ghi rõ như vậy.
6. Không nêu số FPS, điểm benchmark hay hứa chơi mượt một game cụ thể. Không tự cộng tổng tiền (hệ thống tự tính). Chỉ giải thích dựa trên thông số có trong danh sách. Trong summary và notes gọi linh kiện bằng tên, không nhắc mã (C1, M2…).
7. Khách không nêu ngân sách thì để budget là null và chọn cấu hình tầm trung hợp lý cho nhu cầu.

Chỉ trả lời bằng MỘT object JSON đúng dạng sau, không kèm chữ nào khác (viết "plan" TRƯỚC rồi mới chọn "picks"):
{"budget": <ngân sách khách nêu, số nguyên VNĐ, hoặc null>, "purpose": "<đúng một trong: ${BUILD_PURPOSES.join(" | ")}>", "plan": "<1-2 câu: dự kiến chia ngân sách cho từng linh kiện>", "picks": {"CPU": "<mã>", "MAINBOARD": "<mã>", "RAM": "<mã>", "VGA": "<mã hoặc null>", "SSD": "<mã>", "PSU": "<mã>", "CASE": "<mã>"}, "ramQuantity": <số bộ RAM, 1-${MAX_RAM_QUANTITY}>, "summary": "<2-4 câu tiếng Việt tóm tắt cấu hình>", "notes": {"CPU": "<1 câu lý do chọn>", "...": "..."}}

Kho linh kiện (mã | tên | giá | thông số):
${formatCatalog(catalog)}`;
}

export interface ParsedSuggestion {
  picks: Partial<Record<BuildSlot, { productId: string; quantity: number }>>;
  budget: number | null;
  purpose: BuildPurpose;
  summary: string;
  notes: Partial<Record<BuildSlot, string>>;
  /** Mã AI đưa ra nhưng không có trong kho hoặc nằm sai loại */
  rejectedCodes: string[];
}

const responseSchema = z.object({
  budget: z.unknown().optional(),
  purpose: z.unknown().optional(),
  picks: z.record(z.string(), z.unknown()).optional(),
  ramQuantity: z.unknown().optional(),
  summary: z.unknown().optional(),
  notes: z.record(z.string(), z.unknown()).optional(),
});

/** Chịu được khối ```json và chữ thừa quanh object */
function extractJson(raw: string): unknown {
  const text = raw.replace(/```(?:json)?/gi, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function readCode(value: unknown): string | null {
  const text = typeof value === "string" ? value : value && typeof value === "object" && "code" in value ? String(value.code) : "";
  const match = /^\s*([A-Za-z])(\d{1,3})(?!\d)/.exec(text);
  return match ? `${match[1].toUpperCase()}${match[2]}` : null;
}

function readQuantity(value: unknown): number {
  const quantity = Math.round(Number(value));
  if (!Number.isFinite(quantity) || quantity < 1) return 1;
  return Math.min(quantity, MAX_RAM_QUANTITY);
}

function readBudget(value: unknown): number | null {
  const amount = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/\D/g, "")) : NaN;
  return Number.isFinite(amount) && amount >= MIN_BUDGET && amount <= MAX_BUDGET ? Math.round(amount) : null;
}

/** AI hay ghép nhu cầu ("Chơi game, dựng video") thay vì chọn đúng một mục — lấy mục đầu tiên khớp theo thứ tự này */
const PURPOSE_KEYWORDS: [BuildPurpose, RegExp][] = [
  ["Chơi game", /\b(choi game|game|gaming)\b/],
  ["Đồ họa - dựng video", /\b(do hoa|dung video|video|render|thiet ke)\b/],
  ["Lập trình - AI", /\b(lap trinh|code|coding|ai|machine learning)\b/],
  ["Văn phòng - học tập", /\b(van phong|hoc tap|hoc online)\b/],
];

function readPurpose(value: unknown): BuildPurpose {
  const text = typeof value === "string" ? normalize(value) : "";
  return (
    BUILD_PURPOSES.find((purpose) => normalize(purpose) === text) ?? PURPOSE_KEYWORDS.find(([, pattern]) => pattern.test(text))?.[0] ?? "Đa dụng"
  );
}

/** null = không đọc được JSON — tính là một vấn đề cho lượt sửa */
export function parseSuggestion(raw: string, catalog: Catalog): ParsedSuggestion | null {
  const parsed = responseSchema.safeParse(extractJson(raw));
  if (!parsed.success) return null;
  const data = parsed.data;

  const ramQuantity = readQuantity(data.ramQuantity);
  const picks: ParsedSuggestion["picks"] = {};
  const rejectedCodes: string[] = [];
  for (const [key, value] of Object.entries(data.picks ?? {})) {
    const slot = key.trim().toUpperCase();
    if (!isBuildSlot(slot) || value === null || value === undefined || value === "") continue;
    const code = readCode(value);
    const item = code ? catalog.byCode.get(code) : undefined;
    if (!item || item.slot !== slot) {
      rejectedCodes.push(String(code ?? value).slice(0, 20));
      continue;
    }
    picks[slot] = { productId: item.productId, quantity: slot === "RAM" ? ramQuantity : 1 };
  }

  const notes: ParsedSuggestion["notes"] = {};
  for (const [key, value] of Object.entries(data.notes ?? {})) {
    const slot = key.trim().toUpperCase();
    if (isBuildSlot(slot) && picks[slot] && typeof value === "string" && value.trim()) notes[slot] = value.trim().slice(0, NOTE_MAX_LENGTH);
  }

  return {
    picks,
    budget: readBudget(data.budget),
    purpose: readPurpose(data.purpose),
    summary: typeof data.summary === "string" ? data.summary.trim().slice(0, SUMMARY_MAX_LENGTH) : "",
    notes,
    rejectedCodes,
  };
}

/** Nhu cầu hiệu năng mà tổng dưới mức này so với ngân sách thì coi là chọn quá tiết kiệm */
const MIN_BUDGET_USE = 0.7;

/** "VGA: Card RTX 5060 (8.490.000đ); CPU: …" — giá cao trước, để AI biết đổi món nào thì giảm/tăng được bao nhiêu */
function describePicks(suggestion: ParsedSuggestion, catalog: Catalog): string {
  return BUILD_SLOTS.flatMap((slot) => {
    const pick = suggestion.picks[slot];
    const item = pick ? catalog.items.find((entry) => entry.productId === pick.productId) : undefined;
    return pick && item ? [{ slot, name: item.name, cost: item.price * pick.quantity }] : [];
  })
    .sort((a, b) => b.cost - a.cost)
    .map(({ slot, name, cost }) => `${slot}: ${name} (${formatPrice(cost)})`)
    .join("; ");
}

/** Rỗng = không cần sửa. Cảnh báo "thiếu dữ liệu" không tính — AI không thể tạo ra thông số còn thiếu */
export function findRepairIssues(suggestion: ParsedSuggestion, result: BuildCheckResult, catalog: Catalog): string[] {
  const issues = result.checks.filter((check) => check.severity === "ERROR").map((check) => check.message);
  if (result.missingSlots.length > 0) {
    issues.push(`Còn thiếu linh kiện bắt buộc: ${result.missingSlots.map((slot) => `${slot} (${SLOT_LABEL_VI[slot]})`).join(", ")}.`);
  }
  const wantsPerformance = NEEDS_DISCRETE_GPU.includes(suggestion.purpose);
  if (!suggestion.picks.VGA && wantsPerformance) {
    issues.push(`Nhu cầu "${suggestion.purpose}" cần card đồ họa rời (VGA) nhưng cấu hình chưa có.`);
  }
  const { budget } = suggestion;
  const total = result.totalPrice;
  if (budget !== null && total > budget) {
    const priority = wantsPerformance
      ? " Với nhu cầu này, giữ card đồ họa mạnh nhất có thể (tối đa hạ một bậc) và cắt bớt ở SSD, RAM, vỏ case, nguồn trước."
      : "";
    issues.push(
      `Tổng giá ${formatPrice(total)} vượt ngân sách ${formatPrice(budget)} khoảng ${formatPrice(total - budget)}. Giá từng món đang chọn: ${describePicks(suggestion, catalog)}. Hãy đổi 1–2 món sang món rẻ hơn gần nhất (không nhảy xuống món rẻ nhất) vừa đủ để tổng không vượt ngân sách.${priority}`,
    );
  } else if (budget !== null && wantsPerformance && total < budget * MIN_BUDGET_USE) {
    issues.push(
      `Tổng giá ${formatPrice(total)} mới dùng khoảng ${Math.round((total / budget) * 100)}% ngân sách ${formatPrice(budget)}, còn dư ${formatPrice(budget - total)}. Giá từng món đang chọn: ${describePicks(suggestion, catalog)}. Hãy nâng cấp linh kiện quan trọng nhất với nhu cầu (thường là card đồ họa) để tận dụng ngân sách.`,
    );
  }
  if (suggestion.rejectedCodes.length > 0) {
    issues.push(`Các mã sau không có trong kho hoặc đặt sai loại nên đã bị bỏ: ${suggestion.rejectedCodes.join(", ")}.`);
  }
  return issues;
}

export function buildRepairMessage(issues: string[]): string {
  return `Hệ thống PCZone vừa kiểm tra cấu hình bạn chọn và phát hiện:
${issues.map((issue) => `- ${issue}`).join("\n")}
Hãy chọn lại để khắc phục TẤT CẢ các vấn đề trên: chỉ thay những món liên quan, giữ các món còn lại; nếu phải giảm giá thì vẫn giữ tổng gần ngân sách (khoảng 85–100%). Vẫn chỉ dùng mã trong kho linh kiện và trả lời lại bằng đúng MỘT object JSON cùng định dạng như trước. "summary" và "notes" viết cho KHÁCH như một gợi ý mới hoàn chỉnh — không nhắc tới việc sửa lỗi, lượt chọn trước hay hệ thống kiểm tra.`;
}

export const UNREADABLE_REPLY_ISSUE = "Câu trả lời trước không phải JSON hợp lệ theo đúng định dạng yêu cầu.";

/** Ngân sách đọc được bằng bộ đọc giá có sẵn, trước khi gọi AI: mức cao nhất khách chấp nhận + nhãn để trích lại đúng lời khách */
export function statedBudget(prompt: string): { amount: number; label: string } | null {
  const intent = parsePriceIntent(prompt);
  const amount = intent?.max ?? intent?.min;
  return intent && amount !== undefined ? { amount, label: intent.label } : null;
}

/** Giới hạn dưới của một bộ đủ linh kiện bắt buộc (chưa tính card rời): cộng món rẻ nhất mỗi loại */
export function minimumBuildTotal(entries: CatalogEntry[]): number | null {
  let total = 0;
  for (const slot of BUILD_SLOTS) {
    if (slot === "VGA") continue;
    const prices = entries.filter((entry) => entry.slot === slot).map((entry) => entry.price);
    if (prices.length === 0) return null;
    total += Math.min(...prices);
  }
  return total;
}

/** "Gợi ý AI · Chơi game · 20 triệu" */
export function suggestionName(purpose: BuildPurpose, budget: number | null): string {
  return ["Gợi ý AI", purpose, budget === null ? null : formatMoneyLabel(budget)].filter(Boolean).join(" · ");
}
