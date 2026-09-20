import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Breadcrumb as Crumb } from "@/types";

interface BreadcrumbProps {
  /** Đường dẫn danh mục từ gốc tới lá */
  categories: Crumb[];
  /** Tên trang hiện tại (không có liên kết) */
  current: string;
}

/** Đường dẫn điều hướng: Trang chủ › Linh kiện › VGA › Tên sản phẩm */
export default function Breadcrumb({ categories, current }: BreadcrumbProps) {
  return (
    <nav aria-label="Đường dẫn" className="mb-4">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
        <li>
          <Link href="/" className="transition hover:text-brand-600">
            Trang chủ
          </Link>
        </li>

        {categories.map((category) => (
          <li key={category.slug} className="flex items-center gap-1.5">
            <ChevronRight className="size-3.5 text-slate-300" />
            <Link href={`/danh-muc/${category.slug}`} className="transition hover:text-brand-600">
              {category.name}
            </Link>
          </li>
        ))}

        <li className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="size-3.5 shrink-0 text-slate-300" />
          <span aria-current="page" className="line-clamp-1 font-medium text-slate-700">
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}
