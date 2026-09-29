import type { MetadataRoute } from "next";
import { getCategories, getProducts } from "@/lib/api";
import { POLICY_PAGES } from "@/lib/data/policies";
import { siteUrl } from "@/lib/site-url";
import type { Category } from "@/types";

// Dựng lúc có người (hoặc công cụ tìm kiếm) hỏi: lúc build chưa có API nên bản dựng sẵn sẽ thiếu hết sản phẩm. Mỗi
// lần dựng chỉ vài lời gọi API, và các lời gọi đó vẫn dùng bộ nhớ đệm 60 giây của lib/api.ts
export const dynamic = "force-dynamic";

/** Trang công khai cố định — trang riêng của từng khách (giỏ hàng, tài khoản...) không đưa vào (xem robots.ts) */
const STATIC_PATHS = [
  "/",
  "/danh-muc",
  "/khuyen-mai",
  "/ai-build-pc",
  "/tro-ly-ai",
  "/tra-cuu-don-hang",
  ...POLICY_PAGES.map((page) => page.href),
];

/** Chặn trên số trang sản phẩm đọc (60 sản phẩm/trang) — phòng API trả totalPages bất thường làm vòng lặp quá dài */
const MAX_PRODUCT_PAGES = 100;

function categorySlugs(categories: Category[]): string[] {
  return categories.flatMap((category) => [category.slug, ...categorySlugs(category.children ?? [])]);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const productSlugs: string[] = [];
  for (let page = 1; page <= MAX_PRODUCT_PAGES; page++) {
    const result = await getProducts({ page, pageSize: 60 });
    productSlugs.push(...result.items.map((product) => product.slug));
    if (page >= result.totalPages || result.items.length === 0) break;
  }

  const paths = [
    ...STATIC_PATHS,
    ...categorySlugs(await getCategories()).map((slug) => `/danh-muc/${slug}`),
    ...productSlugs.map((slug) => `/san-pham/${slug}`),
  ];
  return [...new Set(paths)].map((path) => ({ url: `${base}${path}` }));
}
