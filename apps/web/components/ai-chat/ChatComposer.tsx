"use client";

import { useState, type KeyboardEvent } from "react";
import { Send } from "lucide-react";

const MAX_LENGTH = 800;

interface ChatComposerProps {
  disabled?: boolean;
  onSend(message: string): void;
}

/** Ô nhập nhiều dòng — Enter gửi, Shift+Enter xuống dòng */
export default function ChatComposer({ disabled, onSend }: ChatComposerProps) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 focus-within:border-brand-400">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder="Nhập câu hỏi cho trợ lý AI..."
          aria-label="Câu hỏi cho trợ lý AI"
          className="min-h-10 max-h-40 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-xs font-bold uppercase text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Gửi
          <Send className="size-3.5" />
        </button>
      </div>
      <p className="mt-1.5 text-right text-[11px] text-slate-400">
        {value.length}/{MAX_LENGTH}
      </p>
    </div>
  );
}
