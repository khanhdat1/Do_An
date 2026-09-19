/**
 * DTO trả về cho frontend.
 *
 * Quan trọng: shape ở đây khớp 1-1 với `Product` / `Category` trong
 * `apps/web/types/index.ts`. Giữ hai bên đồng bộ thì component hiển thị
 * không phải sửa khi đổi nguồn dữ liệu.
 *
 * Ở đây KHÔNG trả về: costPrice (giá vốn), inventoryQuantity tuyệt đối,
 * aiSearchText... vì đó là dữ liệu nội bộ.
 */

export type Tone = "amber" | "green" | "blue" | "red" | "slate";

export interface ProductTagDto {
  label: string;
  tone?: Tone;
}

export interface StockInfoDto {
  sold: number;
  total: number;
  note: string;
  urgent?: boolean;
}

export interface ProductDto {
  id: string;
  slug: string;
  name: string;
  summary?: string;
  specs: string[];
  price: number;
  oldPrice?: number;
  rating: number;
  reviewCount: number;
  image?: string;
  /** Slug danh mục lá, ví dụ "laptop-gaming" */
  categorySlug: string;
  categoryName: string;
  /** Đường dẫn danh mục từ gốc tới lá: ["linh-kien","vga"] — dùng để lọc tab */
  categoryPath: string[];
  brand?: string;
  tag?: ProductTagDto;
  gift?: string;
  stock?: StockInfoDto;
  inStock: boolean;
}

export interface CategoryDto {
  slug: string;
  name: string;
  caption: string;
  icon: string;
  productCount: number;
  children?: CategoryDto[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
