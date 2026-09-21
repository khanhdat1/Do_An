import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Box, CornerDownLeft, History, Info, LayoutGrid, LoaderCircle, Search, Tag, TrendingUp } from "lucide-react";
import Highlight from "@/components/search/Highlight";
import { formatPrice } from "@/lib/format";
import { groupRows, type SuggestRow } from "@/lib/search-suggest";
import type { SuggestProduct } from "@/types";
import { cn } from "@/lib/utils";

export interface SuggestNotice {
  tone: "loading" | "info";
  text: string;
}

interface SuggestPanelProps {
  /** Id của listbox; id từng dòng là `${id}-${chỉ số}` (ô nhập trỏ tới đó bằng aria-activedescendant) */
  id: string;
  rows: SuggestRow[];
  /** Chỉ số dòng đang chọn, -1 nếu chưa chọn */
  active: number;
  /** Từ khoá không dấu để tô sáng tên sản phẩm */
  terms: string[];
  /** Danh sách đang là của câu gõ trước, chờ câu mới: làm mờ đi cho khỏi tưởng đã cập nhật */
  stale: boolean;
  notice?: SuggestNotice;
  onHover: (index: number) => void;
  onLeave: () => void;
  /** Bấm vào một dòng (trình duyệt tự chuyển trang theo liên kết của dòng) */
  onPick: (row: SuggestRow) => void;
  /** Có thì hiện nút xoá lịch sử tìm kiếm ở cuối hộp */
  onClearRecent?: () => void;
}

const HEADINGS: Record<SuggestRow["kind"], string | null> = {
  product: "Sản phẩm",
  category: "Danh mục",
  brand: "Hãng",
  recent: "Tìm kiếm gần đây",
  popular: "Tìm kiếm phổ biến",
  all: null,
};

const rowClass = "flex items-center gap-3 px-4 py-2 transition-colors";
/** Dòng đang chọn: nền cam nhạt kèm vạch cam bên trái, đủ rõ để thấy phím mũi tên đang ở đâu */
const rowActiveClass = "bg-brand-50 shadow-[inset_3px_0_0_0_var(--color-brand-500)]";

function Thumb({ product }: { product: SuggestProduct }) {
  return (
    <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
      {product.image ? (
        <Image src={product.image} alt="" fill sizes="48px" className="object-contain p-1" />
      ) : (
        <Box className="size-5 text-slate-300" />
      )}
    </span>
  );
}

function RowContent({ row, terms }: { row: SuggestRow; terms: string[] }) {
  switch (row.kind) {
    case "product": {
      const { product } = row;
      return (
        <>
          <Thumb product={product} />
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-sm font-medium leading-snug text-slate-800">
              <Highlight text={product.name} terms={terms} />
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">
              {product.categoryName}
              {product.inStock ? null : <span className="font-semibold text-sale-600"> · Hết hàng</span>}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-sm font-bold text-sale-600">{formatPrice(product.price)}</span>
            {product.oldPrice ? (
              <span className="block text-[11px] text-slate-400 line-through">{formatPrice(product.oldPrice)}</span>
            ) : null}
          </span>
        </>
      );
    }

    case "category":
    case "brand": {
      const facet = row.kind === "category" ? row.category : row.brand;
      const Icon = row.kind === "category" ? LayoutGrid : Tag;
      return (
        <>
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
            <Icon className="size-4.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-slate-800">
              <Highlight text={facet.name} terms={terms} />
            </span>
            <span className="block text-xs text-slate-500">{facet.count} sản phẩm</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-slate-300" />
        </>
      );
    }

    case "all":
      return (
        <>
          <Search className="size-4.5 shrink-0 text-brand-500" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
            {row.total !== null ? `Xem tất cả ${row.total} kết quả cho “${row.search}”` : `Tìm “${row.search}”`}
          </span>
          <CornerDownLeft className="hidden size-4 shrink-0 text-slate-300 sm:block" />
        </>
      );

    case "recent":
      return (
        <>
          <History className="size-4.5 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{row.search}</span>
        </>
      );

    case "popular":
      return <span>{row.search}</span>;
  }
}

/**
 * Hộp gợi ý xổ xuống dưới ô tìm kiếm. Chỉ vẽ: trạng thái (dòng đang chọn, danh sách dòng, chờ tải) do SearchBar giữ.
 * Hộp là một listbox; ô nhập giữ tiêu điểm suốt và trỏ tới dòng đang chọn bằng aria-activedescendant, mỗi dòng là
 * liên kết thật (mở tab mới bằng chuột giữa được).
 */
export default function SuggestPanel({ id, rows, active, terms, stale, notice, onHover, onLeave, onPick, onClearRecent }: SuggestPanelProps) {
  return (
    // Nhấn chuột vào hộp không được cướp tiêu điểm khỏi ô nhập: mất tiêu điểm là hộp đóng lại trước khi kịp bấm trúng dòng
    <div
      onMouseDown={(event) => event.preventDefault()}
      className="absolute inset-x-0 top-full z-50 mt-2 max-h-[min(34rem,calc(100dvh-11rem))] overflow-y-auto overscroll-contain rounded-xl bg-white text-left shadow-2xl shadow-black/25 ring-1 ring-slate-900/10"
    >
      {notice ? (
        <p className="flex items-center gap-2 px-4 pt-3 text-xs text-slate-500">
          {notice.tone === "loading" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Info className="size-3.5" />}
          {notice.text}
        </p>
      ) : null}

      <div
        id={id}
        role="listbox"
        aria-label="Gợi ý tìm kiếm"
        aria-busy={stale}
        onMouseLeave={onLeave}
        className={cn("pb-1 transition-opacity", stale && "opacity-60")}
      >
        {groupRows(rows).map((group) => {
          const heading = HEADINGS[group.kind];

          return (
            <div key={group.kind} role="group" aria-label={heading ?? "Xem tất cả kết quả"} className={cn(group.kind === "all" && "mt-1 border-t border-slate-100 pt-1")}>
              {heading ? (
                <p aria-hidden="true" className="flex items-center gap-1.5 px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {group.kind === "popular" ? <TrendingUp className="size-3.5" /> : null}
                  {heading}
                </p>
              ) : null}

              <div className={cn(group.kind === "popular" && "flex flex-wrap gap-2 px-4 pb-2 pt-1")}>
                {group.items.map(({ row, index }) => (
                  <Link
                    key={row.id}
                    id={`${id}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    href={row.href}
                    // Mỗi lần gõ hiện tới 5 sản phẩm: nạp trước cả 5 trang chỉ để phòng có người bấm là phí
                    prefetch={false}
                    tabIndex={-1}
                    onClick={() => onPick(row)}
                    onMouseMove={() => index !== active && onHover(index)}
                    className={
                      row.kind === "popular"
                        ? cn(
                            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                            index === active
                              ? "border-brand-400 bg-brand-50 text-brand-700"
                              : "border-slate-200 bg-white text-slate-700 hover:border-brand-400",
                          )
                        : cn(rowClass, index === active ? rowActiveClass : "hover:bg-slate-50")
                    }
                  >
                    <RowContent row={row} terms={terms} />
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {onClearRecent ? (
        <div className="border-t border-slate-100 px-4 py-2 text-right">
          <button
            type="button"
            onClick={onClearRecent}
            className="text-xs font-semibold text-slate-500 underline-offset-2 transition hover:text-brand-600 hover:underline"
          >
            Xóa lịch sử tìm kiếm
          </button>
        </div>
      ) : null}
    </div>
  );
}
