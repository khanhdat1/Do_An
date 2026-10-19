import {
  buildCatalog,
  buildRepairMessage,
  buildSystemPrompt,
  downgradeWeights,
  findRepairIssues,
  minimumBuildTotal,
  needsPerformance,
  parseSuggestion,
  promptBudget,
  shouldUpgrade,
  statedBudget,
  suggestionName,
  UNREADABLE_REPLY_ISSUE,
  withPromptBudget,
  type Catalog,
  type ParsedSuggestion,
} from "../ai/build-suggestion.js";
import { chatComplete, type ChatMessage } from "../ai/openai-client.js";
import { keySpecs } from "../mappers/pc-build.mapper.js";
import { BadRequestError, ServiceUnavailableError } from "../middleware/errors.js";
import { fitToBudget, upgradeWithinBudget, type BudgetFit, type BuildCandidates } from "../pc-build/budget-fit.js";
import { checkBuild, type BuildPart, type BuildParts } from "../pc-build/compatibility.js";
import { BUILD_SLOTS } from "../pc-build/slots.js";
import { formatMoneyLabel } from "../search/price-intent.js";
import type { AiBuildSuggestionDto } from "../types/dto.js";
import { formatPrice } from "../utils/format.js";
import { loadSellableComponents, saveBuild } from "./pc-build.service.js";
import { assertAiFeatureEnabled } from "./settings.service.js";

/** Lượt đầu đã mất hơn ngần này thì không bắt khách chờ thêm lượt AI sửa nếu hệ thống tự điều chỉnh được (một lượt thường ~20 giây) */
const SLOW_FIRST_REPLY_MS = 20_000;

interface Attempt {
  suggestion: ParsedSuggestion | null;
  parts: BuildParts;
  issues: string[];
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} giây`;

function partsOf(suggestion: ParsedSuggestion, partById: Map<string, BuildPart>): BuildParts {
  const parts: BuildParts = {};
  for (const slot of BUILD_SLOTS) {
    const pick = suggestion.picks[slot];
    const part = pick ? partById.get(pick.productId) : undefined;
    if (pick && part) parts[slot] = { ...part, quantity: pick.quantity };
  }
  return parts;
}

function evaluate(reply: string, catalog: Catalog, partById: Map<string, BuildPart>, budgetFromPrompt: number | null): Attempt {
  const parsed = parseSuggestion(reply, catalog);
  if (!parsed) return { suggestion: null, parts: {}, issues: [UNREADABLE_REPLY_ISSUE] };
  if (budgetFromPrompt !== null && parsed.budget !== budgetFromPrompt) {
    const aiBudget = parsed.budget === null ? "không có" : formatPrice(parsed.budget);
    console.info(`[ai-build] AI đọc ngân sách ${aiBudget}, câu của khách là ${formatPrice(budgetFromPrompt)} — kiểm tra theo câu của khách`);
  }
  const suggestion = withPromptBudget(parsed, budgetFromPrompt);
  const parts = partsOf(suggestion, partById);
  return { suggestion, parts, issues: findRepairIssues(suggestion, checkBuild(parts), catalog) };
}

/**
 * Bước cuối, KHÔNG dùng AI (pc-build/budget-fit.ts): vượt ngân sách thì đổi vài món sang món rẻ hơn cùng loại, giữ lâu nhất
 * loại quan trọng với nhu cầu; nhu cầu hiệu năng mà dùng chưa tới 85% ngân sách thì nâng vài món lên món đắt hơn cùng loại
 * (nâng kèm nguồn/vỏ/mainboard nếu cần). Chỉ nhận phương án đủ linh kiện, không lỗi tương thích, không vượt ngân sách.
 */
function adjustToBudget(attempt: Attempt, candidates: BuildCandidates): { status: AiBuildSuggestionDto["budgetFit"]["status"]; fit: BudgetFit | null } {
  const { suggestion, parts } = attempt;
  if (!suggestion || suggestion.budget === null) return { status: "NOT_NEEDED", fit: null };
  const total = checkBuild(parts).totalPrice;
  const weights = downgradeWeights(suggestion.purpose);
  if (total > suggestion.budget) {
    const fit = fitToBudget(parts, candidates, suggestion.budget, weights);
    return { status: fit ? "FITTED" : "NOT_POSSIBLE", fit };
  }
  const fit = shouldUpgrade(suggestion.purpose, total, suggestion.budget) ? upgradeWithinBudget(parts, candidates, suggestion.budget, weights) : null;
  return { status: fit ? "UPGRADED" : "NOT_NEEDED", fit };
}

/**
 * Toàn bộ linh kiện còn hàng (~94 món) đưa hết vào prompt thay vì truy hồi bằng embedding: danh sách nhỏ, truy
 * hồi top-K có thể bỏ sót đúng món cần, và không tốn quota embedding. Lượt đầu có vấn đề thì cho AI sửa đúng 1 lần —
 * trừ khi lượt đầu đã quá chậm và hệ thống tự xử lý được. Cuối cùng vẫn vượt ngân sách, hoặc dùng quá ít ngân sách cho nhu
 * cầu hiệu năng, thì hệ thống tự đổi vài món bằng luật cố định (không tốn thêm lượt gọi AI).
 */
export async function suggestBuild(userId: string | null, prompt: string): Promise<AiBuildSuggestionDto> {
  // Tắt ở /admin/settings: 503 kèm câu báo rõ, không tốn lượt đọc DB hay gọi AI. Build PC tự chọn (/api/pc-build/*)
  // không đi qua đây nên vẫn chạy bình thường
  await assertAiFeatureEnabled("build");

  const components = await loadSellableComponents();
  const entries = components.map(({ slot, row, part }) => ({ slot, productId: row.id, name: row.name, price: part.price, keySpecs: keySpecs(slot, part.spec) }));

  // Ngân sách chắc chắn không đủ thì báo thẳng, khỏi tốn một lượt gọi AI
  const budget = statedBudget(prompt);
  const minimum = minimumBuildTotal(entries);
  if (budget && minimum !== null && budget.amount < minimum) {
    throw new BadRequestError(
      `Ngân sách ${budget.label.toLowerCase()} chưa đủ để ráp một bộ PC đủ linh kiện tại PCZone — bộ rẻ nhất hiện khoảng ${formatMoneyLabel(minimum)} (chưa tính card đồ họa rời). Bạn thử tăng ngân sách nhé.`,
    );
  }

  const catalog = buildCatalog(entries);
  const partById = new Map(components.map(({ part }) => [part.productId, part]));
  const budgetFromPrompt = promptBudget(prompt);

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(catalog) },
    { role: "user", content: prompt },
  ];
  const candidates: BuildCandidates = {};
  for (const { slot, part } of components) (candidates[slot] ??= []).push(part);

  const started = Date.now();
  const firstReply = await chatComplete(messages, { json: true });
  const firstMs = Date.now() - started;
  let attempt = evaluate(firstReply, catalog, partById, budgetFromPrompt);
  let repair: AiBuildSuggestionDto["repair"] = "NOT_NEEDED";

  if (attempt.issues.length > 0) {
    // Lượt đầu đã chậm mà bước tự điều chỉnh (không dùng AI) ra được cấu hình hợp lệ trong ngân sách thì khỏi bắt khách chờ
    // thêm một lượt AI nữa. Bước đó không thêm được loại linh kiện, nên nhu cầu hiệu năng mà thiếu card rời thì vẫn nhờ AI
    const lacksGpu = attempt.suggestion !== null && needsPerformance(attempt.suggestion.purpose) && !attempt.suggestion.picks.VGA;
    if (firstMs > SLOW_FIRST_REPLY_MS && !lacksGpu && adjustToBudget(attempt, candidates).fit) {
      repair = "SKIPPED";
      console.info(
        `[ai-build] Lượt đầu mất ${seconds(firstMs)} (quá ${seconds(SLOW_FIRST_REPLY_MS)}) — bỏ lượt nhờ AI sửa, hệ thống tự điều chỉnh theo ngân sách. Vấn đề của lượt đầu:\n  - ${attempt.issues.join("\n  - ")}`,
      );
    } else {
      console.info(`[ai-build] Lượt đầu (${seconds(firstMs)}) có ${attempt.issues.length} vấn đề, nhờ AI sửa 1 lần:\n  - ${attempt.issues.join("\n  - ")}`);
      repair = "FAILED";
      try {
        const secondReply = await chatComplete(
          [...messages, { role: "assistant", content: firstReply }, { role: "user", content: buildRepairMessage(attempt.issues) }],
          { json: true },
        );
        const second = evaluate(secondReply, catalog, partById, budgetFromPrompt);
        if (second.suggestion && second.issues.length <= attempt.issues.length) {
          attempt = second;
          repair = "REPAIRED";
        }
      } catch (error) {
        // Lượt sửa hỏng (hết quota, AI bận) thì vẫn trả lượt đầu — lỗi còn lại hiện ở phần kiểm tra, không che
        console.warn("[ai-build] Lượt sửa không thành công:", error instanceof Error ? error.message : error);
      }
    }
  }

  const { suggestion } = attempt;
  if (!suggestion || Object.keys(suggestion.picks).length === 0) {
    throw new ServiceUnavailableError("AI chưa đưa ra được cấu hình hợp lệ. Vui lòng thử lại, hoặc tự chọn linh kiện bên dưới.");
  }

  let picks = suggestion.picks;
  let notes = suggestion.notes;
  const { status, fit } = adjustToBudget(attempt, candidates);
  const budgetFit: AiBuildSuggestionDto["budgetFit"] = { status, swaps: [] };
  if (fit) {
    const nameOf = new Map(entries.map((entry) => [entry.productId, entry.name]));
    const product = (part: BuildPart) => ({ productId: part.productId, name: nameOf.get(part.productId) ?? "", price: part.price, quantity: part.quantity });
    picks = { ...picks };
    notes = { ...notes };
    for (const { slot, to } of fit.swaps) {
      picks[slot] = { productId: to.productId, quantity: to.quantity };
      delete notes[slot]; // lý do AI viết cho món cũ, không còn đúng
    }
    budgetFit.swaps = fit.swaps.map(({ slot, from, to }) => ({ slot, from: product(from), to: product(to) }));
    console.info(
      `[ai-build] Tổng ${formatPrice(checkBuild(attempt.parts).totalPrice)} so với ngân sách ${formatPrice(suggestion.budget ?? 0)} — hệ thống ${status === "FITTED" ? "hạ" : "nâng"} ${fit.swaps.length} món, tổng mới ${formatPrice(fit.result.totalPrice)}: ${budgetFit.swaps
        .map((swap) => `${swap.slot} ${swap.from.name} -> ${swap.to.name}`)
        .join("; ")}`,
    );
  } else if (status === "NOT_POSSIBLE") {
    console.info(`[ai-build] Vẫn vượt ngân sách ${formatPrice(suggestion.budget ?? 0)} và không có cách đổi nào vừa ngân sách mà vẫn tương thích`);
  }

  const finalTotal = fit?.result.totalPrice ?? checkBuild(attempt.parts).totalPrice;
  const budgetUse = suggestion.budget === null ? "" : ` / ${formatPrice(suggestion.budget)} (${Math.round((finalTotal / suggestion.budget) * 100)}%)`;
  console.info(
    `[ai-build] Xong sau ${seconds(Date.now() - started)} (lượt đầu ${seconds(firstMs)}; lượt sửa: ${repair}; ngân sách: ${status}) — tổng ${formatPrice(finalTotal)}${budgetUse}`,
  );

  const build = await saveBuild(userId, {
    name: suggestionName(suggestion.purpose, suggestion.budget),
    items: BUILD_SLOTS.flatMap((slot) => {
      const pick = picks[slot];
      return pick ? [{ productId: pick.productId, quantity: pick.quantity }] : [];
    }),
    ai: { prompt, purpose: suggestion.purpose, budget: suggestion.budget },
  });

  return {
    build,
    understood: { budget: suggestion.budget, purpose: suggestion.purpose },
    summary: suggestion.summary,
    notes: BUILD_SLOTS.flatMap((slot) => {
      const text = notes[slot];
      return text ? [{ slot, text }] : [];
    }),
    repair,
    budgetFit,
    droppedCount: suggestion.rejectedCodes.length,
  };
}
