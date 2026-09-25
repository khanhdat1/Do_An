"use client";

import Link from "next/link";
import { Box, CircuitBoard, Cpu, ExternalLink, Gpu, HardDrive, MemoryStick, Plug, X } from "lucide-react";
import ProductThumb from "@/components/product/ProductThumb";
import QuantityStepper from "@/components/ui/QuantityStepper";
import { formatPrice } from "@/lib/format";
import { MAX_RAM_QUANTITY, SLOT_LABEL } from "@/lib/pc-build";
import { cn } from "@/lib/utils";
import type { BuildProduct, BuildSlot, SpecRow } from "@/types";

export const SLOT_ICON: Record<BuildSlot, typeof Cpu> = {
  CPU: Cpu,
  MAINBOARD: CircuitBoard,
  RAM: MemoryStick,
  VGA: Gpu,
  SSD: HardDrive,
  PSU: Plug,
  CASE: Box,
};

const NO_DATA = "Chưa có dữ liệu";

export function SpecChips({ specs }: { specs: SpecRow[] }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1">
      {specs.map((spec) => (
        <li key={spec.label} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
          {spec.label}:{" "}
          <span className={spec.value === NO_DATA ? "italic text-slate-400" : "font-semibold text-slate-700"}>{spec.value}</span>
        </li>
      ))}
    </ul>
  );
}

interface BuildSlotRowProps {
  slot: BuildSlot;
  /** Lựa chọn hiện tại (có ngay khi bấm), còn `product` chỉ có sau khi server kiểm tra xong */
  selected?: { productId: string; quantity: number };
  product?: BuildProduct;
  severity: "ERROR" | "WARNING" | null;
  /** Card đồ họa không bắt buộc vì CPU đã chọn có đồ họa tích hợp */
  optional: boolean;
  onPick: (trigger: HTMLElement) => void;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
}

export default function BuildSlotRow({ slot, selected, product, severity, optional, onPick, onRemove, onQuantityChange }: BuildSlotRowProps) {
  const Icon = SLOT_ICON[slot];
  const label = SLOT_LABEL[slot];
  const quantity = selected?.quantity ?? 1;

  return (
    <li
      className={cn(
        "flex flex-wrap items-start gap-3 border-l-4 px-4 py-3.5 sm:flex-nowrap sm:px-5",
        severity === "ERROR" ? "border-l-red-500 bg-red-50/40" : severity === "WARNING" ? "border-l-amber-400 bg-amber-50/30" : "border-l-transparent",
      )}
    >
      <div className="w-14 shrink-0 sm:w-16">
        {product ? (
          <ProductThumb name={product.name} image={product.image} categoryPath={product.categoryPath} className="ring-1 ring-slate-200" sizes="64px" />
        ) : (
          <span className="grid aspect-4/3 w-full place-items-center rounded-lg bg-slate-100 text-slate-400">
            <Icon className="size-6" strokeWidth={1.5} aria-hidden />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 basis-40">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
          {label}
          {optional ? (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-slate-500">
              Không bắt buộc — CPU có đồ họa tích hợp
            </span>
          ) : null}
        </p>

        {product ? (
          <>
            <Link
              href={`/san-pham/${product.slug}`}
              target="_blank"
              className="mt-0.5 inline-flex items-start gap-1 text-sm font-semibold text-slate-800 transition hover:text-brand-600"
            >
              <span className="line-clamp-2">{product.name}</span>
              <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-label="(mở tab mới)" />
            </Link>
            <SpecChips specs={product.keySpecs} />
            {product.specNotes.map((note) => (
              <p key={note} className="mt-1 text-[11px] italic text-slate-500">
                * {note}
              </p>
            ))}
          </>
        ) : (
          <p className="mt-1 text-sm text-slate-500">{selected ? "Đang tải thông tin…" : "Chưa chọn"}</p>
        )}
      </div>

      <div className="ml-auto flex shrink-0 flex-col items-end gap-2">
        {product ? (
          <div className="text-right">
            <p className="text-sm font-bold text-sale-600">{formatPrice(product.price * quantity)}</p>
            {quantity > 1 ? (
              <p className="text-[11px] text-slate-500">
                {formatPrice(product.price)} × {quantity}
              </p>
            ) : null}
            {product.inStock === false ? <p className="text-[11px] font-semibold text-slate-400">Hết hàng</p> : null}
          </div>
        ) : null}

        {product && slot === "RAM" ? (
          <QuantityStepper value={quantity} max={MAX_RAM_QUANTITY} onChange={onQuantityChange} label={product.name} />
        ) : null}

        {/* Nút chính giữ nguyên vị trí dù đổi nhãn "Chọn" ↔ "Đổi", để đóng bảng chọn xong focus trả về đúng nút */}
        <div className="flex items-center gap-1.5">
          {selected ? (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Bỏ ${label} đã chọn`}
              className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-red-600"
            >
              <X className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={(event) => onPick(event.currentTarget)}
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-bold transition",
              selected
                ? "border border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:text-brand-600"
                : "bg-brand-500 text-white hover:bg-brand-600",
            )}
          >
            {selected ? "Đổi" : `Chọn ${label}`}
          </button>
        </div>
      </div>
    </li>
  );
}
