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

/** Một mắt xích trên đường dẫn danh mục: Linh kiện > VGA */
export interface BreadcrumbDto {
  slug: string;
  name: string;
}

export interface ProductImageDto {
  url: string;
  alt: string;
}

/** Một dòng trong bảng thông số kỹ thuật, giữ đúng thứ tự hiển thị */
export interface SpecRowDto {
  label: string;
  value: string;
}

/**
 * Chi tiết sản phẩm = thẻ sản phẩm + phần chỉ trang chi tiết mới cần.
 * `GET /api/products/:slug` trả kiểu này (mở rộng của ProductDto, nên các
 * component dùng ProductDto vẫn nhận được).
 */
export interface ProductDetailDto extends ProductDto {
  sku: string;
  /** Ảnh đã lọc bỏ ảnh needsReview, ảnh chính đứng đầu */
  images: ProductImageDto[];
  /** Toàn bộ dòng thông tin nổi bật (`specs` của ProductDto chỉ lấy 3 dòng đầu) */
  highlights: string[];
  description?: string;
  specifications: SpecRowDto[];
  warrantyMonths?: number;
  /**
   * Số lượng tối đa khách chọn được trong một lần đặt = min(tồn kho khả dụng, trần mỗi dòng).
   * Không trả tồn kho tuyệt đối ra ngoài, nhưng ô chọn số lượng vẫn cần biết giới hạn.
   */
  maxQuantity: number;
  breadcrumb: BreadcrumbDto[];
}

export interface CategoryDto {
  slug: string;
  name: string;
  caption: string;
  icon: string;
  productCount: number;
  children?: CategoryDto[];
}

/** Một hãng ở bộ lọc của trang danh mục, kèm số sản phẩm của hãng trong danh mục đó */
export interface BrandFacetDto {
  slug: string;
  name: string;
  count: number;
}

/** Danh mục con hiện thành ô chọn nhanh ở đầu trang danh mục */
export interface CategoryLinkDto {
  slug: string;
  name: string;
  icon: string;
  /** Tính cả các nhánh con của chính nó */
  productCount: number;
}

/**
 * `GET /api/categories/:slug` — mọi thứ trang danh mục cần ngoài danh sách sản phẩm:
 * đường dẫn, danh mục con, và các giá trị để dựng bộ lọc (hãng, khoảng giá).
 * Số liệu tính trên toàn bộ nhánh danh mục, chưa áp bộ lọc nào.
 */
export interface CategoryDetailDto {
  slug: string;
  name: string;
  icon: string;
  /** Từ gốc tới chính danh mục này (chưa gồm "Trang chủ") */
  breadcrumb: BreadcrumbDto[];
  children: CategoryLinkDto[];
  /** Số sản phẩm đang bán trong cả nhánh */
  productCount: number;
  brands: BrandFacetDto[];
  /** null khi danh mục chưa có sản phẩm nào */
  priceRange: { min: number; max: number } | null;
}

/* -------------------------------------------------------------------------- */
/*  Xác thực                                                                  */
/* -------------------------------------------------------------------------- */

export type UserRoleDto = "CUSTOMER" | "STAFF" | "ADMIN";

/** Thông tin người dùng trả cho frontend. Tuyệt đối không có passwordHash. */
export interface AuthUserDto {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRoleDto;
  createdAt: string;
}

/** Một tài khoản Google / Facebook đã liên kết với người dùng (GET /api/auth/providers) */
export interface LinkedProviderDto {
  /** Trùng `:provider` trên đường dẫn /api/auth/:provider */
  provider: "google" | "facebook";
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

export interface CartItemDto {
  /** Id dòng giỏ (CartItem.id) — dùng cho PATCH / DELETE */
  id: string;
  productId: string;
  slug: string;
  name: string;
  image?: string;
  brand?: string;
  categoryPath: string[];
  /** Giá bán HIỆN TẠI. Tổng tiền luôn tính theo giá này, không theo priceAtAdd. */
  unitPrice: number;
  oldPrice?: number;
  /** Giá lúc khách thêm vào giỏ */
  priceAtAdd: number;
  /** true khi giá hiện tại khác giá lúc thêm — để hiện cảnh báo "đã đổi giá" */
  priceChanged: boolean;
  quantity: number;
  /** Số lượng tối đa chọn được cho dòng này (0 nếu không mua được) */
  maxQuantity: number;
  lineTotal: number;
  issue?: CartItemIssue;
}

export interface CartDto {
  items: CartItemDto[];
  /** Tổng số lượng của mọi dòng — con số hiện trên biểu tượng giỏ hàng */
  itemCount: number;
  /** Tổng tiền hàng của các dòng còn bán được */
  subtotal: number;
  /** true khi còn dòng có `issue` — phải xử lý xong mới cho đặt hàng */
  hasBlockingIssues: boolean;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
