"use client";

import { useEffect, useRef } from "react";
import { Bot, RotateCcw, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiChatMessage } from "@/types";
import ChatCitedProducts from "./ChatCitedProducts";

interface ChatMessageListProps {
  messages: AiChatMessage[];
  onRetry(assistantMessageId: string): void;
}

export default function ChatMessageList({ messages, onRetry }: ChatMessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-6" aria-live="polite">
      {messages.map((message) => {
        const isUser = message.role === "user";
        return (
          <div key={message.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
            <div className={cn("flex max-w-[85%] items-start gap-2 sm:max-w-[70%]", isUser && "flex-row-reverse")}>
              <span
                className={cn(
                  "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
                  isUser ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-500",
                )}
              >
                {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
              </span>
              <div className="min-w-0">
                <div
                  className={cn(
                    "whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    isUser ? "bg-brand-500 text-white" : "bg-white text-slate-800 ring-1 ring-slate-200",
                    message.failed && "bg-sale-50 text-sale-700 ring-1 ring-sale-200",
                  )}
                >
                  {message.content}
                  {message.pending ? <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-current align-text-bottom" /> : null}
                </div>

                {message.failed ? (
                  <button
                    type="button"
                    onClick={() => onRetry(message.id)}
                    className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                  >
                    <RotateCcw className="size-3.5" />
                    Gửi lại câu hỏi
                  </button>
                ) : null}

                {message.citedProducts && message.citedProducts.length > 0 ? <ChatCitedProducts products={message.citedProducts} /> : null}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
