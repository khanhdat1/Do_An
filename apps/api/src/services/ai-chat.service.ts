/**
 * Trợ lý AI Chat — dựng trên `retrieveProducts()` (Đợt 1) và `chatCompleteStream()`. Tách rõ 2 pha,
 * khớp đúng ranh giới lỗi mà doc-comment của `chatCompleteStream()` đã nêu: `prepareChatTurn` là mọi
 * bước còn có thể lỗi "sạch" (chưa mở HTTP stream, lỗi ở đây là lỗi HTTP bình thường); `streamChatReply`
 * chạy SAU KHI route đã mở stream — lỗi ném ra từ đây route phải biến thành khung SSE "error", không
 * còn đổi được mã trạng thái HTTP nữa.
 */
import { MessageRole, prisma } from "@pczone/db";
import { env } from "../env.js";
import { buildChatRetrievalQuery, buildChatSystemPrompt, type ChatPromptProduct, summarizeSpecs } from "../ai/chat-context.js";
import { findCitedProductIds } from "../ai/citation.js";
import { type ChatMessage, chatCompleteStream, isConfigured } from "../ai/openai-client.js";
import { retrieveProducts } from "../ai/retrieval.js";
import { ServiceUnavailableError } from "../middleware/errors.js";
import { buildProductInclude, type BuildProductRow, keySpecs } from "../mappers/pc-build.mapper.js";
import { productInclude, readAllShortSpecs, readSpecifications, toProductDto } from "../mappers/product.mapper.js";
import { isBuildSlot } from "../pc-build/slots.js";
import { readStoredSpec } from "../pc-build/spec-store.js";
import type { AiChatHistoryDto, ProductDto, SpecRowDto } from "../types/dto.js";
import { productIdsInPriceRange } from "./ai-search.service.js";
import { PUBLIC_FILTER } from "./product.service.js";
import { assertAiFeatureEnabled } from "./settings.service.js";

export type ChatIdentity = { userId: string } | { sessionId: string };

/** Số tin nhắn gần nhất trả về khi mở lại hội thoại sau khi tải lại trang — đủ cho một phiên tư vấn */
const RESTORE_MESSAGE_LIMIT = 50;

const RETRIEVAL_LIMIT = 8;
/** Kiểm soát chi phí/độ trễ mỗi lượt gọi model — không phải giới hạn kỹ thuật cứng (cửa sổ ngữ cảnh Gemini rất lớn) */
const HISTORY_MESSAGE_LIMIT = 12;
/** Lưới an toàn phụ: một câu trả lời AI có thể rất dài (không bị Zod giới hạn như tin nhắn người dùng) */
const HISTORY_CHAR_BUDGET = 8000;

function identityWhere(identity: ChatIdentity): { userId: string } | { sessionId: string } {
  return "userId" in identity ? { userId: identity.userId } : { sessionId: identity.sessionId };
}

/** Đọc dữ liệu thật (giá/ảnh/tồn kho luôn mới) cho đúng các id, giữ nguyên thứ tự — mirror ai-search.service.ts */
async function loadCandidates(ids: string[]): Promise<ProductDto[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: ids }, ...PUBLIC_FILTER }, include: productInclude });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toProductDto(row)] : [];
  });
}

/** Thông số chuẩn hoá (ProductSpec) — chỉ linh kiện Build PC mới có, laptop/màn hình/gear thì rỗng */
function normalizedSpecRows(row: BuildProductRow): SpecRowDto[] {
  const slot = row.spec?.componentType;
  return row.spec && slot && isBuildSlot(slot) ? keySpecs(slot, readStoredSpec(row.spec)) : [];
}

/** Như loadCandidates nhưng kèm thông số đầy đủ để đưa vào prompt — `ProductDto.specs` chỉ có 3 chip đầu của thẻ sản phẩm */
async function loadPromptCandidates(ids: string[]): Promise<{ product: ProductDto; prompt: ChatPromptProduct }[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: ids }, ...PUBLIC_FILTER }, include: buildProductInclude });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    if (!row) return [];
    const product = toProductDto(row);
    const specs = summarizeSpecs({
      keySpecs: normalizedSpecRows(row),
      highlights: readAllShortSpecs(row.shortSpecs),
      specifications: readSpecifications(row.specifications),
    });
    return [{ product, prompt: { name: product.name, categoryName: product.categoryName, price: product.price, inStock: product.inStock, specs } }];
  });
}

async function resolveConversation(identity: ChatIdentity, conversationId: string | undefined) {
  if (conversationId) {
    const existing = await prisma.aiConversation.findFirst({ where: { id: conversationId, ...identityWhere(identity) } });
    // id không khớp chủ sở hữu (sai/của người khác) thì âm thầm tạo hội thoại mới — không lộ việc id đó có tồn tại hay không
    if (existing) return existing;
  }
  return prisma.aiConversation.create({ data: identityWhere(identity) });
}

/** Bớt các tin nhắn CŨ NHẤT trước nếu tổng độ dài vượt ngân sách, luôn giữ lại ít nhất tin gần nhất */
function trimHistoryByCharBudget(rowsOldToNew: { role: MessageRole; content: string }[]): { role: MessageRole; content: string }[] {
  const kept: { role: MessageRole; content: string }[] = [];
  let total = 0;
  for (let i = rowsOldToNew.length - 1; i >= 0; i--) {
    const row = rowsOldToNew[i];
    total += row.content.length;
    if (total > HISTORY_CHAR_BUDGET && kept.length > 0) break;
    kept.unshift(row);
  }
  return kept;
}

export interface PreparedChatTurn {
  conversationId: string;
  userMessageId: string;
  /** Sẵn sàng đưa thẳng cho chatCompleteStream() */
  messages: ChatMessage[];
  /** Ứng viên đã đưa cho model lượt này — dùng để tính trích dẫn sau khi có câu trả lời đầy đủ */
  candidates: ProductDto[];
}

/** Mọi bước có thể lỗi "sạch" (thiếu cấu hình, DB, retrieval) — CHƯA mở HTTP stream */
export async function prepareChatTurn(identity: ChatIdentity, input: { conversationId?: string; message: string }): Promise<PreparedChatTurn> {
  // Tắt ở /admin/settings: 503 kèm câu báo rõ TRƯỚC khi ghi tin nhắn nào vào DB (route chưa mở stream nên vẫn là lỗi HTTP thường)
  await assertAiFeatureEnabled("chat", "Vui lòng quay lại sau hoặc gọi hotline để được tư vấn trực tiếp.");
  if (!isConfigured()) throw new ServiceUnavailableError("Tính năng AI chưa được cấu hình.");

  const conversation = await resolveConversation(identity, input.conversationId);
  const userMessage = await prisma.aiMessage.create({
    data: { conversationId: conversation.id, role: MessageRole.USER, content: input.message },
  });

  const [historyRows] = await Promise.all([
    prisma.aiMessage.findMany({
      // Loại chính tin nhắn vừa tạo ở trên — sẽ tự thêm lại vào cuối `messages` từ `input.message`, không đọc lại từ DB
      where: { conversationId: conversation.id, id: { not: userMessage.id } },
      orderBy: { createdAt: "desc" },
      take: HISTORY_MESSAGE_LIMIT,
      select: { role: true, content: true },
    }),
    prisma.aiConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } }),
  ]);

  // Truy hồi theo cả vài câu hỏi gần nhất cùng chủ đề (câu tiếp nối như "còn con nào rẻ hơn không?" tự nó không
  // nói gì về sản phẩm), và lọc theo giá TRƯỚC khi lấy top-k như ai-search.service.ts — lọc sau (hay chỉ nhắc AI
  // "ưu tiên khoảng giá") thì top-k gần nghĩa nhất có thể toàn hàng ngoài khoảng giá dù kho có hàng phù hợp
  const previousUserMessages = historyRows.filter((row) => row.role === MessageRole.USER).map((row) => row.content);
  const query = buildChatRetrievalQuery(input.message, previousUserMessages);
  const allowedProductIds = query.priceFilter ? await productIdsInPriceRange(query.priceFilter) : undefined;
  const { products } = await retrieveProducts(query.text, { limit: RETRIEVAL_LIMIT, allowedProductIds });

  const loaded = await loadPromptCandidates(products.map((item) => item.productId));
  const candidates = loaded.map((item) => item.product);
  const systemPrompt = buildChatSystemPrompt(loaded.map((item) => item.prompt), query.priceFilter);
  const history = trimHistoryByCharBudget([...historyRows].reverse());

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((row): ChatMessage => ({ role: row.role === MessageRole.USER ? "user" : "assistant", content: row.content })),
    { role: "user", content: input.message },
  ];

  return { conversationId: conversation.id, userMessageId: userMessage.id, messages, candidates };
}

export type ChatStreamEvent =
  | { type: "chunk"; text: string }
  | { type: "done"; citedProductIds: string[]; citedProducts: ProductDto[]; messageId: string | null };

/** Route đã mở stream trước khi gọi hàm này — lỗi ném ra từ đây route sẽ biến thành khung SSE "error" */
export async function* streamChatReply(turn: PreparedChatTurn): AsyncGenerator<ChatStreamEvent> {
  let fullText = "";
  for await (const delta of chatCompleteStream(turn.messages)) {
    fullText += delta;
    yield { type: "chunk", text: delta };
  }

  const citedProductIds = findCitedProductIds(
    fullText,
    turn.candidates.map((c) => ({ productId: c.id, name: c.name })),
  );
  const citedProducts = citedProductIds.length > 0 ? await loadCandidates(citedProductIds) : [];

  let messageId: string | null = null;
  try {
    const saved = await prisma.aiMessage.create({
      data: {
        conversationId: turn.conversationId,
        role: MessageRole.ASSISTANT,
        content: fullText,
        citedProductIds,
        retrievedChunks: turn.candidates.map((c) => ({ productId: c.id, name: c.name })),
        model: env.ai.chatModel,
      },
    });
    messageId = saved.id;
  } catch (error) {
    // AI đã trả lời XONG, người dùng đã thấy câu trả lời đầy đủ trên màn hình — lỗi ghi DB ở đây
    // KHÔNG được báo thành "AI lỗi", chỉ ghi log server để tự kiểm tra sau.
    console.error("[ai-chat] Lưu tin nhắn ASSISTANT lỗi (câu trả lời đã gửi xong cho người dùng):", error);
  }

  yield { type: "done", citedProductIds, citedProducts, messageId };
}

/** `AiMessage.citedProductIds` là cột JSON — chỉ nhận mảng chuỗi, dữ liệu lạ coi như không trích dẫn gì */
export function readCitedProductIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

/**
 * Mở lại một hội thoại sau khi tải lại trang (`GET /api/ai/chat/conversations/:id`). Chỉ CHỦ hội thoại đọc được: cùng
 * tài khoản, hoặc cùng cookie khách vãng lai — id sai hay của người khác đều trả `null` (route báo 404, không lộ id đó
 * có tồn tại). Thẻ sản phẩm trích dẫn đọc lại từ DB nên giá/tồn kho là số hiện tại; sản phẩm đã ngừng bán thì bỏ qua.
 */
export async function getChatHistory(identity: ChatIdentity, conversationId: string): Promise<AiChatHistoryDto | null> {
  const conversation = await prisma.aiConversation.findFirst({
    where: { id: conversationId, ...identityWhere(identity) },
    select: { id: true },
  });
  if (!conversation) return null;

  const rows = await prisma.aiMessage.findMany({
    where: { conversationId: conversation.id, role: { in: [MessageRole.USER, MessageRole.ASSISTANT] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: RESTORE_MESSAGE_LIMIT,
    select: { id: true, role: true, content: true, citedProductIds: true },
  });
  const oldToNew = [...rows].reverse();

  const products = await loadCandidates([...new Set(oldToNew.flatMap((row) => readCitedProductIds(row.citedProductIds)))]);
  const byId = new Map(products.map((product) => [product.id, product]));

  return {
    conversationId: conversation.id,
    messages: oldToNew.map((row) => ({
      id: row.id,
      role: row.role === MessageRole.USER ? "user" : "assistant",
      content: row.content,
      citedProducts: readCitedProductIds(row.citedProductIds).flatMap((id) => byId.get(id) ?? []),
    })),
  };
}
