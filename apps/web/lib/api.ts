import type { Category, Paginated, Product } from "@/types";
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
  brand?: string;
  search?: string;
  sort?: "newest" | "price-asc" | "price-desc" | "best-selling" | "rating";
  page?: number;
  pageSize?: number;
}

/** Danh sách sản phẩm có lọc + phân trang — dùng cho trang danh mục sau này */
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

/** Chi tiết một sản phẩm */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    const response = await fetch(`${API_BASE}/api/products/${slug}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;
    return (await response.json()) as Product;
  } catch (error) {
    warnOffline(`/api/products/${slug}`, error);
    return null;
  }
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

/** Cây danh mục đầy đủ */
export async function getCategories(): Promise<Category[]> {
  const data = await apiGet<{ items: Category[] }>("/api/categories", {
    items: featuredCategories,
  });
  return data.items;
}
