"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import FilterPanel from "@/components/category/FilterPanel";
import {
  DEFAULT_SORT,
  FILTER_PARAMS,
  SORT_OPTIONS,
  countActiveFilters,
  parseCategoryQuery,
} from "@/lib/category-query";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BrandFacet } from "@/types";

interface CategoryShellProps {
  brands: BrandFacet[];
  priceRange: { min: number; max: number } | null;
  /** Số sản phẩm khớp bộ lọc hiện tại (tính ở server) */
  total: number;
  /** Lưới sản phẩm + phân trang, render ở server */
  children: React.ReactNode;
}

/** "Từ 3.000.000đ", "Đến 9.000.000đ" hoặc "3.000.000đ – 9.000.000đ" */
function describePrice(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) return `${formatPrice(min)} – ${formatPrice(max)}`;
  if (min !== undefined) return `Từ ${formatPrice(min)}`;
  return `Đến ${formatPrice(max ?? 0)}`;
}

/**
 * Khung trang danh mục: cột bộ lọc bên trái, thanh sắp xếp + chip bộ lọc đang bật, và phần nội dung
 * (lưới sản phẩm) do server truyền vào qua `children`.
 *
 * Mọi thay đổi bộ lọc chỉ đổi URL rồi để Next render lại phần server; trạng thái thật luôn nằm
 * trên URL (xem lib/category-query.ts). Trên mobile cột lọc là ngăn kéo mở bằng nút "Bộ lọc".
 */
export default function CategoryShell({ brands, priceRange, total, children }: CategoryShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const query = useMemo(() => parseCategoryQuery(Object.fromEntries(searchParams)), [searchParams]);
  const activeCount = countActiveFilters(query);
  const brandName = useMemo(() => new Map(brands.map((brand) => [brand.slug, brand.name])), [brands]);

  /** Đổi URL: sửa tham số rồi luôn về trang 1, vì bộ lọc mới có thể ít kết quả hơn trang đang xem */
  const navigate = (change: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    change(params);
    params.delete("page");
    const next = params.toString();
    startTransition(() => router.push(next ? `${pathname}?${next}` : pathname, { scroll: false }));
  };

  const toggleBrand = (slug: string) =>
    navigate((params) => {
      const selected = new Set(query.brands);
      if (!selected.delete(slug)) selected.add(slug);
      if (selected.size > 0) params.set("brand", [...selected].join(","));
      else params.delete("brand");
    });

  const setPrice = (min?: number, max?: number) =>
    navigate((params) => {
      if (min !== undefined) params.set("minPrice", String(min));
      else params.delete("minPrice");
      if (max !== undefined) params.set("maxPrice", String(max));
      else params.delete("maxPrice");
    });

  const setInStock = (value: boolean) =>
    navigate((params) => {
      if (value) params.set("inStock", "true");
      else params.delete("inStock");
    });

  const setSort = (value: string) =>
    navigate((params) => {
      if (value === DEFAULT_SORT) params.delete("sort");
      else params.set("sort", value);
    });

  const clearAll = () =>
    navigate((params) => {
      for (const key of FILTER_PARAMS) params.delete(key);
    });

  const hasPrice = query.minPrice !== undefined || query.maxPrice !== undefined;

  const panel = (onClose?: () => void) => (
    <FilterPanel
      brands={brands}
      priceRange={priceRange}
      query={query}
      activeCount={activeCount}
      onToggleBrand={toggleBrand}
      onPrice={setPrice}
      onInStock={setInStock}
      onClear={clearAll}
      onClose={onClose}
    />
  );

  const chip =
    "inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-3 pr-2 text-xs font-medium text-brand-700 ring-1 ring-brand-200";

  return (
    <div className="mt-5 grid grid-cols-1 items-start gap-6 lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      {/* Cột lọc trên desktop: dính theo màn hình, dưới thanh menu dính đầu trang */}
      <aside className="surface-card hidden max-h-[calc(100vh-12rem)] overflow-y-auto p-4 lg:sticky lg:top-44 lg:block">
        {panel()}
      </aside>

      {/* Ngăn kéo lọc trên mobile */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Bộ lọc sản phẩm">
          <button
            type="button"
            aria-label="Đóng bộ lọc"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-ink-950/60"
          />
          <div className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-white shadow-xl">
            <div className="flex-1 overflow-y-auto p-4">{panel(() => setDrawerOpen(false))}</div>
            <div className="border-t border-slate-100 p-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-full rounded-xl bg-brand-500 px-4 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
              >
                Xem {total} sản phẩm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="min-w-0">
        {/* Thanh công cụ: số kết quả, nút lọc (mobile), sắp xếp */}
        <div className="surface-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-slate-600">
            <span className="font-bold text-slate-900">{total}</span> sản phẩm
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-400 lg:hidden"
            >
              <SlidersHorizontal className="size-4" />
              Bộ lọc
              {activeCount > 0 ? (
                <span className="grid size-5 place-items-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
                  {activeCount}
                </span>
              ) : null}
            </button>

            <label className="flex items-center gap-2 text-sm text-slate-500">
              <span className="hidden sm:inline">Sắp xếp</span>
              <select
                value={query.sort}
                onChange={(event) => setSort(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Chip bộ lọc đang bật: bấm để bỏ từng cái */}
        {activeCount > 0 ? (
          <ul className="mt-3 flex flex-wrap items-center gap-2">
            {query.inStock ? (
              <li>
                <button type="button" onClick={() => setInStock(false)} className={chip}>
                  Còn hàng
                  <X className="size-3.5" aria-label="Bỏ lọc còn hàng" />
                </button>
              </li>
            ) : null}
            {query.brands.map((slug) => (
              <li key={slug}>
                <button type="button" onClick={() => toggleBrand(slug)} className={chip}>
                  {brandName.get(slug) ?? slug}
                  <X className="size-3.5" aria-label={`Bỏ lọc ${brandName.get(slug) ?? slug}`} />
                </button>
              </li>
            ))}
            {hasPrice ? (
              <li>
                <button type="button" onClick={() => setPrice()} className={chip}>
                  {describePrice(query.minPrice, query.maxPrice)}
                  <X className="size-3.5" aria-label="Bỏ lọc giá" />
                </button>
              </li>
            ) : null}
            <li>
              <button
                type="button"
                onClick={clearAll}
                className="px-1 text-xs font-semibold text-slate-500 underline-offset-2 transition hover:text-brand-600 hover:underline"
              >
                Xóa tất cả
              </button>
            </li>
          </ul>
        ) : null}

        <div
          className={cn("mt-4 transition-opacity", isPending && "pointer-events-none opacity-50")}
          aria-busy={isPending}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
