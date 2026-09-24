/**
 * Trợ lý AI Chat — dựng trên `retrieveProducts()` (Đợt 1) và `chatCompleteStream()`. Tách rõ 2 pha,
 * khớp đúng ranh giới lỗi mà doc-comment của `chatCompleteStream()` đã nêu: `prepareChatTurn` là mọi
 * bước còn có thể lỗi "sạch" (chưa mở HTTP stream, lỗi ở đây là lỗi HTTP bình thường); `streamChatReply`
 * chạy SAU KHI route đã mở stream — lỗi ném ra từ đây route phải biến thành khung SSE "error", không
 * còn đổi được mã trạng thái HTTP nữa.
 */
import { MessageRole, prisma } from "@pczone/db";
import { env } from "../env.js";
import { findCitedProductIds } from "../ai/citation.js";
import { type ChatMessage, chatCompleteStream, isConfigured } from "../ai/openai-client.js";
import { retrieveProducts } from "../ai/retrieval.js";
import { ServiceUnavailableError } from "../middleware/errors.js";
import { productInclude, toProductDto } from "../mappers/product.mapper.js";
import type { ProductDto } from "../types/dto.js";
import { formatPrice } from "../utils/format.js";
import { PUBLIC_FILTER } from "./product.service.js";

export type ChatIdentity = { userId: string } | { sessionId: string };

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

function buildSystemPrompt(candidates: ProductDto[], priceLabel: string | undefined): string {
  const productLines = candidates.length
    ? candidates
        .map((p) => `- ${p.name} (${p.categoryName}) — ${formatPrice(p.price)} — ${p.inStock ? "Còn hàng" : "Hết hàng"} — ${p.specs.slice(0, 3).join(", ")}`)
        .join("\n")
    : "Hiện không tìm thấy sản phẩm nào trong kho đủ liên quan tới câu hỏi này.";

  const priceNote = priceLabel
    ? `\n\nKhách có nhắc tới mức giá "${priceLabel}" — ưu tiên sản phẩm phù hợp khoảng giá này nếu có trong danh sách trên.`
    : "";

  return `Bạn là trợ lý AI tư vấn mua sắm của PCZone — cửa hàng PC gaming, laptop, linh kiện và gaming gear.

Nguyên tắc bắt buộc:
- Chỉ được nhắc đến sản phẩm có trong danh sách "Sản phẩm tham khảo" bên dưới — đó là dữ liệu THẬT lấy trực tiếp từ kho PCZone ngay lúc bạn trả lời. Tuyệt đối không tự bịa thêm sản phẩm, mẫu mã, giá hay thông số nào khác, kể cả khi bạn nghĩ mình biết về chúng.
- Nếu danh sách trống hoặc không có sản phẩm nào thật sự phù hợp, hãy nói thẳng là hiện PCZone chưa có sản phẩm phù hợp, đừng cố gợi ý đại khái cho có.
- Luôn nêu đúng giá và tình trạng còn/hết hàng như trong danh sách, không tự làm tròn hay đoán.
- Bạn không có dữ liệu thời gian thực về đơn hàng, vận chuyển hay nhân viên hỗ trợ — nếu khách hỏi những việc này, trả lời trung thực là bạn không có thông tin đó, hướng khách tới trang "Tra cứu đơn hàng" hoặc tổng đài PCZone.
- Trả lời ngắn gọn, tự nhiên như một tư vấn viên thật, không liệt kê thông số dài dòng nếu khách không hỏi.
- Luôn trả lời bằng tiếng Việt.

Sản phẩm tham khảo (giá và tồn kho cập nhật ngay lúc này):
${productLines}${priceNote}`;
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
  if (!isConfigured()) throw new ServiceUnavailableError("Tính năng AI chưa được cấu hình.");

  const conversation = await resolveConversation(identity, input.conversationId);
  const userMessage = await prisma.aiMessage.create({
    data: { conversationId: conversation.id, role: MessageRole.USER, content: input.message },
  });

  const [{ products, priceIntent }, historyRows] = await Promise.all([
    retrieveProducts(input.message, { limit: RETRIEVAL_LIMIT }),
    prisma.aiMessage.findMany({
      // Loại chính tin nhắn vừa tạo ở trên — sẽ tự thêm lại vào cuối `messages` từ `input.message`, không đọc lại từ DB
      where: { conversationId: conversation.id, id: { not: userMessage.id } },
      orderBy: { createdAt: "desc" },
      take: HISTORY_MESSAGE_LIMIT,
      select: { role: true, content: true },
    }),
    prisma.aiConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } }),
  ]);

  const candidates = await loadCandidates(products.map((item) => item.productId));
  const systemPrompt = buildSystemPrompt(candidates, priceIntent?.label);
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
