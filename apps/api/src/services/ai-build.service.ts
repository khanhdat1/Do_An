import {
  buildCatalog,
  buildRepairMessage,
  buildSystemPrompt,
  findRepairIssues,
  minimumBuildTotal,
  parseSuggestion,
  statedBudget,
  suggestionName,
  UNREADABLE_REPLY_ISSUE,
  type Catalog,
  type ParsedSuggestion,
} from "../ai/build-suggestion.js";
import { chatComplete, type ChatMessage } from "../ai/openai-client.js";
import { keySpecs } from "../mappers/pc-build.mapper.js";
import { BadRequestError, ServiceUnavailableError } from "../middleware/errors.js";
import { formatMoneyLabel } from "../search/price-intent.js";
import { checkBuild, type BuildPart, type BuildParts } from "../pc-build/compatibility.js";
import { BUILD_SLOTS } from "../pc-build/slots.js";
import type { AiBuildSuggestionDto } from "../types/dto.js";
import { loadSellableComponents, saveBuild } from "./pc-build.service.js";

interface Attempt {
  suggestion: ParsedSuggestion | null;
  issues: string[];
}

function evaluate(reply: string, catalog: Catalog, partById: Map<string, BuildPart>): Attempt {
  const suggestion = parseSuggestion(reply, catalog);
  if (!suggestion) return { suggestion: null, issues: [UNREADABLE_REPLY_ISSUE] };

  const parts: BuildParts = {};
  for (const slot of BUILD_SLOTS) {
    const pick = suggestion.picks[slot];
    const part = pick ? partById.get(pick.productId) : undefined;
    if (pick && part) parts[slot] = { ...part, quantity: pick.quantity };
  }
  return { suggestion, issues: findRepairIssues(suggestion, checkBuild(parts), catalog) };
}

/**
 * Toàn bộ linh kiện còn hàng (~94 món) đưa hết vào prompt thay vì truy hồi bằng embedding: danh sách nhỏ, truy
 * hồi top-K có thể bỏ sót đúng món cần, và không tốn quota embedding. Lượt đầu có vấn đề thì cho AI sửa đúng 1 lần.
 */
export async function suggestBuild(userId: string | null, prompt: string): Promise<AiBuildSuggestionDto> {
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

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(catalog) },
    { role: "user", content: prompt },
  ];
  const firstReply = await chatComplete(messages, { json: true });
  let attempt = evaluate(firstReply, catalog, partById);
  let repair: AiBuildSuggestionDto["repair"] = "NOT_NEEDED";

  if (attempt.issues.length > 0) {
    console.info(`[ai-build] Lượt đầu có ${attempt.issues.length} vấn đề, nhờ AI sửa 1 lần:\n  - ${attempt.issues.join("\n  - ")}`);
    repair = "FAILED";
    try {
      const secondReply = await chatComplete(
        [...messages, { role: "assistant", content: firstReply }, { role: "user", content: buildRepairMessage(attempt.issues) }],
        { json: true },
      );
      const second = evaluate(secondReply, catalog, partById);
      if (second.suggestion && second.issues.length <= attempt.issues.length) {
        attempt = second;
        repair = "REPAIRED";
      }
    } catch (error) {
      // Lượt sửa hỏng (hết quota, AI bận) thì vẫn trả lượt đầu — lỗi còn lại hiện ở phần kiểm tra, không che
      console.warn("[ai-build] Lượt sửa không thành công:", error instanceof Error ? error.message : error);
    }
  }

  const { suggestion } = attempt;
  if (!suggestion || Object.keys(suggestion.picks).length === 0) {
    throw new ServiceUnavailableError("AI chưa đưa ra được cấu hình hợp lệ. Vui lòng thử lại, hoặc tự chọn linh kiện bên dưới.");
  }

  const build = await saveBuild(userId, {
    name: suggestionName(suggestion.purpose, suggestion.budget),
    items: BUILD_SLOTS.flatMap((slot) => {
      const pick = suggestion.picks[slot];
      return pick ? [{ productId: pick.productId, quantity: pick.quantity }] : [];
    }),
    ai: { prompt, purpose: suggestion.purpose, budget: suggestion.budget },
  });

  return {
    build,
    understood: { budget: suggestion.budget, purpose: suggestion.purpose },
    summary: suggestion.summary,
    notes: BUILD_SLOTS.flatMap((slot) => {
      const text = suggestion.notes[slot];
      return text ? [{ slot, text }] : [];
    }),
    repair,
    droppedCount: suggestion.rejectedCodes.length,
  };
}
