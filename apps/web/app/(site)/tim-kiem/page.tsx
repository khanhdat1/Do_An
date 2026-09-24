import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Coins, Info, Lightbulb, Search, SearchX, Sparkles, SpellCheck, TrendingUp, WifiOff, X } from "lucide-react";
import CategoryShell from "@/components/category/CategoryShell";
import Pagination from "@/components/category/Pagination";
import Breadcrumb from "@/components/product/Breadcrumb";
import ProductCard from "@/components/product/ProductCard";
import CategoryIcon from "@/components/ui/CategoryIcon";
import { aiSearchProducts, getFeaturedCategories, searchProducts } from "@/lib/api";
import { countActiveFilters } from "@/lib/category-query";
import { popularSearches, searchTips } from "@/lib/data/search";
import {
  SEARCH_PAGE_SIZE,
  SEARCH_SORT_OPTIONS,
  DEFAULT_SEARCH_SORT,
  parseSearchQuery,
  searchHref,
  toSearchPageParams,
  type SearchQuery,
} from "@/lib/search-query";
import type { AiSearchResult, SearchResult } from "@/types";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = parseSearchQuery(await searchParams);

  return {
    title: q ? `Tìm kiếm “${q}” | PCZone` : "Tìm kiếm sản phẩm | PCZone",
    description: q
      ? `Kết quả tìm kiếm “${q}” tại PCZone: laptop, PC, linh kiện, màn hình và gaming gear chính hãng.`
      : "Tìm laptop, linh kiện, màn hình, gaming gear chính hãng tại PCZone theo tên, hãng, thông số hoặc mức giá.",
    // Trang kết quả tìm kiếm là nội dung vô hạn theo từ khoá: không để công cụ tìm kiếm lập chỉ mục
    robots: { index: false, follow: true },
  };
}

const chipClass =
  "inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-3 pr-2 text-xs font-medium text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-100";

const pillClass =
  "inline-flex items-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-400 hover:text-brand-600";

/** Các ý "API đã hiểu câu của bạn thế này" hiện dưới tiêu đề: đã sửa lỗi gõ, đã bỏ từ, khớp gần đúng, lọc giá */
function Notices({ result, query }: { result: SearchResult; query: SearchQuery }) {
  const items: React.ReactNode[] = [];

  if (result.corrections.length > 0) {
    items.push(
      <li key="corrections" className="flex items-start gap-2 text-sm text-slate-600">
        <SpellCheck className="mt-0.5 size-4 shrink-0 text-brand-500" />
        <span>
          Đã tự sửa {result.corrections.map((fix, index) => (
            <span key={fix.from}>
              {index > 0 ? ", " : ""}
              “<span className="font-semibold text-slate-800">{fix.from}</span>” thành “<span className="font-semibold text-slate-800">{fix.to}</span>”
            </span>
          ))}
          .
        </span>
      </li>,
    );
  }

  // Không còn sản phẩm nào thì thông báo "đã bỏ qua từ này" vô nghĩa: trạng thái rỗng bên dưới đã nói đủ
  if (result.ignoredTerms.length > 0 && result.total > 0) {
    items.push(
      <li key="ignored" className="flex items-start gap-2 text-sm text-slate-600">
        <Info className="mt-0.5 size-4 shrink-0 text-slate-400" />
        <span>
          Không có sản phẩm nào chứa {result.ignoredTerms.map((term) => `“${term}”`).join(", ")}, nên đã bỏ qua {result.ignoredTerms.length > 1 ? "các từ" : "từ"} này.
        </span>
      </li>,
    );
  }

  if (result.relaxed && result.total > 0) {
    items.push(
      <li key="relaxed" className="flex items-start gap-2 text-sm text-slate-600">
        <Info className="mt-0.5 size-4 shrink-0 text-slate-400" />
        <span>Không có sản phẩm nào khớp đủ mọi từ khoá. Đây là các sản phẩm khớp nhiều từ khoá nhất.</span>
      </li>,
    );
  }

  if (result.priceIntent) {
    // Bỏ cụm giá khỏi câu tìm kiếm nhưng giữ nguyên các bộ lọc khác
    const params = toSearchPageParams({ ...query, q: result.priceIntent.queryWithoutPrice });
    const remove = params.toString() ? `/tim-kiem?${params.toString()}` : "/tim-kiem";

    items.push(
      <li key="price" className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <Coins className="size-4 shrink-0 text-brand-500" />
        <span>Lọc theo giá từ câu tìm kiếm:</span>
        <Link href={remove} className={chipClass} aria-label={`Bỏ lọc giá ${result.priceIntent.label}`}>
          {result.priceIntent.label}
          <X className="size-3.5" />
        </Link>
      </li>,
    );
  }

  if (items.length === 0) return null;
  return <ul className="space-y-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-6">{items}</ul>;
}

/** Danh sách câu tìm kiếm phổ biến dạng viên thuốc, dùng ở trang trống và khi không có kết quả */
function PopularSearches() {
  return (
    <div className="mt-6 w-full max-w-2xl">
      <p className="mb-3 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
        <TrendingUp className="size-4 text-brand-500" />
        Tìm kiếm phổ biến
      </p>
      <ul className="flex flex-wrap justify-center gap-2">
        {popularSearches.map((text) => (
          <li key={text}>
            <Link href={searchHref(text)} className={pillClass}>
              {text}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Trang tìm kiếm khi chưa nhập gì: gợi ý cách tìm, câu tìm phổ biến và danh mục */
async function SearchLanding() {
  const categories = await getFeaturedCategories(6);

  return (
    <div className="container-page py-4">
      <Breadcrumb categories={[]} current="Tìm kiếm" />

      <section className="surface-card flex flex-col items-center px-4 py-10 text-center sm:px-8">
        <span className="grid size-16 place-items-center rounded-full bg-brand-50 text-brand-500">
          <Search className="size-8" />
        </span>
        <h1 className="section-title mt-4 text-2xl sm:text-3xl">Bạn muốn tìm gì?</h1>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          Gõ tên sản phẩm, hãng, thông số hoặc cả mức giá vào ô tìm kiếm ở đầu trang.
        </p>

        <PopularSearches />

        <div className="mt-8 w-full max-w-2xl text-left">
          <p className="mb-3 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            <Lightbulb className="size-4 text-gold-500" />
            Mẹo tìm nhanh
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {searchTips.map((tip) => (
              <li key={tip.query}>
                <Link
                  href={searchHref(tip.query)}
                  className="block rounded-xl border border-slate-200 bg-white p-3 transition hover:border-brand-400"
                >
                  <span className="block text-sm font-semibold text-slate-800">“{tip.query}”</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{tip.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="mt-6" aria-label="Danh mục">
          <h2 className="mb-3 font-display text-base font-bold text-slate-900">Hoặc xem theo danh mục</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/danh-muc/${category.slug}`}
                  className="surface-card flex h-full flex-col items-center gap-2 p-4 text-center transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <CategoryIcon name={category.icon} className="size-7 text-brand-500" strokeWidth={1.8} />
                  <span className="text-sm font-semibold text-slate-800">{category.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** API không trả lời: nói thật thay vì hiện "không có sản phẩm" như thể đã tìm mà không thấy */
function SearchUnavailable({ query }: { query: SearchQuery }) {
  const retry = `/tim-kiem?${toSearchPageParams(query).toString()}`;

  return (
    <div className="container-page py-4">
      <Breadcrumb categories={[]} current="Tìm kiếm" />
      <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-slate-100 text-slate-400">
          <WifiOff className="size-8" />
        </span>
        <h1 className="mt-4 text-lg font-bold text-slate-800">Chưa tìm kiếm được lúc này</h1>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">
          Không kết nối được máy chủ. Bạn thử lại sau ít phút, hoặc xem sản phẩm theo danh mục trong lúc chờ.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={retry} className="rounded-xl bg-brand-500 px-6 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600">
            Thử lại
          </Link>
          <Link href="/danh-muc" className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-xs font-bold uppercase tracking-wide text-slate-700 transition hover:border-brand-400">
            Xem danh mục
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Kết quả tìm kiếm ngữ nghĩa bằng AI — đơn giản hơn hẳn kết quả tìm từ khoá: không facets/phân trang
 * (CategoryShell không hợp với một danh sách top-K theo độ liên quan ngữ nghĩa, khác việc duyệt toàn
 * bộ danh mục), chỉ một lưới sản phẩm kèm dấu hiệu "gợi ý bởi AI".
 */
function AiSearchResults({ result, query }: { result: AiSearchResult; query: SearchQuery }) {
  return (
    <div className="container-page py-4">
      <Breadcrumb categories={[]} current="Tìm kiếm" />

      <header className="surface-card overflow-hidden">
        <div className="flex items-center gap-4 p-4 sm:p-6">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-50">
            <Sparkles className="size-7 text-brand-500" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h1 className="section-title wrap-break-word text-2xl sm:text-3xl">Kết quả AI cho “{result.query}”</h1>
            <p className="mt-1 text-sm text-slate-500">{result.items.length} sản phẩm gợi ý bởi AI</p>
          </div>
        </div>

        {result.priceIntent ? (
          <ul className="space-y-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-6">
            <li className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <Coins className="size-4 shrink-0 text-brand-500" />
              <span>Lọc theo giá từ câu hỏi: {result.priceIntent.label}</span>
            </li>
          </ul>
        ) : null}
      </header>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {result.items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        Muốn tìm theo cách thường?{" "}
        <Link href={searchHref(query.q)} className="font-bold text-brand-600 hover:underline">
          Xem kết quả tìm theo từ khoá
        </Link>
      </p>
    </div>
  );
}

export default async function SearchPage({ searchParams }: PageProps) {
  const rawParams = await searchParams;
  const query = parseSearchQuery(rawParams);

  if (!query.q) return <SearchLanding />;

  // Bấm nút "AI Search" ở header đi qua đây — thử tìm ngữ nghĩa trước, không được (chưa cấu hình AI
  // hoặc không có kết quả đủ liên quan) thì lặng lẽ rơi xuống tìm kiếm từ khoá bên dưới, không báo lỗi
  if (rawParams.mode === "ai") {
    const aiResult = await aiSearchProducts(query.q);
    if (aiResult?.usedAi && aiResult.items.length > 0) {
      return <AiSearchResults result={aiResult} query={query} />;
    }
  }

  const result = await searchProducts(query, SEARCH_PAGE_SIZE);
  if (!result) return <SearchUnavailable query={query} />;

  const pathname = "/tim-kiem";

  // Địa chỉ cũ còn nhớ trang 9 nhưng câu tìm / bộ lọc mới chỉ còn 2 trang: về trang cuối thay vì hiện trang trống
  if (query.page > result.totalPages && result.total > 0) {
    const params = toSearchPageParams(query);
    if (result.totalPages > 1) params.set("page", String(result.totalPages));
    redirect(`${pathname}?${params.toString()}`);
  }

  const filtered = countActiveFilters(query) > 0 || query.category !== undefined;

  return (
    <div className="container-page py-4">
      <Breadcrumb categories={[]} current="Tìm kiếm" />

      <header className="surface-card overflow-hidden">
        <div className="flex items-center gap-4 p-4 sm:p-6">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-50">
            <Search className="size-7 text-brand-500" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h1 className="section-title wrap-break-word text-2xl sm:text-3xl">Kết quả cho “{query.q}”</h1>
            <p className="mt-1 text-sm text-slate-500">
              {result.total > 0 ? `${result.total} sản phẩm chính hãng` : "Không có sản phẩm nào"}
            </p>
          </div>
        </div>
        <Notices result={result} query={query} />
      </header>

      <CategoryShell
        brands={result.facets.brands}
        priceRange={result.facets.priceRange}
        total={result.total}
        sortOptions={SEARCH_SORT_OPTIONS}
        defaultSort={DEFAULT_SEARCH_SORT}
        categories={result.facets.categories}
      >
        {result.items.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {result.items.map((product) => (
                <ProductCard key={product.id} product={product} highlight={result.terms} />
              ))}
            </div>
            <Pagination page={result.page} totalPages={result.totalPages} pathname={pathname} params={toSearchPageParams(query)} />
          </>
        ) : (
          <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-slate-100 text-slate-400">
              <SearchX className="size-8" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-slate-800">
              {filtered ? "Không có sản phẩm phù hợp bộ lọc" : `Không tìm thấy sản phẩm nào cho “${query.q}”`}
            </h2>
            <p className="mt-1.5 max-w-md text-sm text-slate-500">
              {filtered
                ? "Thử bỏ bớt bộ lọc hoặc mở rộng khoảng giá để xem thêm sản phẩm."
                : "Hãy kiểm tra chính tả, thử từ khoá ngắn hơn hoặc chỉ gõ tên hãng, loại sản phẩm (vd: “laptop asus”, “chuột logitech”)."}
            </p>
            <Link
              href={filtered ? `${pathname}?${new URLSearchParams({ q: query.q }).toString()}` : "/danh-muc"}
              className="mt-6 rounded-xl bg-brand-500 px-6 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
            >
              {filtered ? "Xóa bộ lọc" : "Xem danh mục"}
            </Link>
            {filtered ? null : <PopularSearches />}
          </div>
        )}
      </CategoryShell>
    </div>
  );
}
