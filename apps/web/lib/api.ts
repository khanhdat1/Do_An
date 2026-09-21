import type { Category, CategoryDetail, Paginated, Product, ProductDetail } from "@/types";
import {
  bestSellerProducts,
  featuredProducts,
  flashSaleProducts,
} from "@/lib/data/products";
import { featuredCategories } from "@/lib/data/categories";

/**
 * Lớp gọi Express API.
 *
 * Nguyên tắc: nếu API chưa chạy (chưa `npm run dev:api`, MySQL chưa lên...),
 * trang vẫn render được bằng dữ liệu mẫu trong `lib/data/`. Nhờ vậy có thể
 * làm giao diện độc lập với backend, và lúc demo không bị trang trắng.
 * Mọi lần rơi về dữ liệu mẫu đều in cảnh báo ở terminal.
 */

/** Server Component dùng API_URL; code chạy ở trình duyệt dùng NEXT_PUBLIC_API_URL */
const API_BASE =
  (typeof window === "undefined"
    ? process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL
    : process.env.NEXT_PUBLIC_API_URL) ?? "http://localhost:4000";

/** Thời gian cache ISR (giây). 0 = luôn lấy mới. */
const REVALIDATE_SECONDS = 60;

let warnedOffline = false;

function warnOffline(path: string, error: unknown) {
  if (!warnedOffline) {
    console.warn(
      `\n[PCZone] Không gọi được API (${API_BASE}${path}). ` +
        `Đang dùng dữ liệu mẫu trong lib/data/.\n` +
        `Chạy "npm run dev:api" ở thư mục gốc để bật API thật.\n` +
        `Chi tiết: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    warnedOffline = true;
  }
}

async function apiGet<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    warnOffline(path, error);
    return fallback;
  }
}

/* -------------------------------------------------------------------------- */
/*  Sản phẩm                                                                  */
/* -------------------------------------------------------------------------- */

type ProductListResponse = Paginated<Product>;

/** Sản phẩm đang Flash Sale */
export async function getFlashSaleProducts(limit = 5): Promise<Product[]> {
  const data = await apiGet<ProductListResponse>(
    `/api/products?flashSale=true&pageSize=${limit}`,
    { items: flashSaleProducts, page: 1, pageSize: limit, total: 0, totalPages: 1 },
  );
  return data.items;
}

/** Sản phẩm nổi bật (có tab lọc ở trang chủ) */
export async function getFeaturedProducts(limit = 10): Promise<Product[]> {
  const data = await apiGet<ProductListResponse>(
    `/api/products?featured=true&pageSize=${limit}`,
    { items: featuredProducts, page: 1, pageSize: limit, total: 0, totalPages: 1 },
  );
  return data.items;
}

/** Top bán chạy trong tuần */
export async function getBestSellers(limit = 4): Promise<Product[]> {
  const data = await apiGet<{ items: Product[] }>(
    `/api/products/best-sellers?limit=${limit}`,
    { items: bestSellerProducts },
  );
  return data.items;
}

export interface ProductQuery {
  category?: string;
  /** Slug hãng; nhiều hãng cách nhau dấu phẩy: "asus,msi" */
  brand?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  /** true = chỉ sản phẩm còn hàng */
  inStock?: boolean;
  sort?: "newest" | "price-asc" | "price-desc" | "best-selling" | "rating";
  page?: number;
  pageSize?: number;
}

/** Danh sách sản phẩm có lọc + phân trang — dùng cho trang danh mục */
export async function getProducts(
  query: ProductQuery = {},
): Promise<Paginated<Product>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }

  return apiGet<ProductListResponse>(`/api/products?${params.toString()}`, {
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
}

/**
 * Dựng bản chi tiết tối thiểu từ dữ liệu dự phòng của trang chủ, để bấm vào thẻ
 * sản phẩm khi API tắt vẫn ra được trang thay vì 404. Thiếu ảnh, thông số, mô tả.
 */
function fallbackProductDetail(slug: string): ProductDetail | null {
  const product = [...flashSaleProducts, ...featuredProducts, ...bestSellerProducts].find(
    (item) => item.slug === slug,
  );
  if (!product) return null;

  return {
    ...product,
    sku: "",
    images: [],
    highlights: product.specs,
    specifications: [],
    maxQuantity: 10,
    // Dữ liệu dự phòng chỉ biết tên của các danh mục lá ở lưới trang chủ
    breadcrumb: product.categoryPath.flatMap((categorySlug) => {
      const category = featuredCategories.find((item) => item.slug === categorySlug);
      return category ? [{ slug: category.slug, name: category.name }] : [];
    }),
  };
}

/**
 * Chi tiết một sản phẩm. Trả về `null` khi API xác nhận không có sản phẩm này
 * (trang hiện 404); nếu API không trả lời được thì rơi về dữ liệu dự phòng.
 */
export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const path = `/api/products/${encodeURIComponent(slug)}`;

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { Accept: "application/json" },
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return (await response.json()) as ProductDetail;
  } catch (error) {
    warnOffline(path, error);
    return fallbackProductDetail(slug);
  }
}

/**
 * Sản phẩm liên quan: cùng danh mục (bán chạy trước). Chưa đủ thì bù bằng danh
 * mục cha — ví dụ CPU chỉ có 2 sản phẩm thì lấy thêm từ "Linh kiện".
 */
export async function getRelatedProducts(
  product: ProductDetail,
  limit = 4,
): Promise<Product[]> {
  const seen = new Set([product.id]);
  const related: Product[] = [];

  // categoryPath đi từ gốc tới lá; duyệt ngược để ưu tiên danh mục gần nhất
  for (const category of [...product.categoryPath].reverse()) {
    if (related.length >= limit) break;

    const page = await getProducts({
      category,
      sort: "best-selling",
      pageSize: limit + 1,
    });

    for (const item of page.items) {
      if (related.length >= limit) break;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      related.push(item);
    }
  }

  return related;
}

/* -------------------------------------------------------------------------- */
/*  Danh mục                                                                  */
/* -------------------------------------------------------------------------- */

/** 6 danh mục ở lưới trang chủ */
export async function getFeaturedCategories(limit = 6): Promise<Category[]> {
  const data = await apiGet<{ items: Category[] }>(
    `/api/categories/featured?limit=${limit}`,
    { items: featuredCategories },
  );
  return data.items;
}

/**
 * Chi tiết một danh mục cho trang danh mục: đường dẫn, danh mục con, hãng và khoảng giá.
 * Trả về `null` khi API xác nhận không có danh mục này (trang hiện 404); nếu API không trả lời
 * được thì rơi về dữ liệu dự phòng của lưới trang chủ để trang vẫn dựng được khung.
 */
export async function getCategory(slug: string): Promise<CategoryDetail | null> {
  const path = `/api/categories/${encodeURIComponent(slug)}`;

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { Accept: "application/json" },
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return (await response.json()) as CategoryDetail;
  } catch (error) {
    warnOffline(path, error);

    const fallback = featuredCategories.find((category) => category.slug === slug);
    if (!fallback) return null;

    return {
      slug: fallback.slug,
      name: fallback.name,
      icon: fallback.icon,
      breadcrumb: [{ slug: fallback.slug, name: fallback.name }],
      children: [],
      productCount: 0,
      brands: [],
      priceRange: null,
    };
  }
}

/** Cây danh mục đầy đủ */
export async function getCategories(): Promise<Category[]> {
  const data = await apiGet<{ items: Category[] }>("/api/categories", {
    items: featuredCategories,
  });
  return data.items;
}
