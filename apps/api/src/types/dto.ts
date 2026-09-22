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

/* -------------------------------------------------------------------------- */
/*  Tìm kiếm                                                                  */
/* -------------------------------------------------------------------------- */

/** Một danh mục ở bộ lọc của trang tìm kiếm, kèm số kết quả nằm trong danh mục đó */
export interface CategoryFacetDto {
  slug: string;
  name: string;
  count: number;
}

/**
 * `GET /api/search` — kết quả tìm kiếm + mọi thứ trang kết quả cần ngoài danh sách sản phẩm:
 * cách API hiểu câu tìm kiếm (từ khoá đã dùng, lỗi gõ đã sửa, từ bị bỏ, cụm giá) và các thành phần của bộ lọc.
 */
export interface SearchResultDto extends Paginated<ProductDto> {
  /** Câu tìm kiếm người dùng gửi (đã cắt khoảng trắng đầu cuối) */
  query: string;
  /** Từ khoá thực sự dùng để khớp (không dấu, đã sửa lỗi gõ, đã bỏ từ không sản phẩm nào chứa) — dùng để tô sáng */
  terms: string[];
  /** Từ gõ sai đã được tự sửa: "razr" → "razer" */
  corrections: { from: string; to: string }[];
  /** Từ bị bỏ qua vì không sản phẩm nào chứa */
  ignoredTerms: string[];
  /** true = không sản phẩm nào chứa đủ mọi từ khoá; danh sách là các sản phẩm khớp nhiều từ nhất */
  relaxed: boolean;
  /** Bộ lọc giá suy ra từ câu tìm kiếm ("dưới 30 triệu"); không có khi người dùng đã tự chọn khoảng giá */
  priceIntent?: {
    label: string;
    minPrice?: number;
    maxPrice?: number;
    /** Câu tìm kiếm khi bỏ cụm giá đi — để dựng nút "bỏ lọc giá" */
    queryWithoutPrice: string;
  };
  facets: {
    categories: CategoryFacetDto[];
    brands: BrandFacetDto[];
    priceRange: { min: number; max: number } | null;
  };
}

/** Một sản phẩm trong hộp gợi ý khi gõ ở ô tìm kiếm (gọn hơn ProductDto) */
export interface SuggestProductDto {
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
export interface SearchSuggestDto {
  query: string;
  /** Tổng số sản phẩm khớp (không chỉ các sản phẩm được liệt kê) */
  total: number;
  /** Từ khoá thực sự dùng để khớp (không dấu, đã sửa lỗi gõ) — giao diện dùng để tô sáng tên sản phẩm */
  terms: string[];
  products: SuggestProductDto[];
  /** Danh mục có tên khớp câu đang gõ: "ghe" → Ghế */
  categories: { slug: string; name: string; count: number }[];
  brands: { slug: string; name: string; count: number }[];
}

/* -------------------------------------------------------------------------- */
/*  Sổ địa chỉ                                                                */
/* -------------------------------------------------------------------------- */

export interface AddressDto {
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

/* -------------------------------------------------------------------------- */
/*  Đặt hàng & thanh toán                                                     */
/* -------------------------------------------------------------------------- */

export type OrderStatusDto =
  | "PENDING"
  | "CONFIRMED"
  | "PACKING"
  | "SHIPPING"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

export type PaymentMethodDto = "COD" | "VNPAY" | "BANK_TRANSFER" | "MOMO";
export type PaymentStatusDto = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "CANCELLED";

export interface OrderItemDto {
  id: string;
  /** Có khi sản phẩm còn tồn tại — dùng để dẫn link; sản phẩm đã bị xoá hẳn thì không có */
  productSlug?: string;
  name: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

/** Một lần chuyển trạng thái — dựng dòng thời gian ở trang chi tiết đơn */
export interface OrderStatusEventDto {
  status: OrderStatusDto;
  note?: string;
  createdAt: string;
}

export interface OrderShippingAddressDto {
  recipientName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  streetAddress: string;
}

/** `GET /api/orders/:code` và kết quả của `POST /api/orders` */
export interface OrderDto {
  orderCode: string;
  status: OrderStatusDto;
  subtotal: number;
  discountAmount: number;
  /** Mã đã dùng để có `discountAmount` — không có nghĩa là chưa áp mã nào */
  voucherCode?: string;
  shippingFee: number;
  totalAmount: number;
  paymentMethod: PaymentMethodDto;
  paymentStatus: PaymentStatusDto;
  /** Có khi paymentMethod = BANK_TRANSFER và đã cấu hình đủ — QR đã điền sẵn số tiền + mã đơn */
  bankTransfer?: { qrUrl: string; bankName: string; accountNumber: string; accountName: string };
  /** Có khi paymentMethod = MOMO và đã cấu hình đủ */
  momo?: { phone: string; displayName: string };
  /** true khi là đơn VNPay chưa thanh toán thành công — trang chi tiết hiện nút "Thanh toán lại" */
  canRetryPayment: boolean;
  /** true khi khách có thể tự huỷ (chưa thanh toán, chưa đóng gói) */
  canCancel: boolean;
  shippingAddress: OrderShippingAddressDto;
  customerNote?: string;
  items: OrderItemDto[];
  /** Từ cũ tới mới */
  statusHistory: OrderStatusEventDto[];
  createdAt: string;
}

/** Dòng gọn cho danh sách đơn hàng của tài khoản */
export interface OrderSummaryDto {
  orderCode: string;
  status: OrderStatusDto;
  paymentMethod: PaymentMethodDto;
  paymentStatus: PaymentStatusDto;
  totalAmount: number;
  itemCount: number;
  /** Ảnh + tên vài sản phẩm đầu, đủ để vẽ thumbnail trong danh sách */
  previewItems: { name: string; image?: string }[];
  createdAt: string;
}

export interface CreateOrderResultDto {
  order: OrderDto;
  /** Có khi chọn VNPay và đã cấu hình: trình duyệt chuyển sang đây để thanh toán */
  payUrl?: string;
}

/** `GET /api/payments/methods` — phương thức nào đang dùng được, để trang đặt hàng ẩn/khoá phương thức chưa cấu hình */
export interface PaymentMethodsDto {
  cod: boolean;
  vnpay: boolean;
  bankTransfer: boolean;
  momo: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Quản trị đơn hàng (xác nhận thanh toán thủ công)                          */
/* -------------------------------------------------------------------------- */

/** Dòng gọn cho `GET /api/admin/orders` — thêm tên/SĐT người nhận so với `OrderSummaryDto` để nhân viên đối chiếu tiền vào */
export interface AdminOrderSummaryDto {
  orderCode: string;
  status: OrderStatusDto;
  paymentMethod: PaymentMethodDto;
  paymentStatus: PaymentStatusDto;
  totalAmount: number;
  recipientName: string;
  recipientPhone: string;
  itemCount: number;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Mã giảm giá                                                               */
/* -------------------------------------------------------------------------- */

export type DiscountTypeDto = "PERCENT" | "FIXED";

/** Mã công khai (không gắn với riêng ai) — `GET /api/vouchers` liệt kê các mã đang áp dụng được */
export interface VoucherDto {
  code: string;
  name: string;
  description?: string;
  discountType: DiscountTypeDto;
  /** % nếu PERCENT (vd 10 nghĩa là 10%), VNĐ nếu FIXED */
  discountValue: number;
  /** Trần số tiền giảm — chỉ có ý nghĩa khi discountType = PERCENT */
  maxDiscount?: number;
  minOrderAmount?: number;
  endsAt: string;
}

/** `GET /api/vouchers/preview?code=&subtotal=` — xem trước số tiền được giảm trước khi đặt hàng */
export interface VoucherPreviewResultDto {
  voucher: VoucherDto;
  discountAmount: number;
}

/* -------------------------------------------------------------------------- */
/*  Đánh giá sản phẩm                                                         */
/* -------------------------------------------------------------------------- */

/** Một đánh giá đã được duyệt — `GET /api/products/:slug/reviews` */
export interface ReviewDto {
  id: string;
  rating: number;
  title?: string;
  content?: string;
  images?: string[];
  /** true vì mọi đánh giá đều gắn với một đơn đã thanh toán — xem `review.service.ts` */
  isVerified: boolean;
  reviewerName: string;
  reviewerAvatarUrl?: string;
  adminReply?: string;
  adminRepliedAt?: string;
  createdAt: string;
}

/** `GET /api/products/:slug/reviews/eligibility` — có được viết đánh giá mới không, để trang sản phẩm ẩn/hiện form đúng lúc */
export interface ReviewEligibilityDto {
  /** true khi đã mua (đơn paymentStatus=PAID chứa sản phẩm này) và còn ít nhất một đơn chưa dùng để đánh giá */
  canReview: boolean;
  /** true khi đã có ít nhất một đánh giá (đã duyệt hay chưa đều tính) — vẫn có thể canReview=true nếu mua nhiều đơn */
  hasReviewed: boolean;
}

/** Dòng cho `GET /api/admin/reviews` — nhân viên duyệt/xoá/trả lời đánh giá */
export interface AdminReviewSummaryDto {
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
