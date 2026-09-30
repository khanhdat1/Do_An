"use client";

import { useEffect, useRef, useState } from "react";
import { BotOff, LoaderCircle, Sparkles } from "lucide-react";
import { useStoreSettings } from "@/components/providers/StoreSettingsProvider";
import { errorMessage } from "@/lib/api-client";
import { suggestBuild } from "@/lib/pc-build-client";
import type { AiBuildSuggestion } from "@/types";

const MAX_LENGTH = 500;

const EXAMPLES = [
  "Tôi có 20 triệu, chơi game và edit video nhẹ",
  "PC văn phòng cho kế toán, khoảng 12 triệu",
  "Tầm 30 triệu, học lập trình và chạy thử mô hình AI",
  "40 triệu chơi game 2K, ưu tiên card đồ họa mạnh",
];

type PanelState = { status: "idle" } | { status: "loading" } | { status: "error"; message: string };

export default function AiBuildPanel({ onSuggested }: { onSuggested: (suggestion: AiBuildSuggestion) => void }) {
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<PanelState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);
  const { ai } = useStoreSettings();

  useEffect(() => () => controllerRef.current?.abort(), []);

  // Chủ website tắt "AI gợi ý cấu hình" ở /admin/settings (hoặc chưa cấu hình khoá AI): báo rõ ngay tại chỗ thay vì
  // để khách bấm rồi mới lỗi. Phần tự chọn linh kiện bên dưới không dùng AI nên vẫn chạy bình thường.
  if (!ai.build) {
    return (
      <section id="ai-goi-y" className="surface-card scroll-mt-48 p-4 sm:p-5" aria-labelledby="ai-build-title">
        <h2 id="ai-build-title" className="flex items-center gap-2 font-display text-base font-bold text-slate-900">
          <span className="grid size-8 place-items-center rounded-lg bg-slate-100">
            <BotOff className="size-4.5 text-slate-500" aria-hidden />
          </span>
          AI gợi ý cấu hình đang tạm tắt
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          Bạn vẫn tự chọn từng linh kiện bên dưới được — hệ thống vẫn tự kiểm tra tương thích, tính tổng tiền và công suất nguồn
          như bình thường.
        </p>
      </section>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = prompt.trim();
    if (text.length < 5) {
      setState({ status: "error", message: 'Hãy mô tả nhu cầu và ngân sách của bạn, ví dụ "20 triệu, chơi game".' });
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: "loading" });
    try {
      const suggestion = await suggestBuild(text, controller.signal);
      setState({ status: "idle" });
      onSuggested(suggestion);
    } catch (reason) {
      if (!controller.signal.aborted) setState({ status: "error", message: errorMessage(reason) });
    }
  }

  const loading = state.status === "loading";

  return (
    <section id="ai-goi-y" className="surface-card scroll-mt-48 p-4 sm:p-5" aria-labelledby="ai-build-title">
      <h2 id="ai-build-title" className="flex items-center gap-2 font-display text-base font-bold text-slate-900">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-50">
          <Sparkles className="size-4.5 text-brand-500" aria-hidden />
        </span>
        Nhờ AI gợi ý cả bộ
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
        Nêu ngân sách và nhu cầu. AI chỉ chọn trong số linh kiện đang bán, sau đó hệ thống tự kiểm tra tương thích lại —
        bạn vẫn đổi được từng món bên dưới.
      </p>

      <form onSubmit={submit} className="mt-3">
        <label htmlFor="ai-build-prompt" className="sr-only">
          Nhu cầu và ngân sách
        </label>
        <textarea
          id="ai-build-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value.slice(0, MAX_LENGTH))}
          rows={3}
          disabled={loading}
          placeholder='Ví dụ: "Tôi có 20 triệu, chơi game và edit video nhẹ"'
          className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
        />

        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              disabled={loading}
              onClick={() => setPrompt(example)}
              className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-100 disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500">
            {prompt.length}/{MAX_LENGTH}
          </span>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600 disabled:cursor-wait disabled:bg-brand-400"
          >
            {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
            {loading ? "AI đang chọn linh kiện…" : "Nhờ AI gợi ý"}
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {loading ? (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            AI đang chọn linh kiện từ kho hàng thật và hệ thống đang kiểm tra lại — thường mất 10–30 giây.
          </p>
        ) : null}
        {state.status === "error" ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {state.message} Bạn vẫn có thể tự chọn linh kiện bên dưới.
          </p>
        ) : null}
      </div>
    </section>
  );
}
