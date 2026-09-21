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

/** Một mắt xích trên đường dẫn danh mục: Linh kiện > VGA */
export interface Breadcrumb {
  slug: string;
  name: string;
}

export interface ProductImage {
  url: string;
  alt: string;
}

/** Một dòng trong bảng thông số kỹ thuật */
export interface SpecRow {
  label: string;
  value: string;
}

/** Dữ liệu trang chi tiết = thẻ sản phẩm + phần chỉ trang chi tiết mới cần */
export interface ProductDetail extends Product {
  sku: string;
  /** Ảnh cho gallery, ảnh chính đứng đầu. Rỗng thì hiện placeholder. */
  images: ProductImage[];
  /** Toàn bộ dòng thông tin nổi bật (`specs` của Product chỉ có tối đa 3) */
  highlights: string[];
  /** Văn bản thuần, các đoạn cách nhau bằng dòng trống */
  description?: string;
  specifications: SpecRow[];
  warrantyMonths?: number;
  /** Số lượng tối đa chọn được trong một lần đặt (đã tính tồn kho) */
  maxQuantity: number;
  breadcrumb: Breadcrumb[];
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

/** Một hãng ở bộ lọc của trang danh mục, kèm số sản phẩm của hãng trong danh mục đó */
export interface BrandFacet {
  slug: string;
  name: string;
  count: number;
}

/** Danh mục con hiện thành ô chọn nhanh ở đầu trang danh mục */
export interface CategoryLink {
  slug: string;
  name: string;
  icon: string;
  /** Đã gồm các nhánh con của chính nó */
  productCount: number;
}

/** `GET /api/categories/:slug` — mọi thứ trang danh mục cần ngoài danh sách sản phẩm */
export interface CategoryDetail {
  slug: string;
  name: string;
  icon: string;
  /** Từ gốc tới chính danh mục này (chưa gồm "Trang chủ") */
  breadcrumb: Breadcrumb[];
  children: CategoryLink[];
  /** Số sản phẩm đang bán trong cả nhánh, chưa áp bộ lọc */
  productCount: number;
  brands: BrandFacet[];
  /** null khi danh mục chưa có sản phẩm nào */
  priceRange: { min: number; max: number } | null;
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

/* -------------------------------------------------------------------------- */
/*  Xác thực                                                                  */
/* -------------------------------------------------------------------------- */

export type UserRole = "CUSTOMER" | "STAFF" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: string;
}

/** Nhà cung cấp đăng nhập mạng xã hội; trùng `:provider` trên đường dẫn /api/auth/:provider */
export type SocialProvider = "google" | "facebook";

/** Một tài khoản mạng xã hội đã liên kết với người dùng hiện tại (GET /api/auth/providers) */
export interface LinkedProvider {
  provider: SocialProvider;
  /** Email nhà cung cấp trả về lúc liên kết; có thể khác email đăng nhập PCZone */
  email?: string;
  linkedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Giỏ hàng                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Vấn đề của một dòng trong giỏ:
 * - UNAVAILABLE: sản phẩm đã ngừng bán / bị ẩn
 * - OUT_OF_STOCK: hết hàng
 * - INSUFFICIENT_STOCK: số lượng trong giỏ vượt quá số còn bán được
 */
export type CartItemIssue = "UNAVAILABLE" | "OUT_OF_STOCK" | "INSUFFICIENT_STOCK";

export interface CartItem {
  /** Id dòng giỏ — dùng cho sửa / xoá */
  id: string;
  productId: string;
  slug: string;
  name: string;
  image?: string;
  brand?: string;
  categoryPath: string[];
  /** Giá bán hiện tại; tổng tiền luôn tính theo giá này */
  unitPrice: number;
  oldPrice?: number;
  /** Giá lúc khách thêm vào giỏ */
  priceAtAdd: number;
  priceChanged: boolean;
  quantity: number;
  /** Số lượng tối đa chọn được cho dòng này (0 nếu không mua được) */
  maxQuantity: number;
  lineTotal: number;
  issue?: CartItemIssue;
}

export interface Cart {
  items: CartItem[];
  /** Tổng số lượng của mọi dòng — con số trên biểu tượng giỏ hàng */
  itemCount: number;
  subtotal: number;
  /** true khi còn dòng có `issue` — phải xử lý xong mới đặt hàng được */
  hasBlockingIssues: boolean;
}
