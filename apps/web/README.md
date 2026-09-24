# PCZone – Frontend (Next.js)

Giao diện website thương mại điện tử PCZone: bán PC Gaming, laptop, linh kiện
máy tính, tích hợp trợ lý AI tư vấn cấu hình và AI Build PC.

> Đồ án chuyên ngành – Khanh

## 1. Công nghệ

| Thành phần | Phiên bản |
| ---------- | --------- |
| Next.js (App Router) | 16 |
| React | 19 |
| TypeScript | 5 |
| Tailwind CSS | 4 |
| lucide-react | icon |

## 2. Chạy dự án

```bash
npm install     # cài dependencies (lần đầu)
npm run dev     # chạy môi trường phát triển -> http://localhost:3000
npm run build   # build production
npm run start   # chạy bản production
npm run lint    # kiểm tra ESLint
```

> Máy cần Node.js 20 trở lên.

## 3. Cấu trúc thư mục

```
app/                      # App Router
  layout.tsx              # layout gốc: nạp font, providers, Header, Footer
  page.tsx                # trang chủ, ráp các section theo thứ tự
  globals.css             # design token (màu, font) + class dùng chung
  not-found.tsx           # trang 404
  san-pham/[slug]/        # chi tiết sản phẩm (Server Component, cache ISR 60s)
  danh-muc/               # tổng hợp mọi danh mục
  danh-muc/[slug]/        # danh sách sản phẩm của một danh mục: lọc hãng / giá / còn hàng, sắp xếp, phân trang
                          # (bộ lọc nằm trên URL, xem lib/category-query.ts)
  gio-hang/               # giỏ hàng
  dang-nhap/  dang-ky/    # đăng nhập / đăng ký (?next= để quay lại trang đang xem dở)
  quen-mat-khau/          # nhập email, gửi link đặt lại mật khẩu
  dat-lai-mat-khau/       # đặt mật khẩu mới (?token= từ email)
  xac-minh-email/         # tự xác nhận khi mở (?token= từ email xác minh)
  tai-khoan/              # hồ sơ (xem/sửa), tài khoản liên kết (liên kết/huỷ liên kết), đăng xuất (yêu cầu đăng nhập)
  thanh-toan/             # trang giữ chỗ cho bước đặt hàng (yêu cầu đăng nhập)

components/
  providers/              # ToastProvider, AuthProvider, CartProvider — bọc trong AppProviders
  auth/                   # AuthFrame (khung 2 cột) + AuthAside / AuthTabs / SocialLogin,
                          # LoginForm, RegisterForm, AccountView, useRequireAuth...
  cart/                   # CartView, CartItemRow, CartSummary, BuyNowButton, CheckoutGate
  layout/                 # khung site
    TopBar.tsx            # thanh hotline / showroom (+ TopBarAccount: đăng nhập / xin chào)
    Header.tsx            # logo + ô tìm kiếm AI + giỏ hàng (CartButton) + tài khoản (UserMenu)
    SearchBar.tsx         # ô tìm kiếm có nút AI SEARCH (client component)
    Navbar.tsx            # menu danh mục + AI PC Builder (có menu mobile)
    TrustStrip.tsx        # dải cam kết dịch vụ dưới header
    Logo.tsx
    Footer.tsx
  home/                   # các section của trang chủ
    HeroBanner.tsx        # banner "Build your dream PC"
    CategorySection.tsx   # 6 danh mục nổi bật
    FlashSaleSection.tsx  # flash sale + đồng hồ đếm ngược
    FeaturedProducts.tsx  # sản phẩm nổi bật + tab lọc
    BestSellers.tsx       # top bán chạy trong tuần
    AiAdvisorSection.tsx  # khối trợ lý AI tư vấn
    AiBuildSection.tsx    # công cụ AI Build PC + cấu hình mẫu
    CommunityBar.tsx      # thống kê cộng đồng
    BrandStrip.tsx        # logo các hãng
  category/               # trang danh mục
    CategoryShell.tsx     # khung: cột lọc + thanh sắp xếp + chip lọc đang bật (client, đổi URL rồi để server dựng lại)
    FilterPanel.tsx       # nội dung bộ lọc: còn hàng, hãng (kèm số sản phẩm), khoảng giá gợi ý + nhập tay
    Pagination.tsx        # phân trang bằng liên kết thật
  product/
    ProductCard.tsx       # thẻ sản phẩm dùng chung toàn site
    ProductThumb.tsx      # khung ảnh sản phẩm (có placeholder)
    ProductGallery.tsx    # trang chi tiết: ảnh lớn + dải ảnh nhỏ
    ProductPurchasePanel.tsx  # chọn số lượng, Thêm vào giỏ, Mua ngay
    ProductDescription.tsx / SpecTable.tsx / Breadcrumb.tsx
  ui/
    CategoryIcon.tsx      # tên icon lưu trong DB (Category.icon) → icon lucide-react
    SectionHeading.tsx    # tiêu đề section dùng chung
    Countdown.tsx         # đồng hồ đếm ngược
    TextField.tsx         # ô nhập liệu (nhãn, icon, dấu *, gợi ý, lỗi nối bằng aria)
    QuantityStepper.tsx   # bộ chọn số lượng − / +
    Avatar.tsx            # ảnh đại diện; lỗi tải ảnh thì hiện chữ cái đầu

lib/
  api.ts                  # gọi API từ SERVER (Server Component): cache ISR, có dữ liệu dự phòng
  api-client.ts           # gọi API từ TRÌNH DUYỆT: cookie, tự refresh token khi gặp 401
  format.ts               # format giá VNĐ, % giảm giá, đếm ngược
  navigation.ts           # chuẩn hoá ?next= (chống open redirect), dựng link đăng nhập
  auth-errors.ts          # đổi mã lỗi ?error= (đăng nhập / liên kết Google, Facebook) và ?linked= sang câu tiếng Việt
  config.ts               # URL công khai của API (nút đăng nhập mạng xã hội trỏ thẳng vào đây)
  utils.ts                # cn() gộp class Tailwind
  data/                   # DỮ LIỆU DỰ PHÒNG khi API chưa chạy
    navigation.ts
    categories.ts
    products.ts

types/
  index.ts                # Product, Category, NavItem...

public/
  products/               # nơi để ảnh sản phẩm (.webp)
```

## 4. Bảng màu (khai báo trong `app/globals.css`)

| Token | Mã màu | Dùng cho |
| ----- | ------ | -------- |
| `ink-900 / ink-950` | `#0c1421` / `#070b12` | header, hero, footer, khối AI |
| `brand-500` | `#f97316` | nút MUA NGAY, BUILD PC |
| `gold-400` | `#facc15` | logo ZONE, AI SEARCH, AI PC Builder |
| `sale-600` | `#dc2626` | giá khuyến mãi, badge giảm giá |
| `canvas` | `#eceff3` | nền trang |

Sửa màu tại một chỗ duy nhất: khối `@theme` trong `app/globals.css`.

## 5. Nối với backend

Có **hai lớp** gọi API, dùng cho hai loại dữ liệu khác nhau:

| | `lib/api.ts` | `lib/api-client.ts` |
| - | ------------ | ------------------- |
| Chạy ở | Server Component | Trình duyệt (Client Component) |
| Dữ liệu | Sản phẩm, danh mục — ai xem cũng như nhau | Đăng nhập, giỏ hàng — của riêng từng người |
| Cache | ISR 60 giây | Không cache |
| API tắt | Dùng dữ liệu dự phòng trong `lib/data/` | Báo lỗi thật (không có dữ liệu giả cho giỏ hàng) |

Trạng thái đăng nhập và giỏ hàng nằm ở `AuthProvider` / `CartProvider`; component nào cũng đọc
được qua `useAuth()` / `useCart()`. Kiểu dữ liệu trong `types/index.ts` phải khớp
`apps/api/src/types/dto.ts`.

Các chỗ đã đánh dấu `// TODO` cần nối API:

- `components/home/AiAdvisorSection.tsx` – gửi câu hỏi cho AI (AI Chat, chưa làm — xem README gốc mục 13)

## 6. Ảnh sản phẩm

`ProductThumb` tự hiển thị placeholder khi sản phẩm chưa có ảnh. Khi đã tải ảnh
chính hãng về, đặt file vào `public/products/` rồi thêm trường `image` vào từng
sản phẩm, ví dụ:

```ts
image: "/products/rog-strix-g16.webp",
```

## 7. Font

Font `Be Vietnam Pro` và `Saira` được nạp qua Google Fonts CDN trong
`app/layout.tsx`. Nếu cần build offline, tải font về `public/fonts/` và chuyển
sang `next/font/local`.
