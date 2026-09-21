import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  /** Đường dẫn trang hiện tại, vd "/danh-muc/cpu" */
  pathname: string;
  /** Các tham số bộ lọc đang bật (không gồm `page`) */
  params: URLSearchParams;
}

/** Trang cần hiện: đầu, cuối, trang hiện tại và hai trang kề; chỗ đứt quãng thay bằng "…" */
function visiblePages(page: number, totalPages: number): (number | "gap")[] {
  const wanted = [...new Set([1, totalPages, page - 1, page, page + 1])]
    .filter((number) => number >= 1 && number <= totalPages)
    .sort((a, b) => a - b);

  const items: (number | "gap")[] = [];
  wanted.forEach((number, index) => {
    if (index > 0 && number - wanted[index - 1] > 1) items.push("gap");
    items.push(number);
  });
  return items;
}

/**
 * Phân trang bằng liên kết thật (<a>) chứ không phải nút chạy JavaScript: công cụ tìm kiếm đi được
 * sang trang sau, bấm chuột giữa để mở tab mới cũng hoạt động, và không cần hydrate.
 */
export default function Pagination({ page, totalPages, pathname, params }: PaginationProps) {
  if (totalPages <= 1) return null;

  const hrefFor = (target: number) => {
    const next = new URLSearchParams(params);
    if (target > 1) next.set("page", String(target));
    else next.delete("page");
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const base =
    "grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm font-semibold transition";

  return (
    <nav aria-label="Phân trang" className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          rel="prev"
          aria-label="Trang trước"
          className={cn(base, "border-slate-200 bg-white text-slate-600 hover:border-brand-400 hover:text-brand-600")}
        >
          <ChevronLeft className="size-4" />
        </Link>
      ) : null}

      {visiblePages(page, totalPages).map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-slate-400" aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={hrefFor(item)}
            aria-current={item === page ? "page" : undefined}
            aria-label={`Trang ${item}`}
            className={cn(
              base,
              item === page
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-brand-400 hover:text-brand-600",
            )}
          >
            {item}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link
          href={hrefFor(page + 1)}
          rel="next"
          aria-label="Trang sau"
          className={cn(base, "border-slate-200 bg-white text-slate-600 hover:border-brand-400 hover:text-brand-600")}
        >
          <ChevronRight className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
