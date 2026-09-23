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
/*  Tìm kiếm                                                                  */
/* -------------------------------------------------------------------------- */

/** Một danh mục ở bộ lọc của trang tìm kiếm, kèm số kết quả nằm trong danh mục đó */
export interface CategoryFacet {
  slug: string;
  name: string;
  count: number;
}

/**
 * `GET /api/search` — kết quả tìm kiếm và cách API đã hiểu câu tìm kiếm (từ khoá đã dùng, lỗi gõ đã sửa,
 * từ bị bỏ qua, cụm giá) cùng các thành phần của bộ lọc.
 */
export interface SearchResult extends Paginated<Product> {
  query: string;
  /** Từ khoá thực sự dùng để khớp (không dấu, đã sửa lỗi gõ) — dùng để tô sáng */
  terms: string[];
  /** Từ gõ sai đã được tự sửa: "razr" → "razer" */
  corrections: { from: string; to: string }[];
  /** Từ bị bỏ qua vì không sản phẩm nào chứa */
  ignoredTerms: string[];
  /** true = không sản phẩm nào chứa đủ mọi từ khoá, đây là các sản phẩm khớp nhiều từ nhất */
  relaxed: boolean;
  /** Bộ lọc giá suy ra từ câu tìm kiếm ("dưới 30 triệu") */
  priceIntent?: {
    label: string;
    minPrice?: number;
    maxPrice?: number;
    /** Câu tìm kiếm khi bỏ cụm giá đi */
    queryWithoutPrice: string;
  };
  facets: {
    categories: CategoryFacet[];
    brands: BrandFacet[];
    priceRange: { min: number; max: number } | null;
  };
}

/** Một sản phẩm trong hộp gợi ý khi gõ ở ô tìm kiếm */
export interface SuggestProduct {
  slug: string;
  name: string;
  price: number;
  oldPrice?: number;
  image?: string;
  categoryName: string;
  brand?: string;
  categoryPath: string[];
  inStock: boolean;
}

/** `GET /api/search/suggest` */
export interface SearchSuggestions {
  query: string;
  /** Tổng số sản phẩm khớp (không chỉ các sản phẩm được liệt kê) */
  total: number;
  /** Từ khoá thực sự dùng để khớp (không dấu, đã sửa lỗi gõ) — dùng để tô sáng */
  terms: string[];
  products: SuggestProduct[];
  categories: CategoryFacet[];
  brands: CategoryFacet[];
}

/* -------------------------------------------------------------------------- */
/*  Xác thực                                                                  */
/* -------------------------------------------------------------------------- */

export type UserRole = "CUSTOMER" | "STAFF" | "ADMIN" | "OWNER" | "MANAGER" | "ORDER_STAFF" | "PRODUCT_STAFF";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Quản trị — đăng nhập/phiên (tách biệt phía khách hàng ở trên)             */
/* -------------------------------------------------------------------------- */

export type Permission =
  | "orders:read"
  | "orders:write"
  | "products:read"
  | "products:write"
  | "customers:read"
  | "customers:write"
  | "reports:read"
  | "settings:write"
  | "admins:manage";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  permissions: Permission[];
  totpEnabled: boolean;
  createdAt: string;
}

export type AdminLoginResult = { status: "ok"; user: AdminUser } | { status: "2fa-required"; pendingToken: string };

export interface TotpSetupResult {
  secret: string;
  qrCodeDataUrl: string;
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

/* -------------------------------------------------------------------------- */
/*  Sổ địa chỉ                                                                */
/* -------------------------------------------------------------------------- */

export interface Address {
  id: string;
  recipientName: string;
  phone: string;
  /** Tỉnh/Thành phố */
  province: string;
  /** Quận/Huyện */
  district: string;
  /** Phường/Xã */
  ward: string;
  streetAddress: string;
  note?: string;
  isDefault: boolean;
}

/** Các trường nhập một địa chỉ mới — dùng cho cả form "Thêm địa chỉ" trong sổ địa chỉ lẫn lúc đặt hàng */
export interface AddressInput {
  recipientName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  streetAddress: string;
  note?: string;
}

/* -------------------------------------------------------------------------- */
/*  Đặt hàng & thanh toán                                                     */
/* -------------------------------------------------------------------------- */

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PACKING"
  | "SHIPPING"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

export type PaymentMethod = "COD" | "VNPAY" | "BANK_TRANSFER" | "MOMO";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "CANCELLED";

export interface OrderItem {
  id: string;
  /** Có khi sản phẩm còn tồn tại — dùng để dẫn link; sản phẩm đã bị xoá hẳn thì không có */
  productSlug?: string;
  name: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  note?: string;
  /** Tên nhân viên đã đổi trạng thái này — chỉ có ở trang quản trị */
  changedByName?: string;
  createdAt: string;
}

export interface OrderShippingAddress {
  recipientName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  streetAddress: string;
}

/** `GET /api/orders/:code`, `GET /api/order-lookup` và kết quả của `POST /api/orders` */
export interface Order {
  orderCode: string;
  status: OrderStatus;
  subtotal: number;
  discountAmount: number;
  /** Mã đã dùng để có `discountAmount` — không có nghĩa là chưa áp mã nào */
  voucherCode?: string;
  shippingFee: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** Có khi paymentMethod = BANK_TRANSFER và đã cấu hình đủ — QR đã điền sẵn số tiền + mã đơn */
  bankTransfer?: { qrUrl: string; bankName: string; accountNumber: string; accountName: string };
  /** Có khi paymentMethod = MOMO và đã cấu hình đủ */
  momo?: { phone: string; displayName: string };
  /** true khi là đơn VNPay chưa thanh toán thành công — trang chi tiết hiện nút "Thanh toán lại" */
  canRetryPayment: boolean;
  /** true khi khách có thể tự huỷ (chưa thanh toán, chưa đóng gói) */
  canCancel: boolean;
  shippingAddress: OrderShippingAddress;
  customerNote?: string;
  items: OrderItem[];
  /** Từ cũ tới mới */
  statusHistory: OrderStatusEvent[];
  createdAt: string;
}

/** Dòng gọn cho danh sách đơn hàng của tài khoản */
export interface OrderSummary {
  orderCode: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  itemCount: number;
  previewItems: { name: string; image?: string }[];
  createdAt: string;
}

export interface CreateOrderResult {
  order: Order;
  /** Có khi chọn VNPay và đã cấu hình: trình duyệt chuyển sang đây để thanh toán */
  payUrl?: string;
}

/** `GET /api/payments/methods` — phương thức nào dùng được, để ẩn/khoá phương thức chưa cấu hình */
export interface PaymentMethods {
  cod: boolean;
  vnpay: boolean;
  bankTransfer: boolean;
  momo: boolean;
}

/** Dòng gọn cho `GET /api/admin/orders` — trang quản trị xác nhận thanh toán thủ công */
export interface AdminOrderSummary {
  orderCode: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  recipientName: string;
  recipientPhone: string;
  itemCount: number;
  createdAt: string;
}

/** Một lượt thử thanh toán — nhân viên xem đầy đủ hơn khách hàng */
export interface AdminPaymentRecord {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  transactionNo?: string;
  paidAt?: string;
  refundedAt?: string;
  createdAt: string;
}

/** `GET /api/admin/orders/:code` — đầy đủ hơn `Order`: mã vận đơn, ghi chú nội bộ, lý do huỷ/hoàn, mọi lượt thanh toán */
export interface AdminOrder extends Order {
  trackingNumber?: string;
  internalNote?: string;
  cancelReason?: string;
  returnReason?: string;
  payments: AdminPaymentRecord[];
  /** Trạng thái kế tiếp có thể chuyển tới — rỗng nếu đã ở trạng thái cuối */
  nextStatuses: OrderStatus[];
  /** Nhân viên huỷ được rộng hơn khách tự huỷ (`canCancel`) */
  canAdminCancel: boolean;
  canReturn: boolean;
  /** Đã thu tiền và đơn đã huỷ/hoàn nhưng CHƯA đánh dấu hoàn tiền */
  canMarkRefunded: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Mã giảm giá                                                               */
/* -------------------------------------------------------------------------- */

export type DiscountType = "PERCENT" | "FIXED";

/** Mã công khai — `GET /api/vouchers` liệt kê các mã đang áp dụng được, không phải sổ voucher riêng của ai */
export interface Voucher {
  code: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  /** % nếu PERCENT (vd 10 nghĩa là 10%), VNĐ nếu FIXED */
  discountValue: number;
  /** Trần số tiền giảm — chỉ có ý nghĩa khi discountType = PERCENT */
  maxDiscount?: number;
  minOrderAmount?: number;
  endsAt: string;
}

/** `GET /api/vouchers/preview?code=&subtotal=` */
export interface VoucherPreviewResult {
  voucher: Voucher;
  discountAmount: number;
}

/* -------------------------------------------------------------------------- */
/*  Đánh giá sản phẩm                                                         */
/* -------------------------------------------------------------------------- */

/** Một đánh giá đã được duyệt — `GET /api/products/:slug/reviews` */
export interface Review {
  id: string;
  rating: number;
  title?: string;
  content?: string;
  images?: string[];
  isVerified: boolean;
  reviewerName: string;
  reviewerAvatarUrl?: string;
  adminReply?: string;
  adminRepliedAt?: string;
  createdAt: string;
}

/** `GET /api/products/:slug/reviews/eligibility` */
export interface ReviewEligibility {
  canReview: boolean;
  hasReviewed: boolean;
}

/** Dòng cho `GET /api/admin/reviews` */
export interface AdminReviewSummary {
  id: string;
  productSlug: string;
  productName: string;
  rating: number;
  title?: string;
  content?: string;
  isApproved: boolean;
  isVerified: boolean;
  reviewerName: string;
  adminReply?: string;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Quản trị sản phẩm và kho hàng                                             */
/* -------------------------------------------------------------------------- */

export type ProductStatus = "DRAFT" | "ACTIVE" | "HIDDEN" | "DISCONTINUED";

/** Dòng gọn cho `GET /api/admin/products` */
export interface AdminProductSummary {
  id: string;
  slug: string;
  sku: string;
  name: string;
  image?: string;
  categoryName: string;
  brand?: string;
  status: ProductStatus;
  sellingPrice: number;
  costPrice?: number;
  inventoryQuantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  lowStock: boolean;
  soldCount: number;
  updatedAt: string;
}

/** `GET /api/admin/products/:id` */
export interface AdminProductDetail extends AdminProductSummary {
  categoryId: string;
  brandId?: string;
  originalPrice?: number;
  shortDescription?: string;
  description?: string;
  warrantyMonths?: number;
  specifications: SpecRow[];
  images: ProductImage[];
  createdAt: string;
}

/** Body tạo/sửa sản phẩm */
export interface AdminProductInput {
  name: string;
  sku: string;
  categoryId: string;
  brandId?: string;
  sellingPrice: number;
  costPrice?: number;
  originalPrice?: number;
  shortDescription?: string;
  description?: string;
  warrantyMonths?: number;
  lowStockThreshold?: number;
  specifications?: SpecRow[];
}

/** `GET /api/admin/products/meta/options` — danh mục/hãng phẳng cho ô chọn của form */
export interface ProductFormOptions {
  categories: { id: string; name: string; path: string }[];
  brands: { id: string; name: string }[];
}

export type InventoryTxType = "IMPORT" | "EXPORT" | "ADJUST" | "RETURN";

/** Một dòng lịch sử kho — `GET /api/admin/products/:id/inventory` */
export interface InventoryTransaction {
  id: string;
  type: InventoryTxType;
  quantityChange: number;
  quantityAfter: number;
  unitCost?: number;
  note?: string;
  createdByName?: string;
  orderCode?: string;
  createdAt: string;
}

/** Body `POST /api/admin/products/:id/inventory` */
export type InventoryAdjustmentInput =
  | { type: "IMPORT"; quantity: number; unitCost?: number; note?: string }
  | { type: "EXPORT"; quantity: number; note?: string }
  | { type: "ADJUST"; newQuantity: number; note?: string };
