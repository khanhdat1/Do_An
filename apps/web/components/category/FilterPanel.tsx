"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { buildPriceBrackets, type CategoryQuery } from "@/lib/category-query";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BrandFacet, CategoryFacet } from "@/types";

interface FilterPanelProps {
  brands: BrandFacet[];
  priceRange: { min: number; max: number } | null;
  query: Pick<CategoryQuery, "brands" | "minPrice" | "maxPrice" | "inStock">;
  /** Số bộ lọc đang bật; 0 thì ẩn nút "Xóa lọc" */
  activeCount: number;
  onToggleBrand: (slug: string) => void;
  onPrice: (min?: number, max?: number) => void;
  onInStock: (value: boolean) => void;
  onClear: () => void;
  /** Chỉ có trên mobile, nơi bảng lọc là ngăn kéo cần nút đóng */
  onClose?: () => void;
  /** Trang tìm kiếm: kết quả nằm ở nhiều danh mục nên có thêm bộ lọc danh mục. Trang danh mục không truyền. */
  categories?: CategoryFacet[];
  selectedCategory?: string;
  onSelectCategory?: (slug?: string) => void;
}

/** Số hãng hiện sẵn; phần còn lại nằm sau nút "Xem thêm" để cột lọc không dài quá màn hình */
const BRANDS_SHOWN = 8;
const CATEGORIES_SHOWN = 8;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 py-4 first:border-t-0 first:pt-0">
      <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

/** "3.000.000" hoặc "3000000" → 3000000; ô trống hoặc không có chữ số → undefined */
function readMoney(text: string): number | undefined {
  const digits = text.replace(/\D/g, "");
  return digits === "" ? undefined : Number(digits);
}

/** Ô nhập khoảng giá tự chọn. Tách riêng để đổi `key` là đặt lại được ô nhập khi URL thay đổi. */
function PriceInputs({
  min,
  max,
  onSubmit,
}: {
  min?: number;
  max?: number;
  onSubmit: (min?: number, max?: number) => void;
}) {
  const [minText, setMinText] = useState(min === undefined ? "" : formatNumber(min));
  const [maxText, setMaxText] = useState(max === undefined ? "" : formatNumber(max));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(readMoney(minText), readMoney(maxText));
  };

  const field = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  return (
    <form onSubmit={submit} className="mt-3">
      <div className="flex items-center gap-2">
        <input
          value={minText}
          onChange={(event) => setMinText(event.target.value)}
          inputMode="numeric"
          placeholder="Từ (đ)"
          aria-label="Giá thấp nhất"
          className={field}
        />
        <span className="text-slate-400">–</span>
        <input
          value={maxText}
          onChange={(event) => setMaxText(event.target.value)}
          inputMode="numeric"
          placeholder="Đến (đ)"
          aria-label="Giá cao nhất"
          className={field}
        />
      </div>
      <button
        type="submit"
        className="mt-2 w-full rounded-lg bg-ink-900 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-ink-700"
      >
        Áp dụng
      </button>
    </form>
  );
}

/** Nội dung bộ lọc của trang danh mục: còn hàng, thương hiệu, khoảng giá */
export default function FilterPanel({
  brands,
  priceRange,
  query,
  activeCount,
  onToggleBrand,
  onPrice,
  onInStock,
  onClear,
  onClose,
  categories = [],
  selectedCategory,
  onSelectCategory,
}: FilterPanelProps) {
  const selectedBrands = new Set(query.brands);
  const hasHiddenSelected = brands.some((brand, index) => index >= BRANDS_SHOWN && selectedBrands.has(brand.slug));
  const [expanded, setExpanded] = useState(hasHiddenSelected);

  const hiddenCategorySelected = categories.some((category, index) => index >= CATEGORIES_SHOWN && category.slug === selectedCategory);
  const [categoriesExpanded, setCategoriesExpanded] = useState(hiddenCategorySelected);
  const visibleCategories = categories.filter((_, index) => categoriesExpanded || index < CATEGORIES_SHOWN);

  const visibleBrands = brands.filter((_, index) => expanded || index < BRANDS_SHOWN);
  const brackets = buildPriceBrackets(priceRange);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-display text-base font-bold text-slate-900">Bộ lọc</p>
        <div className="flex items-center gap-3">
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-semibold text-brand-600 transition hover:text-brand-700"
            >
              Xóa lọc ({activeCount})
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng bộ lọc"
              className="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 lg:hidden"
            >
              <X className="size-5" />
            </button>
          ) : null}
        </div>
      </div>

      {categories.length > 0 && onSelectCategory ? (
        <Section title="Danh mục">
          <ul className="space-y-1">
            {visibleCategories.map((category) => {
              const active = category.slug === selectedCategory;
              return (
                <li key={category.slug}>
                  <button
                    type="button"
                    aria-pressed={active}
                    // Bấm lại danh mục đang chọn thì bỏ chọn
                    onClick={() => onSelectCategory(active ? undefined : category.slug)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition",
                      active ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <span className="flex-1">{category.name}</span>
                    <span className={cn("text-xs", active ? "text-brand-600" : "text-slate-400")}>{category.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {categories.length > CATEGORIES_SHOWN ? (
            <button
              type="button"
              onClick={() => setCategoriesExpanded((open) => !open)}
              className="mt-2.5 text-xs font-semibold text-blue-600 transition hover:text-blue-700"
            >
              {categoriesExpanded ? "Thu gọn" : `Xem thêm ${categories.length - CATEGORIES_SHOWN} danh mục`}
            </button>
          ) : null}
        </Section>
      ) : null}

      <Section title="Tình trạng">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={query.inStock}
            onChange={(event) => onInStock(event.target.checked)}
            className="size-4 accent-brand-500"
          />
          Chỉ hiện hàng còn sẵn
        </label>
      </Section>

      {brands.length > 0 ? (
        <Section title="Thương hiệu">
          <ul className="space-y-2">
            {visibleBrands.map((brand) => (
              <li key={brand.slug}>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedBrands.has(brand.slug)}
                    onChange={() => onToggleBrand(brand.slug)}
                    className="size-4 accent-brand-500"
                  />
                  <span className="flex-1">{brand.name}</span>
                  <span className="text-xs text-slate-400">{brand.count}</span>
                </label>
              </li>
            ))}
          </ul>
          {brands.length > BRANDS_SHOWN ? (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              className="mt-2.5 text-xs font-semibold text-blue-600 transition hover:text-blue-700"
            >
              {expanded ? "Thu gọn" : `Xem thêm ${brands.length - BRANDS_SHOWN} hãng`}
            </button>
          ) : null}
        </Section>
      ) : null}

      {priceRange ? (
        <Section title="Khoảng giá">
          {brackets.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {brackets.map((bracket) => {
                const active = query.minPrice === bracket.min && query.maxPrice === bracket.max;
                return (
                  <button
                    key={bracket.label}
                    type="button"
                    aria-pressed={active}
                    // Bấm lại mức đang chọn thì bỏ chọn
                    onClick={() => (active ? onPrice() : onPrice(bracket.min, bracket.max))}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      active
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600",
                    )}
                  >
                    {bracket.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          <PriceInputs
            key={`${query.minPrice ?? ""}-${query.maxPrice ?? ""}`}
            min={query.minPrice}
            max={query.maxPrice}
            onSubmit={onPrice}
          />
        </Section>
      ) : null}
    </div>
  );
}
