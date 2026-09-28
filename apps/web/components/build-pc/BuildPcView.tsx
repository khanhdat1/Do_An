"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, Info, Wrench } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { errorMessage } from "@/lib/api-client";
import { formatPrice } from "@/lib/format";
import { BUILD_SLOTS, selectionFromResult, selectionFromSaved, selectionToSearch, type BuildSelection } from "@/lib/pc-build";
import { fetchSavedBuild, validateBuild } from "@/lib/pc-build-client";
import type { AiBuildSuggestion, BuildCheckResult, BuildSlot, SavedBuild } from "@/types";
import AiBuildPanel from "./AiBuildPanel";
import AiSuggestionCard from "./AiSuggestionCard";
import BuildCheckList from "./BuildCheckList";
import BuildSlotRow from "./BuildSlotRow";
import BuildSummary, { BuildStatusBar } from "./BuildSummary";
import ComponentPicker from "./ComponentPicker";

/** Lỗi nặng nhất liên quan tới từng ô, để tô viền dòng đó */
function severityBySlot(result: BuildCheckResult | null): Map<BuildSlot, "ERROR" | "WARNING"> {
  const bySlot = new Map<BuildSlot, "ERROR" | "WARNING">();
  if (!result) return bySlot;
  const slotOf = new Map(result.items.map((item) => [item.product.id, item.slot]));
  for (const check of result.checks) {
    if (check.severity !== "ERROR" && check.severity !== "WARNING") continue;
    for (const productId of check.productIds) {
      const slot = slotOf.get(productId);
      if (slot && (check.severity === "ERROR" || !bySlot.has(slot))) bySlot.set(slot, check.severity);
    }
  }
  return bySlot;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "numeric", month: "numeric", year: "numeric" });
}

interface BuildPcViewProps {
  initialSelection: BuildSelection;
  /** Mở từ link ngắn `?build=` */
  savedBuild: SavedBuild | null;
  /** Có `?build=` nhưng không tìm thấy cấu hình */
  missingBuildCode?: string;
}

/**
 * Lựa chọn nằm trong state và đồng bộ lên URL (chia sẻ bằng cách sao chép link). Mỗi lần đổi, trang gọi lại
 * API kiểm tra — mọi luật tương thích nằm ở server, phía này không tự kết luận gì.
 */
export default function BuildPcView({ initialSelection, savedBuild, missingBuildCode }: BuildPcViewProps) {
  const [selection, setSelection] = useState(initialSelection);
  const [checked, setChecked] = useState<{ key: string; result: BuildCheckResult } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pickerSlot, setPickerSlot] = useState<BuildSlot | null>(null);
  const [suggestion, setSuggestion] = useState<AiBuildSuggestion | null>(null);
  const [ownership, setOwnership] = useState<{ code: string; userId: string; isMine: boolean } | null>(null);
  const pickerTrigger = useRef<HTMLElement | null>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const { status: authStatus, user } = useAuth();
  const toast = useToast();

  const key = selectionToSearch(selection);
  const result = checked?.result ?? null;
  const error = failure?.key === key ? failure.message : null;
  const pending = checked?.key !== key && !error;

  // Cấu hình đã lưu đang hiện (gợi ý AI mới nhất, hoặc mở từ link): còn y nguyên thì URL giữ link ngắn
  const activeSaved = suggestion?.build ?? savedBuild;
  const isUnchangedSaved = activeSaved !== null && selectionToSearch(selectionFromSaved(activeSaved)) === key;
  const urlQuery = isUnchangedSaved ? `build=${encodeURIComponent(activeSaved.code)}` : key;

  // Gợi ý AI vừa tạo đã biết chủ; cấu hình mở từ link thì trang tải ở server (không kèm cookie) nên phải hỏi lại.
  // null = chưa biết → khung lưu không khẳng định "của tôi" hay "của người khác"
  const userId = user?.id ?? null;
  let savedIsMine: boolean | null = null;
  if (activeSaved !== null) {
    if (activeSaved === suggestion?.build) savedIsMine = activeSaved.isMine;
    else if (authStatus === "anonymous") savedIsMine = false;
    else if (ownership && ownership.code === activeSaved.code && ownership.userId === userId) savedIsMine = ownership.isMine;
  }

  useEffect(() => {
    window.history.replaceState(null, "", urlQuery ? `?${urlQuery}` : window.location.pathname);
  }, [urlQuery]);

  useEffect(() => {
    if (!userId || !savedBuild) return;
    const controller = new AbortController();
    fetchSavedBuild(savedBuild.code, controller.signal)
      .then((build) => setOwnership({ code: build.code, userId, isMine: build.isMine }))
      .catch(() => {
        // Không hỏi được thì để "chưa biết" — chỉ ẩn dòng "của tôi"/"lưu vào tài khoản", phần còn lại vẫn dùng được
      });
    return () => controller.abort();
  }, [userId, savedBuild]);

  useEffect(() => {
    const controller = new AbortController();
    validateBuild(selection, controller.signal)
      .then((next) => {
        const reconciled = selectionFromResult(next);
        if (selectionToSearch(reconciled) !== key) {
          // Có id không còn bán, hoặc sản phẩm nằm sai ô trên URL: đi theo server rồi kiểm tra lại
          if (next.unavailableProductIds.length > 0) {
            toast.info("Một số linh kiện trong liên kết không còn bán hoặc không tồn tại nên đã được bỏ khỏi cấu hình.");
          }
          setSelection(reconciled);
          return;
        }
        setChecked({ key, result: next });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setFailure({ key, message: errorMessage(reason) });
      });
    return () => controller.abort();
  }, [selection, key, attempt, toast]);

  useEffect(() => {
    if (suggestion) suggestionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [suggestion]);

  const closePicker = useCallback(() => {
    setPickerSlot(null);
    pickerTrigger.current?.focus();
  }, []);

  function openPicker(slot: BuildSlot, trigger: HTMLElement) {
    pickerTrigger.current = trigger;
    setPickerSlot(slot);
  }

  function choose(slot: BuildSlot, productId: string) {
    // RAM giữ số lượng đang chọn, để huy hiệu trong bảng chọn (tính theo số lượng đó) khớp kết quả sau khi chọn
    setSelection((current) => ({ ...current, [slot]: { productId, quantity: slot === "RAM" ? (current.RAM?.quantity ?? 1) : 1 } }));
    closePicker();
  }

  function remove(slot: BuildSlot) {
    setSelection((current) => {
      const next = { ...current };
      delete next[slot];
      return next;
    });
  }

  function setRamQuantity(quantity: number) {
    setSelection((current) => (current.RAM ? { ...current, RAM: { ...current.RAM, quantity } } : current));
  }

  function retry() {
    setFailure(null);
    setAttempt((value) => value + 1);
  }

  function applySuggestion(next: AiBuildSuggestion) {
    setSuggestion(next);
    setSelection(selectionFromSaved(next.build));
  }

  function reset() {
    setSuggestion(null);
    setSelection({});
  }

  const severities = severityBySlot(result);
  const vgaOptional =
    !selection.VGA && result !== null && result.items.some((item) => item.slot === "CPU") && !result.missingSlots.includes("VGA");

  return (
    <div className="container-page py-5 sm:py-6">
      <header className="surface-card p-5 sm:p-6">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-500">
          <Wrench className="size-3.5" aria-hidden />
          Build PC
        </p>
        <h1 className="section-title mt-1.5 text-2xl sm:text-3xl">Tự chọn hoặc nhờ AI gợi ý cả bộ</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          Chọn từng linh kiện đang bán tại PCZone, hoặc nêu ngân sách để AI gợi ý cả bộ. Hệ thống luôn tự kiểm tra socket CPU,
          chuẩn và số khe RAM, kích thước mainboard, card đồ họa với vỏ case, công suất nguồn, rồi tính tổng tiền.
        </p>
      </header>

      {missingBuildCode ? (
        <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Không tìm thấy cấu hình đã lưu có mã &quot;{missingBuildCode}&quot; — link có thể sai hoặc cấu hình đã bị xoá.
        </p>
      ) : null}

      {savedBuild && !suggestion ? (
        <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-slate-200">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">
            <Bookmark className="size-4 text-brand-500" aria-hidden />
            Cấu hình đã lưu: {savedBuild.name}
            <span className="text-xs font-normal text-slate-500">· {formatDate(savedBuild.createdAt)}</span>
          </p>
          {savedBuild.isAiGenerated && savedBuild.aiPrompt ? (
            <p className="mt-1 text-xs text-slate-500">Gợi ý của AI cho yêu cầu: &quot;{savedBuild.aiPrompt}&quot;</p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">
            {isUnchangedSaved
              ? `Giá và kiểm tra tương thích được tính lại theo hiện tại (lúc lưu: ${formatPrice(savedBuild.totalAtSave)}).`
              : "Bạn đã chỉnh sửa so với cấu hình đã lưu — bấm \"Lưu cấu hình\" để tạo link mới."}
          </p>
        </div>
      ) : null}

      <BuildStatusBar result={result} className="mt-4 lg:hidden" />

      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <AiBuildPanel onSuggested={applySuggestion} />

          {suggestion ? (
            <div ref={suggestionRef} className="scroll-mt-48">
              <AiSuggestionCard suggestion={suggestion} selection={selection} result={result} onDismiss={() => setSuggestion(null)} />
            </div>
          ) : null}

          <section className="surface-card overflow-hidden" aria-label="Linh kiện trong cấu hình">
            <ul className="divide-y divide-slate-100">
              {BUILD_SLOTS.map((slot) => {
                const selected = selection[slot];
                const item = result?.items.find((entry) => entry.slot === slot);
                return (
                  <BuildSlotRow
                    key={slot}
                    slot={slot}
                    selected={selected}
                    product={item && item.product.id === selected?.productId ? item.product : undefined}
                    severity={selected ? (severities.get(slot) ?? null) : null}
                    optional={slot === "VGA" && vgaOptional}
                    onPick={(trigger) => openPicker(slot, trigger)}
                    onRemove={() => remove(slot)}
                    onQuantityChange={setRamQuantity}
                  />
                );
              })}
            </ul>
          </section>

          {result ? <BuildCheckList checks={result.checks} pending={pending} /> : null}
        </div>

        <aside id="build-summary" className="lg:sticky lg:top-44">
          <BuildSummary
            result={result}
            pending={pending}
            error={error}
            saved={isUnchangedSaved ? { code: activeSaved.code, isMine: savedIsMine } : null}
            onRetry={retry}
            onReset={reset}
          />
        </aside>
      </div>

      {pickerSlot ? (
        <ComponentPicker
          slot={pickerSlot}
          selection={selection}
          onSelect={(productId) => choose(pickerSlot, productId)}
          onClose={closePicker}
        />
      ) : null}
    </div>
  );
}
