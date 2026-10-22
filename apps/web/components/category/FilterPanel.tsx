"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { buildPriceBrackets, isSpecFilterKey, orderSpecOptions, type CategoryQuery, type SpecFilterKey } from "@/lib/category-query";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BrandFacet, CategoryFacet, SpecFacetGroup } from "@/types";

interface FilterPanelProps {
  brands: BrandFacet[];
  priceRange: { min: number; max: number } | null;
  /** Nhóm lọc thông số của danh mục (socket, dòng CPU...); không truyền = không có */
  specGroups?: SpecFacetGroup[];
  query: Pick<CategoryQuery, "brands" | "minPrice" | "maxPrice" | "inStock"> & Partial<Pick<CategoryQuery, "specs">>;
  /** Số bộ lọc đang bật; 0 thì ẩn nút "Xóa lọc" */
  activeCount: number;
  onToggleBrand: (slug: string) => void;
  onToggleSpec?: (key: SpecFilterKey, value: string) => void;
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
/** Nhóm thông số ngắn hơn: một danh mục có tới 4–5 nhóm */
const SPEC_OPTIONS_SHOWN = 6;

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

  const field = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-500 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

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
        <span className="text-slate-500">–</span>
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

/**
 * Một nhóm lọc thông số: chọn nhiều giá trị (HOẶC trong nhóm). Lựa chọn không còn sản phẩm nào với các bộ lọc khác đang
 * bật thì khoá lại (vẫn hiện để danh sách không nhảy chỗ), trừ khi đang được chọn — để còn bỏ chọn được.
 */
function SpecFilterGroup({
  group,
  selected,
  onToggle,
}: {
  group: SpecFacetGroup;
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  const chosen = new Set(selected);
  const options = orderSpecOptions(group.options, selected);
  const hiddenSelected = options.some((option, index) => index >= SPEC_OPTIONS_SHOWN && chosen.has(option.value));
  const [expanded, setExpanded] = useState(hiddenSelected);
  const visible = options.filter((_, index) => expanded || index < SPEC_OPTIONS_SHOWN);

  return (
    <Section title={group.label}>
      <ul className="space-y-0.5">
        {visible.map((option) => {
          const checked = chosen.has(option.value);
          const disabled = !checked && option.count === 0;
          return (
            <li key={option.value}>
              {/* Cả dòng (cao 28px) là vùng bấm, như danh sách hãng: đủ chỗ chạm trên điện thoại */}
              <label
                className={cn(
                  "flex min-h-7 items-center gap-2.5 text-sm",
                  disabled ? "cursor-not-allowed text-slate-500" : "cursor-pointer text-slate-700",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(option.value)}
                  className="size-4 accent-brand-500"
                />
                <span className="flex-1">{option.label}</span>
                <span className="text-xs text-slate-500">{option.count}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {group.options.length > SPEC_OPTIONS_SHOWN ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="mt-2 text-xs font-semibold text-blue-600 transition hover:text-blue-700"
        >
          {expanded ? "Thu gọn" : `Xem thêm ${group.options.length - SPEC_OPTIONS_SHOWN} lựa chọn`}
        </button>
      ) : null}
    </Section>
  );
}

/** Nội dung bộ lọc của trang danh mục: còn hàng, thương hiệu, thông số kỹ thuật, khoảng giá */
export default function FilterPanel({
  brands,
  priceRange,
  specGroups = [],
  query,
  activeCount,
  onToggleBrand,
  onToggleSpec,
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
                    <span className={cn("text-xs", active ? "text-brand-600" : "text-slate-500")}>{category.count}</span>
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
          <ul className="space-y-0.5">
            {visibleBrands.map((brand) => (
              <li key={brand.slug}>
                <label className="flex min-h-7 cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedBrands.has(brand.slug)}
                    onChange={() => onToggleBrand(brand.slug)}
                    className="size-4 accent-brand-500"
                  />
                  <span className="flex-1">{brand.name}</span>
                  <span className="text-xs text-slate-500">{brand.count}</span>
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

      {onToggleSpec
        ? specGroups.map((group) =>
            isSpecFilterKey(group.key) ? (
              <SpecFilterGroup
                key={group.key}
                group={group}
                selected={query.specs?.[group.key] ?? []}
                onToggle={(value) => onToggleSpec(group.key as SpecFilterKey, value)}
              />
            ) : null,
          )
        : null}

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
