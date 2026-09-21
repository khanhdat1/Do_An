import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PackageSearch } from "lucide-react";
import CategoryShell from "@/components/category/CategoryShell";
import Pagination from "@/components/category/Pagination";
import Breadcrumb from "@/components/product/Breadcrumb";
import ProductCard from "@/components/product/ProductCard";
import CategoryIcon from "@/components/ui/CategoryIcon";
import { getCategory, getProducts } from "@/lib/api";
import {
  CATEGORY_PAGE_SIZE,
  countActiveFilters,
  parseCategoryQuery,
  toSearchParams,
} from "@/lib/category-query";
import { formatPrice } from "@/lib/format";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);

  if (!category) return { title: "Không tìm thấy danh mục | PCZone" };

  return {
    title: `${category.name} chính hãng, giá tốt | PCZone`,
    description: `Mua ${category.name} chính hãng tại PCZone: ${category.productCount} sản phẩm, bảo hành đầy đủ, giao nhanh toàn quốc.`,
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = parseCategoryQuery(await searchParams);

  const [category, list] = await Promise.all([
    getCategory(slug),
    getProducts({
      category: slug,
      brand: query.brands.length > 0 ? query.brands.join(",") : undefined,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      inStock: query.inStock || undefined,
      sort: query.sort,
      page: query.page,
      pageSize: CATEGORY_PAGE_SIZE,
    }),
  ]);

  if (!category) notFound();

  const pathname = `/danh-muc/${category.slug}`;
  const queryParams = toSearchParams(query);

  // Địa chỉ cũ còn nhớ trang 9 nhưng bộ lọc mới chỉ còn 2 trang: về trang cuối thay vì hiện trang trống
  if (query.page > list.totalPages && list.total > 0) {
    if (list.totalPages > 1) queryParams.set("page", String(list.totalPages));
    const rest = queryParams.toString();
    redirect(rest ? `${pathname}?${rest}` : pathname);
  }

  const filtered = countActiveFilters(query) > 0;

  return (
    <div className="container-page py-4">
      <Breadcrumb categories={category.breadcrumb.slice(0, -1)} current={category.name} />

      <header className="surface-card overflow-hidden">
        <div className="flex items-center gap-4 p-4 sm:p-6">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-50">
            <CategoryIcon name={category.icon} className="size-7 text-brand-500" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h1 className="section-title text-2xl sm:text-3xl">{category.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {category.productCount} sản phẩm chính hãng
              {category.priceRange ? ` · giá từ ${formatPrice(category.priceRange.min)}` : null}
            </p>
          </div>
        </div>

        {category.children.length > 0 ? (
          <nav aria-label="Danh mục con" className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-6">
            <ul className="flex flex-wrap gap-2">
              {category.children.map((child) => (
                <li key={child.slug}>
                  <Link
                    href={`/danh-muc/${child.slug}`}
                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-400 hover:text-brand-600"
                  >
                    <CategoryIcon name={child.icon} className="size-4 text-brand-500" />
                    {child.name}
                    <span className="text-xs font-normal text-slate-400">{child.productCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      <CategoryShell brands={category.brands} priceRange={category.priceRange} total={list.total}>
        {list.items.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {list.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <Pagination page={list.page} totalPages={list.totalPages} pathname={pathname} params={toSearchParams(query)} />
          </>
        ) : (
          <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-slate-100 text-slate-400">
              <PackageSearch className="size-8" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-slate-800">
              {filtered ? "Không có sản phẩm phù hợp bộ lọc" : "Danh mục đang được cập nhật"}
            </h2>
            <p className="mt-1.5 max-w-sm text-sm text-slate-500">
              {filtered
                ? "Thử bỏ bớt bộ lọc hoặc mở rộng khoảng giá để xem thêm sản phẩm."
                : "Sản phẩm của danh mục này sẽ sớm có mặt. Bạn có thể xem các danh mục khác trong lúc chờ."}
            </p>
            <Link
              href={filtered ? pathname : "/danh-muc"}
              className="mt-6 rounded-xl bg-brand-500 px-6 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
            >
              {filtered ? "Xóa bộ lọc" : "Xem danh mục khác"}
            </Link>
          </div>
        )}
      </CategoryShell>
    </div>
  );
}
