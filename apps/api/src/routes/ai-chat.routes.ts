import { randomBytes } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { NotFoundError } from "../middleware/errors.js";
import { aiChatLimiter, noStore, searchLimiter } from "../middleware/security.js";
import { getChatHistory, prepareChatTurn, streamChatReply, type ChatIdentity, type ChatStreamEvent } from "../services/ai-chat.service.js";
import { GUEST_CHAT_COOKIE, readCookie, setGuestChatCookie } from "../utils/cookies.js";

/**
 * Trợ lý AI Chat — dùng chung cho khách đã đăng nhập (theo tài khoản) và khách vãng lai (theo cookie
 * `pcz_chat`, TÁCH RIÊNG khỏi cookie giỏ hàng `pcz_cart` — xem ghi chú ở cookies.ts). Trả lời qua
 * streaming SSE (`res.write` thô, không dùng thư viện ngoài) vì trình duyệt gọi endpoint này TRỰC
 * TIẾP (khác `/api/ai/search` do server Next.js gọi hộ).
 */
export const aiChatRouter = Router();

const GUEST_SESSION_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

/** Cùng khuôn với generateGuestSessionId/isValidGuestSessionId của cart.service.ts — trùng lặp có chủ
 * đích thay vì import chéo, vì đây là hai định danh khách vãng lai KHÁC NHAU (giỏ hàng vs hội thoại AI). */
function generateGuestSessionId(): string {
  return randomBytes(24).toString("base64url");
}
function isValidGuestSessionId(value: string): boolean {
  return GUEST_SESSION_PATTERN.test(value);
}

/** Khách chưa có cookie thì cấp cookie mới ngay trong response này — mọi tin nhắn đều "ghi" nên luôn cần định danh */
function resolveChatIdentity(req: Request, res: Response): ChatIdentity {
  if (req.auth) return { userId: req.auth.userId };

  const existing = readCookie(req, GUEST_CHAT_COOKIE);
  if (existing && isValidGuestSessionId(existing)) return { sessionId: existing };

  const sessionId = generateGuestSessionId();
  setGuestChatCookie(res, sessionId);
  return { sessionId };
}

/** Như resolveChatIdentity nhưng chỉ ĐỌC: không có cookie khách thì không có hội thoại nào để mở lại, không cấp cookie mới */
function existingChatIdentity(req: Request): ChatIdentity | null {
  if (req.auth) return { userId: req.auth.userId };
  const existing = readCookie(req, GUEST_CHAT_COOKIE);
  return existing && isValidGuestSessionId(existing) ? { sessionId: existing } : null;
}

const conversationParam = z.object({ id: z.string().trim().min(1).max(40) });

/**
 * GET /api/ai/chat/conversations/:id — mở lại hội thoại sau khi tải lại trang (trang `/tro-ly-ai` nhớ id ở trình duyệt).
 * Chỉ chủ hội thoại đọc được (tài khoản hoặc cookie khách); id sai, của người khác hay đã đăng xuất đều 404.
 */
aiChatRouter.get("/chat/conversations/:id", noStore, authenticate, searchLimiter, async (req, res, next) => {
  try {
    const { id } = conversationParam.parse(req.params);
    const identity = existingChatIdentity(req);
    const history = identity ? await getChatHistory(identity, id) : null;
    if (!history) throw new NotFoundError("Không tìm thấy hội thoại");
    res.json(history);
  } catch (error) {
    next(error);
  }
});

const sendMessageBody = z.object({
  conversationId: z.string().trim().min(1).max(40).optional(),
  message: z.string().trim().min(1, "Vui lòng nhập câu hỏi").max(800, "Câu hỏi tối đa 800 ký tự"),
});

function writeSse(res: Response, event: ChatStreamEvent | { type: "meta"; conversationId: string; userMessageId: string } | { type: "error"; message: string }) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * POST /api/ai/chat  { conversationId?, message }
 *
 * Hai pha rõ rệt: mọi lỗi trước khi mở stream (thiếu cấu hình, sai dữ liệu, lỗi DB) vẫn là lỗi HTTP
 * bình thường qua `next(error)`; SAU khi đã `flushHeaders()` thì không còn đổi được mã trạng thái HTTP
 * nữa — lỗi từ lúc này trở đi chỉ có thể báo bằng một khung SSE "error" rồi kết thúc response.
 */
aiChatRouter.post("/chat", authenticate, aiChatLimiter, async (req, res, next) => {
  let turn;
  try {
    const body = sendMessageBody.parse(req.body);
    const identity = resolveChatIdentity(req, res);
    turn = await prepareChatTurn(identity, body);
  } catch (error) {
    return next(error);
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.flushHeaders();
  writeSse(res, { type: "meta", conversationId: turn.conversationId, userMessageId: turn.userMessageId });

  try {
    for await (const event of streamChatReply(turn)) writeSse(res, event);
  } catch (error) {
    console.error("[ai-chat] Lỗi giữa chừng lúc đang stream:", error);
    writeSse(res, { type: "error", message: "Trợ lý AI bị gián đoạn. Vui lòng thử lại." });
  }
  res.end();
});
