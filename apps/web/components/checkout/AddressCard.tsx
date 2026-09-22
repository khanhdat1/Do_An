"use client";

import { LoaderCircle, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Address } from "@/types";

interface AddressCardProps {
  address: Address;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  deleting?: boolean;
}

/** Một địa chỉ trong sổ — thẻ chọn kiểu radio, bấm cả thẻ để chọn */
export default function AddressCard({ address, selected, onSelect, onDelete, deleting }: AddressCardProps) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition",
        selected ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500" : "border-slate-200 bg-white hover:border-slate-300",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full border-2",
          selected ? "border-brand-500" : "border-slate-300",
        )}
      >
        {selected ? <span className="size-2 rounded-full bg-brand-500" /> : null}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-800">{address.recipientName}</p>
          <span className="text-xs text-slate-400">·</span>
          <p className="text-sm text-slate-600">{address.phone}</p>
          {address.isDefault ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/15 px-2 py-0.5 text-[11px] font-semibold text-gold-600">
              <Star className="size-3 fill-current" />
              Mặc định
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {address.streetAddress}, {address.ward}, {address.district}, {address.province}
        </p>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        disabled={deleting}
        aria-label={`Xoá địa chỉ của ${address.recipientName}`}
        className="-m-1.5 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-sale-500/10 hover:text-sale-600 disabled:opacity-50"
      >
        {deleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </button>
    </div>
  );
}
