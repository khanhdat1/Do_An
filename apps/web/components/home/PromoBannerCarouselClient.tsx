"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Banner } from "@/types";

const AUTO_ADVANCE_MS = 6000;

function BannerSlide({ banner, active }: { banner: Banner; active: boolean }) {
  const className = `absolute inset-0 transition-opacity duration-700 ${active ? "opacity-100" : "pointer-events-none opacity-0"}`;

  const inner = (
    <>
      <Image src={banner.imageUrl} alt={banner.title ?? "Banner khuyến mãi"} fill sizes="100vw" className="object-cover" priority={active} />
      {banner.title || banner.subtitle ? (
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent p-4 sm:p-6">
          {banner.title ? <p className="font-display text-lg font-bold text-white sm:text-2xl">{banner.title}</p> : null}
          {banner.subtitle ? <p className="mt-1 text-xs text-slate-200 sm:text-sm">{banner.subtitle}</p> : null}
        </div>
      ) : null}
    </>
  );

  if (banner.linkUrl) {
    return (
      <Link href={banner.linkUrl} className={className} tabIndex={active ? 0 : -1} aria-hidden={!active}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={className} aria-hidden={!active}>
      {inner}
    </div>
  );
}

/** Dải banner xoay vòng — tự chuyển mỗi ~6s nếu có từ 2 banner trở lên, có nút điều hướng + chấm chỉ mục. */
export default function PromoBannerCarouselClient({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const multiple = banners.length > 1;

  useEffect(() => {
    if (!multiple) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % banners.length), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [multiple, banners.length]);

  function goTo(next: number) {
    setIndex((next + banners.length) % banners.length);
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-slate-100">
      <div className="relative aspect-16/9 w-full sm:aspect-3/1">
        {banners.map((banner, i) => (
          <BannerSlide key={banner.id} banner={banner} active={i === index} />
        ))}
      </div>

      {multiple ? (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Banner trước"
            className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-ink-900 shadow-sm transition hover:bg-white"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Banner sau"
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-ink-900 shadow-sm transition hover:bg-white"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {banners.map((banner, i) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Xem banner ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
