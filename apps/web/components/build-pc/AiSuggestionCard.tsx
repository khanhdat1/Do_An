"use client";

import { Copy, Scale, Sparkles, TriangleAlert, X } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { formatPrice } from "@/lib/format";
import { SLOT_LABEL, savedBuildUrl, type BuildSelection } from "@/lib/pc-build";
import { cn } from "@/lib/utils";
import type { AiBuildSuggestion, BuildCheckResult } from "@/types";

interface AiSuggestionCardProps {
  suggestion: AiBuildSuggestion;
  selection: BuildSelection;
  /** Kết quả kiểm tra hiện tại — tổng tiền thật, không lấy từ lời AI */
  result: BuildCheckResult | null;
  onDismiss: () => void;
}

/** Thẻ giải thích của AI. Tổng tiền so với ngân sách luôn lấy từ hệ thống, vì AI có thể tự nhận sai là "vừa ngân sách" */
export default function AiSuggestionCard({ suggestion, selection, result, onDismiss }: AiSuggestionCardProps) {
  const toast = useToast();
  const { budget, purpose } = suggestion.understood;
  const suggested = new Map(suggestion.build.items.map((item) => [item.slot, item.productId]));
  const changedCount = suggestion.build.items.filter((item) => selection[item.slot]?.productId !== item.productId).length;
  const notes = suggestion.notes.filter((note) => selection[note.slot]?.productId === suggested.get(note.slot));
  const total = result?.totalPrice ?? null;

  // Xét trên bản đã lưu (sau lượt AI sửa và bước hệ thống tự điều chỉnh): "đã sửa" chỉ nghĩa là lượt sửa không tệ hơn lượt đầu
  const { build, budgetFit } = suggestion;
  const stillHasIssues = !build.isValidAtSave || (budget !== null && build.totalAtSave > budget);
  const problemNote = !stillHasIssues
    ? null
    : budgetFit.status === "NOT_POSSIBLE"
      ? "Cấu hình vẫn vượt ngân sách: AI chưa chọn được bộ vừa tiền và hệ thống cũng không tìm được cách đổi sang linh kiện rẻ hơn mà vẫn tương thích."
      : suggestion.repair === "FAILED"
        ? "Lựa chọn đầu tiên của AI còn vấn đề và lượt nhờ AI sửa không cải thiện được."
        : suggestion.repair === "REPAIRED"
          ? "AI đã sửa 1 lần nhưng cấu hình vẫn còn vấn đề."
          : null;
  const fittedSwaps = budgetFit.status === "FITTED" ? budgetFit.swaps : [];
  const fittedSaving = fittedSwaps.reduce((sum, swap) => sum + swap.from.price * swap.from.quantity - swap.to.price * swap.to.quantity, 0);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(savedBuildUrl(suggestion.build.code));
      toast.success("Đã sao chép link cấu hình AI gợi ý");
    } catch {
      toast.error("Trình duyệt không cho sao chép tự động — hãy sao chép địa chỉ trên thanh trình duyệt.");
    }
  }

  return (
    <section className="surface-card border-brand-200 p-4 sm:p-5" aria-labelledby="ai-suggestion-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="ai-suggestion-title" className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-slate-900">
            <Sparkles className="size-4.5 text-brand-500" aria-hidden />
            Gợi ý của AI
            {suggestion.repair === "REPAIRED" ? (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
                AI đã tự sửa 1 lần
              </span>
            ) : null}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            AI hiểu: ngân sách <strong className="text-slate-700">{budget === null ? "không nêu" : formatPrice(budget)}</strong> · nhu cầu{" "}
            <strong className="text-slate-700">{purpose}</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Ẩn gợi ý của AI"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="size-4" />
        </button>
      </div>

      {budget !== null && total !== null ? (
        <p
          className={cn(
            "mt-3 rounded-lg px-3 py-2 text-sm font-semibold",
            total > budget ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700",
          )}
        >
          Tổng hiện tại {formatPrice(total)} ·{" "}
          {total > budget ? `vượt ngân sách ${formatPrice(total - budget)}` : `còn dư ${formatPrice(budget - total)} so với ngân sách`}
        </p>
      ) : null}

      {problemNote ? (
        <p className="mt-3 flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {problemNote} Xem tổng tiền và phần kiểm tra bên dưới, thử gợi ý lại hoặc tự đổi linh kiện.
        </p>
      ) : null}

      {fittedSwaps.length > 0 ? (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200">
          <p className="flex items-center gap-1.5 font-semibold text-slate-800">
            <Scale className="size-4 shrink-0 text-brand-500" aria-hidden />
            Hệ thống đã tự điều chỉnh cho vừa ngân sách
          </p>
          <p className="mt-1">
            AI vẫn chọn vượt ngân sách, nên hệ thống (không dùng AI) đổi {fittedSwaps.length} món sang món rẻ hơn cùng loại — vẫn qua đủ
            bộ kiểm tra tương thích, và giữ lâu nhất linh kiện quan trọng với nhu cầu &quot;{purpose}&quot;:
          </p>
          <ul className="mt-1.5 space-y-1">
            {fittedSwaps.map((swap) => (
              <li key={swap.slot}>
                <span className="font-semibold text-slate-700">{SLOT_LABEL[swap.slot]}:</span> {swap.from.name} ({formatPrice(swap.from.price)}
                {swap.from.quantity > 1 ? ` × ${swap.from.quantity}` : ""}) → <span className="font-semibold text-slate-800">{swap.to.name}</span> (
                {formatPrice(swap.to.price)}
                {swap.to.quantity > 1 ? ` × ${swap.to.quantity}` : ""})
              </li>
            ))}
          </ul>
          <p className="mt-1.5 font-semibold text-emerald-700">Bớt được {formatPrice(fittedSaving)}</p>
        </div>
      ) : null}

      {suggestion.summary ? (
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          {fittedSwaps.length > 0 ? (
            <span className="block text-xs text-slate-500">Tóm tắt của AI (viết cho lựa chọn ban đầu, trước khi hệ thống đổi linh kiện):</span>
          ) : null}
          {suggestion.summary}
        </p>
      ) : null}

      {notes.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-slate-600">
          {notes.map((note) => (
            <li key={note.slot}>
              <span className="font-semibold text-slate-800">{SLOT_LABEL[note.slot]}:</span> {note.text}
            </li>
          ))}
        </ul>
      ) : null}

      {changedCount > 0 ? (
        <p className="mt-2 text-xs text-slate-500">Bạn đã đổi {changedCount} linh kiện so với gợi ý — lý do của những món đó được ẩn đi.</p>
      ) : null}
      {suggestion.droppedCount > 0 ? (
        <p className="mt-2 text-xs text-slate-500">AI đưa ra {suggestion.droppedCount} mã không có trong kho — hệ thống đã loại bỏ.</p>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        Phần giải thích do AI viết và có thể chưa chính xác. Tổng tiền và kiểm tra tương thích do hệ thống tính bằng luật cố định.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-500">Đã lưu gợi ý này:</span>
        <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">?build={suggestion.build.code}</code>
        <button
          type="button"
          onClick={copyLink}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-brand-400 hover:text-brand-600"
        >
          <Copy className="size-3.5" aria-hidden />
          Sao chép link
        </button>
      </div>
    </section>
  );
}
