"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Search, X } from "lucide-react";
import ProductThumb from "@/components/product/ProductThumb";
import { errorMessage } from "@/lib/api-client";
import { formatPrice } from "@/lib/format";
import { SLOT_LABEL, type BuildSelection } from "@/lib/pc-build";
import { fetchBuildComponents } from "@/lib/pc-build-client";
import { fold, queryTerms } from "@/lib/search-text";
import { cn } from "@/lib/utils";
import type { BuildCandidate, BuildFit, BuildSlot } from "@/types";
import { SpecChips } from "./BuildSlotRow";

const FIT_STYLE: Record<BuildFit, { label: string; className: string }> = {
  COMPATIBLE: { label: "Tương thích", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  WARNING: { label: "Cần lưu ý", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  INCOMPATIBLE: { label: "Không tương thích", className: "bg-red-50 text-red-700 ring-red-200" },
  UNKNOWN: { label: "Thiếu dữ liệu", className: "bg-slate-100 text-slate-600 ring-slate-200" },
};

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: BuildCandidate[] };

function CandidateRow({ candidate, selected, onSelect }: { candidate: BuildCandidate; selected: boolean; onSelect: () => void }) {
  const { product, fit, reasons } = candidate;

  return (
    <li className={cn("flex gap-3 px-4 py-3 sm:px-5", selected && "bg-brand-50/60")}>
      <div className="w-16 shrink-0 sm:w-20">
        <ProductThumb name={product.name} image={product.image} categoryPath={product.categoryPath} className="ring-1 ring-slate-200" sizes="80px" />
      </div>

      <div className="min-w-0 flex-1">
        <Link
          href={`/san-pham/${product.slug}`}
          target="_blank"
          className="inline-flex items-start gap-1 text-sm font-semibold text-slate-800 transition hover:text-brand-600"
        >
          <span className="line-clamp-2">{product.name}</span>
          <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-label="(mở tab mới)" />
        </Link>
        <SpecChips specs={product.keySpecs} />
        {fit ? (
          <div className="mt-2">
            <span className={cn("inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ring-1", FIT_STYLE[fit].className)}>
              {FIT_STYLE[fit].label}
            </span>
            {reasons.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-xs leading-relaxed text-slate-600">
                {reasons.map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className="text-sm font-bold text-sale-600">{formatPrice(product.price)}</p>
        {product.oldPrice ? <p className="text-[11px] text-slate-400 line-through">{formatPrice(product.oldPrice)}</p> : null}
        <p className={cn("text-[11px] font-semibold", product.inStock === false ? "text-slate-400" : "text-emerald-600")}>
          {product.inStock === false ? "Hết hàng" : "Còn hàng"}
        </p>
        <button
          type="button"
          disabled={selected}
          onClick={onSelect}
          className="mt-1 rounded-lg bg-brand-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600 disabled:cursor-default disabled:bg-slate-200 disabled:text-slate-500"
        >
          {selected ? "Đang chọn" : "Chọn"}
        </button>
      </div>
    </li>
  );
}

interface ComponentPickerProps {
  slot: BuildSlot;
  selection: BuildSelection;
  onSelect: (productId: string) => void;
  /** Phải giữ nguyên tham chiếu giữa các lần render (useCallback) — dùng làm phụ thuộc của effect bắt phím Esc */
  onClose: () => void;
}

/** Ngăn kéo chọn linh kiện: huy hiệu tương thích tính ở server theo các món đang chọn; không lọc bỏ món nào trừ khi người dùng bật */
export default function ComponentPicker({ slot, selection, onSelect, onClose }: ComponentPickerProps) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [hideIncompatible, setHideIncompatible] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const label = SLOT_LABEL[slot];
  const selectedId = selection[slot]?.productId;

  useEffect(() => {
    const controller = new AbortController();
    fetchBuildComponents(slot, selection, controller.signal)
      .then((list) => setLoad({ status: "ready", items: list.items }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoad({ status: "error", message: errorMessage(error) });
      });
    return () => controller.abort();
  }, [slot, selection, attempt]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  function retry() {
    setLoad({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  const terms = queryTerms(query);
  const items = load.status === "ready" ? load.items : [];
  const incompatibleCount = items.filter((candidate) => candidate.fit === "INCOMPATIBLE").length;
  const visible = items.filter(
    (candidate) =>
      (!hideIncompatible || candidate.fit !== "INCOMPATIBLE") && terms.every((term) => fold(candidate.product.name).includes(term)),
  );

  let emptyState: React.ReactNode = null;
  if (load.status === "ready" && visible.length === 0) {
    if (items.length === 0) {
      emptyState = <p>Hiện chưa có {label} nào đang bán.</p>;
    } else if (terms.length > 0) {
      emptyState = <p>Không tìm thấy {label} nào khớp &quot;{query.trim()}&quot;.</p>;
    } else {
      emptyState = (
        <>
          <p className="font-semibold text-slate-700">Không có {label} nào tương thích với các linh kiện đang chọn.</p>
          <p className="mt-1">Hãy đổi linh kiện gây xung đột (xem lý do ở từng lựa chọn), hoặc xem lại toàn bộ danh sách.</p>
          <button
            type="button"
            onClick={() => setHideIncompatible(false)}
            className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-brand-400 hover:text-brand-600"
          >
            Hiện tất cả lựa chọn
          </button>
        </>
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="component-picker-title">
      <button type="button" tabIndex={-1} aria-hidden onClick={onClose} className="absolute inset-0 cursor-default bg-ink-950/60" />

      <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="component-picker-title" className="section-title text-lg">
              Chọn {label}
            </h2>
            <p className="text-xs text-slate-500">Huy hiệu tương thích tính theo các linh kiện bạn đã chọn</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="space-y-2.5 border-b border-slate-200 px-4 py-3 sm:px-5">
          <label className="relative block">
            <span className="sr-only">Tìm {label} theo tên</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Tìm ${label} theo tên…`}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={hideIncompatible}
              onChange={(event) => setHideIncompatible(event.target.checked)}
              className="size-4 accent-brand-500"
            />
            Ẩn lựa chọn không tương thích{incompatibleCount > 0 ? ` (${incompatibleCount})` : ""}
          </label>
        </div>

        <div className="flex-1 overflow-y-auto" aria-busy={load.status === "loading"}>
          {load.status === "loading" ? <p className="p-6 text-center text-sm text-slate-500">Đang tải danh sách {label}…</p> : null}

          {load.status === "error" ? (
            <div className="p-6 text-center text-sm">
              <p className="text-red-600">{load.message}</p>
              <button
                type="button"
                onClick={retry}
                className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-brand-400 hover:text-brand-600"
              >
                Thử lại
              </button>
            </div>
          ) : null}

          {visible.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {visible.map((candidate) => (
                <CandidateRow
                  key={candidate.product.id}
                  candidate={candidate}
                  selected={candidate.product.id === selectedId}
                  onSelect={() => onSelect(candidate.product.id)}
                />
              ))}
            </ul>
          ) : null}

          {emptyState ? <div className="p-6 text-center text-sm text-slate-500">{emptyState}</div> : null}
        </div>
      </div>
    </div>
  );
}
