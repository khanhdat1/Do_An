"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BotOff, MessageSquarePlus, Sparkles } from "lucide-react";
import { useStoreSettings } from "@/components/providers/StoreSettingsProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { fetchChatHistory, streamChatMessage } from "@/lib/ai-chat-client";
import { aiAdvisorSuggestions } from "@/lib/data/ai-advisor";
import type { AiChatMessage } from "@/types";
import ChatComposer from "./ChatComposer";
import ChatMessageList from "./ChatMessageList";

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Id hội thoại đang mở, nhớ ở trình duyệt để tải lại trang vẫn tiếp tục được (nội dung nằm ở DB, đọc lại qua API) */
const CONVERSATION_STORAGE_KEY = "pcz_ai_conversation";

function readStoredConversationId(): string | null {
  try {
    return window.localStorage.getItem(CONVERSATION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeConversationId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(CONVERSATION_STORAGE_KEY, id);
    else window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
  } catch {
    // Trình duyệt chặn localStorage (chế độ riêng tư...): chỉ mất khả năng nối lại sau khi tải lại trang
  }
}

interface AiChatViewProps {
  initialQuestion?: string;
}

/**
 * Một hội thoại đang mở — không có sidebar nhiều hội thoại. Id hội thoại nhớ ở localStorage: tải lại trang thì đọc lại
 * các tin nhắn từ API (chỉ chủ hội thoại đọc được) và hỏi tiếp trong cùng hội thoại; nút "Cuộc trò chuyện mới" bắt đầu
 * lại từ đầu. Vào trang kèm câu hỏi (`?q=` từ trang chủ) luôn mở hội thoại mới.
 */
export default function AiChatView({ initialQuestion }: AiChatViewProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [sending, setSending] = useState(() => Boolean(initialQuestion));
  const conversationIdRef = useRef<string | undefined>(undefined);
  const toast = useToast();
  // Chủ website tắt trợ lý AI ở /admin/settings (hoặc chưa cấu hình khoá AI): hiện thông báo ngay, không để khách
  // gõ xong mới nhận lỗi. API vẫn tự chặn (503) nếu cài đặt đổi trong lúc trang đang mở — lỗi đó hiện qua toast.
  const { ai, store } = useStoreSettings();
  const chatEnabled = ai.chat;

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
          storeConversationId(data.conversationId);
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

  function startNewConversation() {
    conversationIdRef.current = undefined;
    storeConversationId(null);
    setMessages([]);
  }

  /** Tải lại trang: mở lại hội thoại đang dở (nếu còn và đúng của người đang xem) */
  useEffect(() => {
    if (!chatEnabled) return;
    if (initialQuestion) {
      // Câu hỏi mới từ trang chủ: bắt đầu hội thoại mới, không nối vào hội thoại cũ
      storeConversationId(null);
      return;
    }
    const storedId = readStoredConversationId();
    if (!storedId) return;

    let cancelled = false;
    fetchChatHistory(storedId)
      .then((history) => {
        if (cancelled) return;
        if (!history) {
          storeConversationId(null);
          return;
        }
        conversationIdRef.current = history.conversationId;
        // Khách đã kịp gửi tin mới trong lúc đang tải thì giữ tin đó, không ghi đè
        setMessages((prev) => (prev.length > 0 ? prev : history.messages));
      })
      .catch(() => {
        // Lỗi mạng: không chặn khách hỏi tiếp, chỉ không nối lại được hội thoại cũ
      });
    return () => {
      cancelled = true;
    };
  }, [chatEnabled, initialQuestion]);

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
    if (!initialQuestion || !chatEnabled) return;
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
  }, [initialQuestion, chatEnabled]);

  if (!chatEnabled) {
    return (
      <div className="container-page py-4">
        <div className="surface-card mx-auto flex max-w-2xl flex-col items-center px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-slate-100 text-slate-500">
            <BotOff className="size-7" />
          </span>
          <h1 className="mt-4 font-display text-lg font-bold text-slate-900">Trợ lý AI đang tạm tắt</h1>
          <p className="mt-1.5 max-w-md text-sm text-slate-500">
            Tính năng tư vấn bằng AI hiện không hoạt động. Bạn vẫn có thể tìm sản phẩm bằng ô tìm kiếm, tự ráp cấu hình ở Build
            PC, hoặc gọi hotline <strong className="font-semibold text-slate-700">{store.hotline}</strong> để được tư vấn trực tiếp.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href="/ai-build-pc"
              className="rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
            >
              Tự ráp cấu hình PC
            </Link>
            <Link
              href="/"
              className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page flex h-[calc(100dvh-4rem)] max-h-[900px] flex-col py-4">
      <div className="surface-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50">
            <Sparkles className="size-5 text-brand-500" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base font-bold text-slate-900">Trợ lý AI PCZone</h1>
            <p className="text-xs text-slate-500">Tư vấn dựa trên kho hàng thật, không bịa sản phẩm</p>
          </div>
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={startNewConversation}
              disabled={sending}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MessageSquarePlus className="size-4" />
              <span className="hidden sm:inline">Cuộc trò chuyện mới</span>
              <span className="sr-only sm:hidden">Cuộc trò chuyện mới</span>
            </button>
          ) : null}
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
