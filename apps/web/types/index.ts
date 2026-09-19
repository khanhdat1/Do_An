/**
 * Kiểu dữ liệu dùng chung cho toàn bộ frontend PCZone.
 *
 * Shape ở đây khớp 1-1 với DTO mà Express API trả về
 * (xem `apps/api/src/types/dto.ts`). Sửa một bên thì sửa cả bên kia.
 */

/** Tông màu cho badge / nhãn nhỏ trên thẻ sản phẩm */
export type Tone = "amber" | "green" | "blue" | "red" | "slate";

/** Nhãn nhỏ nằm trên ảnh sản phẩm: "Trả góp 0%", "Quà tặng"... */
export interface ProductTag {
  label: string;
  tone?: Tone;
}

/** Thông tin tồn kho hiển thị dạng thanh tiến trình */
export interface StockInfo {
  /** Số lượng đã bán */
  sold: number;
  /** Tổng suất của đợt sale, hoặc tổng tồn + đã bán */
  total: number;
  /** Dòng chữ bên phải: "Gần cháy hàng", "Còn 5 suất"... */
  note: string;
  /** true = hiển thị màu đỏ cảnh báo */
  urgent?: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  /** Mô tả ngắn 1 dòng, hiển thị dưới tên sản phẩm */
  summary?: string;
  /** Các chip thông số: "i9-14900HX", "RTX 4070"... */
  specs: string[];
  /** Giá bán hiện tại (VNĐ) */
  price: number;
  /** Giá gốc, dùng để gạch ngang và tính % giảm */
  oldPrice?: number;
  rating: number;
  reviewCount: number;
  /** URL ảnh chính. Bỏ trống sẽ dùng ảnh placeholder theo danh mục. */
  image?: string;
  /** Slug danh mục lá, ví dụ "laptop-gaming" */
  categorySlug: string;
  categoryName?: string;
  /** Đường dẫn danh mục gốc → lá: ["linh-kien","vga"]. Dùng để lọc tab. */
  categoryPath: string[];
  brand?: string;
  tag?: ProductTag;
  /** Dòng khuyến mãi kèm theo: "Tặng Balo Legion 2.5tr" */
  gift?: string;
  stock?: StockInfo;
  inStock?: boolean;
}

export interface Category {
  slug: string;
  name: string;
  /** Dòng phụ: "Từ 15.000.000đ", "Tối ưu đồ họa"... */
  caption: string;
  /** Tên icon của lucide-react */
  icon: string;
  productCount?: number;
  children?: Category[];
}

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

export interface Brand {
  name: string;
  /** Chữ viết tắt hiển thị trong ô logo khi chưa có file ảnh */
  label: string;
  color: string;
}

/** Kết quả phân trang chung của API */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
