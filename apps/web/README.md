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
  layout.tsx              # layout gốc: nạp font, Header, Footer
  page.tsx                # trang chủ, ráp các section theo thứ tự
  globals.css             # design token (màu, font) + class dùng chung

components/
  layout/                 # khung site
    TopBar.tsx            # thanh hotline / showroom / đăng nhập
    Header.tsx            # logo + ô tìm kiếm AI + giỏ hàng + tài khoản
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
  product/
    ProductCard.tsx       # thẻ sản phẩm dùng chung toàn site
    ProductThumb.tsx      # khung ảnh sản phẩm (có placeholder)
  ui/
    SectionHeading.tsx    # tiêu đề section dùng chung
    Countdown.tsx         # đồng hồ đếm ngược

lib/
  format.ts               # format giá VNĐ, % giảm giá, đếm ngược
  utils.ts                # cn() gộp class Tailwind
  data/                   # DỮ LIỆU MẪU – thay bằng API sau
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

Hiện tại dữ liệu nằm trong `lib/data/products.ts` (mock). Khi API sẵn sàng:

1. Tạo `lib/api.ts` gọi Express bằng `fetch` hoặc `axios`.
2. Đổi các section thành Server Component `async` và `await getProducts()`.
3. Giữ nguyên kiểu `Product` trong `types/index.ts` để component không phải sửa.

Các chỗ đã đánh dấu `// TODO` cần nối API:

- `components/layout/SearchBar.tsx` – tìm kiếm / AI search
- `components/home/AiAdvisorSection.tsx` – gửi câu hỏi cho AI

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
