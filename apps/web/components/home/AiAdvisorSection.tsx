"use client";

import { useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { aiAdvisorSuggestions } from "@/lib/data/ai-advisor";

/**
 * Khối tối giới thiệu trợ lý AI tư vấn cấu hình — chỉ là điểm vào: gửi câu hỏi sẽ điều hướng sang
 * trang chat riêng (`/tro-ly-ai`), câu hỏi tự gửi luôn ở đó, giống hệt cách nút "AI Search" ở header
 * điều hướng sang `/tim-kiem?mode=ai` thay vì hiển thị kết quả ngay tại chỗ.
 */
export default function AiAdvisorSection() {
  const [question, setQuestion] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    router.push(`/tro-ly-ai?${new URLSearchParams({ q: trimmed }).toString()}`);
  }

  return (
    <section className="container-page pt-8">
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-ink-900 via-ink-850 to-ink-950 p-6 sm:p-8">
        {/* Vòng tròn trang trí bên phải */}
        <div className="pointer-events-none absolute -right-10 top-1/2 hidden size-[420px] -translate-y-1/2 rounded-full border border-white/5 lg:block">
          <div className="absolute inset-16 rounded-full border border-white/5" />
          <div className="absolute inset-32 rounded-full border border-white/10" />
        </div>

        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gold-400 ring-1 ring-gold-400/30">
            <Sparkles className="size-3.5" />
            TechAI Hardware Copilot 2.0 · PCZone VIP
          </span>

          <h2 className="mt-4 font-display text-2xl font-extrabold uppercase leading-tight text-white sm:text-3xl lg:text-4xl">
            Trợ lý AI tư vấn cấu hình phần cứng chuyên sâu
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Chỉ cần nêu ngân sách và mục đích sử dụng (gaming 4K, đồ họa
            Premiere, Blender 3D, lập trình AI), PCZone AI sẽ phân tích tương
            thích 100% bus RAM, chân cắm nguồn PCIe 5.0 và cân đối tỷ lệ nghẽn cổ
            chai hoàn hảo.
          </p>

          {/* Gợi ý câu hỏi */}
          <div className="mt-5 flex flex-wrap gap-2">
            {aiAdvisorSuggestions.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setQuestion(item.label)}
                className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-[11px] font-medium text-slate-200 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-gold-400"
              >
                <item.icon className="size-3.5 text-brand-500" />
                {item.label}
              </button>
            ))}
          </div>

          {/* Ô hỏi AI */}
          <form
            onSubmit={handleSubmit}
            className="mt-5 flex items-center gap-2 rounded-xl bg-white/95 p-2 shadow-xl shadow-black/20"
          >
            <span className="ml-1.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50">
              <Sparkles className="size-4 text-brand-500" />
            </span>
            <input
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder='Ví dụ: "Tôi có 30 triệu cần case PC làm đồ họa Render 4K và chơi game..."'
              aria-label="Câu hỏi cho trợ lý AI"
              className="min-w-0 flex-1 bg-transparent px-1 text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-xs font-bold uppercase text-white transition hover:bg-brand-600"
            >
              Hỏi AI ngay
              <Send className="size-3.5" />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
