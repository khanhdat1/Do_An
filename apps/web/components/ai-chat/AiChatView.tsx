"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { streamChatMessage } from "@/lib/ai-chat-client";
import { aiAdvisorSuggestions } from "@/lib/data/ai-advisor";
import type { AiChatMessage } from "@/types";
import ChatComposer from "./ChatComposer";
import ChatMessageList from "./ChatMessageList";

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface AiChatViewProps {
  initialQuestion?: string;
}

/**
 * Một hội thoại đang mở — không có sidebar nhiều hội thoại (cắt phạm vi có chủ đích cho Đợt 2, xem
 * plan). `conversationId` chỉ giữ trong state, tải lại trang là bắt đầu hội thoại mới; hội thoại cũ
 * vẫn còn nguyên trong DB, chỉ là không tự nối lại.
 */
export default function AiChatView({ initialQuestion }: AiChatViewProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [sending, setSending] = useState(() => Boolean(initialQuestion));
  const conversationIdRef = useRef<string | undefined>(undefined);
  const toast = useToast();

  /** Thêm 2 bong bóng (người dùng + placeholder trả lời) rồi bắt đầu stream — dùng chung cho gửi tay và tự gửi lúc vào trang */
  function startTurn(text: string): { userMessageId: string; assistantMessageId: string; controller: AbortController } {
    const userMessageId = newId("user");
    const assistantMessageId = newId("assistant");
    setMessages((prev) => [...prev, { id: userMessageId, role: "user", content: text }, { id: assistantMessageId, role: "assistant", content: "", pending: true }]);
    setSending(true);

    const controller = new AbortController();
    void streamChatMessage(
      { conversationId: conversationIdRef.current, message: text },
      {
        onMeta: (data) => {
          conversationIdRef.current = data.conversationId;
        },
        onChunk: (chunk) => {
          setMessages((prev) => prev.map((m) => (m.id === assistantMessageId ? { ...m, content: m.content + chunk } : m)));
        },
        onDone: (data) => {
          setMessages((prev) => prev.map((m) => (m.id === assistantMessageId ? { ...m, pending: false, citedProducts: data.citedProducts } : m)));
          setSending(false);
        },
        onError: (message) => {
          setMessages((prev) => prev.map((m) => (m.id === assistantMessageId ? { ...m, pending: false, failed: true } : m)));
          toast.error(message);
          setSending(false);
        },
      },
      controller.signal,
    );

    return { userMessageId, assistantMessageId, controller };
  }

  function send(text: string) {
    startTurn(text);
  }

  function handleRetry(assistantMessageId: string) {
    const index = messages.findIndex((m) => m.id === assistantMessageId);
    const userMessage = index > 0 ? messages[index - 1] : undefined;
    if (userMessage?.role === "user") send(userMessage.content);
  }

  /**
   * Tự gửi câu hỏi ban đầu (nếu có, từ `?q=` trên trang chủ). CỐ Ý không dùng ref chặn "đã gửi chưa":
   * React Strict Mode (dev) chạy effect này 2 lần lúc mount đầu (mount → cleanup → mount lại) để bắt
   * lỗi effect không dọn sạch — nếu chặn bằng ref thì lượt cleanup huỷ fetch của lượt ĐẦU xong không
   * còn lượt nào gửi lại, khối chat kẹt mãi ở "đang gõ". Để effect tự chạy lại bình thường ở lượt
   * thật (thứ hai); cleanup chỉ gỡ đúng 2 bong bóng + huỷ đúng request của CHÍNH lượt bị huỷ đó
   * (đóng trong closure qua id), không ảnh hưởng lượt chạy lại.
   */
  useEffect(() => {
    if (!initialQuestion) return;
    // Bắt đầu một cuộc gọi mạng thật (gửi câu hỏi cho AI) khi vào trang với ?q= trên URL — không phải
    // kiểu "suy ra state từ state khác" mà rule này nhắm tới, mà là tác dụng phụ thật sự cần khi mount
    // (cùng tinh thần các chỗ khác trong dự án đã tắt rule này có chủ đích, vd CompareProvider hydrate từ localStorage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const { userMessageId, assistantMessageId, controller } = startTurn(initialQuestion);
    return () => {
      controller.abort();
      setMessages((prev) => prev.filter((m) => m.id !== userMessageId && m.id !== assistantMessageId));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  return (
    <div className="container-page flex h-[calc(100dvh-4rem)] max-h-[900px] flex-col py-4">
      <div className="surface-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50">
            <Sparkles className="size-5 text-brand-500" />
          </span>
          <div>
            <h1 className="font-display text-base font-bold text-slate-900">Trợ lý AI PCZone</h1>
            <p className="text-xs text-slate-500">Tư vấn dựa trên kho hàng thật, không bịa sản phẩm</p>
          </div>
        </header>

        {messages.length === 0 && !sending ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-brand-50 text-brand-500">
              <Sparkles className="size-7" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-800">Bạn cần tư vấn gì hôm nay?</h2>
              <p className="mt-1 text-sm text-slate-500">Hỏi về ngân sách, nhu cầu sử dụng, hoặc so sánh sản phẩm</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {aiAdvisorSuggestions.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => send(item.label)}
                  className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-100"
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ChatMessageList messages={messages} onRetry={handleRetry} />
        )}

        <ChatComposer disabled={sending} onSend={send} />
      </div>
    </div>
  );
}
