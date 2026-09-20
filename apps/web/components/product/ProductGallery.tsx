"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductThumb from "./ProductThumb";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/types";

interface ProductGalleryProps {
  images: ProductImage[];
  name: string;
  categoryPath: string[];
}

/**
 * Bộ ảnh của trang chi tiết: ảnh lớn + dải ảnh nhỏ bên dưới.
 * Sản phẩm chưa có ảnh (chờ crawler tải ảnh chính hãng) thì hiện placeholder
 * theo danh mục, giống thẻ sản phẩm.
 */
export default function ProductGallery({ images, name, categoryPath }: ProductGalleryProps) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-2">
        <ProductThumb
          name={name}
          categoryPath={categoryPath}
          className="aspect-square"
          sizes="(max-width: 1024px) 100vw, 45vw"
        />
      </div>
    );
  }

  const active = images[index] ?? images[0];
  const many = images.length > 1;

  function go(step: number) {
    setIndex((current) => (current + step + images.length) % images.length);
  }

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Image
          key={active.url}
          src={active.url}
          alt={active.alt}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 45vw"
          className="object-contain p-4"
        />

        {many ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Ảnh trước"
              className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow ring-1 ring-slate-200 transition hover:bg-white"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Ảnh sau"
              className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow ring-1 ring-slate-200 transition hover:bg-white"
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-ink-950/70 px-2 py-0.5 text-[10px] font-semibold text-white">
              {index + 1} / {images.length}
            </span>
          </>
        ) : null}
      </div>

      {many ? (
        <ul className="mt-3 grid grid-cols-5 gap-2">
          {images.map((image, position) => (
            <li key={image.url}>
              <button
                type="button"
                onClick={() => setIndex(position)}
                aria-label={`Xem ảnh ${position + 1}`}
                aria-current={position === index}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-lg border bg-white transition",
                  position === index
                    ? "border-brand-500 ring-2 ring-brand-500/25"
                    : "border-slate-200 hover:border-slate-400",
                )}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-contain p-1.5"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
