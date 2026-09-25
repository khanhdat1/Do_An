"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Wrench } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { errorMessage } from "@/lib/api-client";
import { BUILD_SLOTS, selectionFromResult, selectionToSearch, type BuildSelection } from "@/lib/pc-build";
import { validateBuild } from "@/lib/pc-build-client";
import type { BuildCheckResult, BuildSlot } from "@/types";
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

/**
 * Lựa chọn nằm trong state và đồng bộ lên URL (chia sẻ bằng cách sao chép link). Mỗi lần đổi, trang gọi lại
 * API kiểm tra — mọi luật tương thích nằm ở server, phía này không tự kết luận gì.
 */
export default function BuildPcView({ initialSelection }: { initialSelection: BuildSelection }) {
  const [selection, setSelection] = useState(initialSelection);
  const [checked, setChecked] = useState<{ key: string; result: BuildCheckResult } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pickerSlot, setPickerSlot] = useState<BuildSlot | null>(null);
  const pickerTrigger = useRef<HTMLElement | null>(null);
  const toast = useToast();

  const key = selectionToSearch(selection);
  const result = checked?.result ?? null;
  const error = failure?.key === key ? failure.message : null;
  const pending = checked?.key !== key && !error;

  useEffect(() => {
    window.history.replaceState(null, "", key ? `?${key}` : window.location.pathname);

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
        <h1 className="section-title mt-1.5 text-2xl sm:text-3xl">Tự chọn linh kiện, kiểm tra tương thích tự động</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          Chọn từng linh kiện đang bán tại PCZone — hệ thống kiểm tra socket CPU, chuẩn và số khe RAM, kích thước mainboard,
          card đồ họa với vỏ case, công suất nguồn, rồi tính tổng tiền. Cấu hình nằm ngay trên đường dẫn để sao chép, chia sẻ.
        </p>
      </header>

      <BuildStatusBar result={result} className="mt-4 lg:hidden" />

      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
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
          <BuildSummary result={result} pending={pending} error={error} onRetry={retry} onReset={() => setSelection({})} />
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
