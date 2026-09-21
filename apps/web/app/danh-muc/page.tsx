import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Breadcrumb from "@/components/product/Breadcrumb";
import CategoryIcon from "@/components/ui/CategoryIcon";
import { getCategories } from "@/lib/api";

export const metadata: Metadata = {
  title: "Danh mục sản phẩm | PCZone",
  description: "Toàn bộ danh mục laptop, PC, linh kiện máy tính, màn hình và gaming gear chính hãng tại PCZone.",
};

/** Trang tổng hợp mọi danh mục, đích của liên kết "Xem tất cả" ở trang chủ */
export default async function CategoriesPage() {
  const categories = await getCategories();

  // Danh mục cha không có sản phẩm trực tiếp: số của nó là tổng các danh mục con
  const withTotals = categories.map((category) => ({
    ...category,
    total: (category.productCount ?? 0) + (category.children ?? []).reduce((sum, child) => sum + (child.productCount ?? 0), 0),
  }));

  return (
    <div className="container-page py-4">
      <Breadcrumb categories={[]} current="Danh mục sản phẩm" />

      <h1 className="section-title text-2xl sm:text-3xl">Danh mục sản phẩm</h1>
      <p className="mt-1.5 text-sm text-slate-500">
        Chọn nhóm sản phẩm bạn quan tâm — mỗi danh mục đều có bộ lọc theo hãng, khoảng giá và tình trạng hàng.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {withTotals.map((category) => (
          <section key={category.slug} className="surface-card overflow-hidden">
            <Link
              href={`/danh-muc/${category.slug}`}
              className="group flex items-center gap-4 p-4 transition hover:bg-brand-50/50 sm:p-5"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 transition group-hover:bg-brand-100">
                <CategoryIcon name={category.icon} className="size-6 text-brand-500" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-bold text-slate-900 transition group-hover:text-brand-600">
                  {category.name}
                </span>
                <span className="block text-xs text-slate-500">{category.total} sản phẩm</span>
              </span>
              <ChevronRight className="size-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
            </Link>

            {category.children && category.children.length > 0 ? (
              <ul className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100">
                {category.children.map((child) => (
                  <li key={child.slug} className="bg-white">
                    <Link
                      href={`/danh-muc/${child.slug}`}
                      className="flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-brand-600"
                    >
                      <CategoryIcon name={child.icon} className="size-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate">{child.name}</span>
                      <span className="text-xs text-slate-400">{child.productCount ?? 0}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
