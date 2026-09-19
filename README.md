# PCZone — Đồ án chuyên ngành

Website thương mại điện tử bán PC Gaming, laptop và linh kiện máy tính, tích hợp
trợ lý AI tư vấn cấu hình và công cụ AI Build PC.

> **Build Your Power — Own Your Zone**

## 1. Kiến trúc

```
Trình duyệt
    │
    ├── apps/web        Next.js 16 (App Router)  :3000
    │        │  fetch JSON
    │        ▼
    ├── apps/api        Express 5 + Prisma       :4000
    │        │  Prisma Client
    │        ▼
    │   MySQL 8 (Docker)                         :3306
    │        ▲
    └── apps/crawler    Thu thập dữ liệu tham khảo + ảnh chính hãng

packages/db             Schema Prisma + Prisma Client dùng chung
```

Ba ứng dụng dùng **chung một schema Prisma** đặt ở `packages/db`, nên không bao
giờ có chuyện API và crawler hiểu cấu trúc bảng khác nhau.

## 2. Cấu trúc thư mục

```
pczone/
├── package.json            npm workspaces + toàn bộ script điều khiển
├── docker-compose.yml      MySQL 8
├── .env                    biến môi trường dùng chung (KHÔNG commit)
├── .env.example            mẫu để copy
│
├── packages/db/
│   ├── prisma/schema.prisma    25 bảng, 4 tầng: catalog / người dùng / thương mại / AI
│   ├── prisma/migrations/      lịch sử migration
│   ├── prisma/seed.ts          dữ liệu mẫu: danh mục, thương hiệu, 14 sản phẩm, admin
│   └── src/index.ts            Prisma Client singleton + re-export type
│
├── apps/api/               Express 5 + TypeScript
│   └── src/
│       ├── server.ts           điểm khởi động
│       ├── app.ts              cấu hình middleware + gắn router
│       ├── env.ts              đọc & kiểm tra biến môi trường
│       ├── routes/             định nghĩa endpoint + kiểm tra tham số (zod)
│       ├── services/           truy vấn Prisma, logic nghiệp vụ
│       ├── mappers/            Prisma model → DTO cho frontend
│       ├── middleware/         xử lý lỗi tập trung
│       └── types/dto.ts        hợp đồng dữ liệu với frontend
│
├── apps/web/               Next.js 16 + TypeScript + Tailwind 4
│   ├── app/                    layout, trang chủ
│   ├── components/             layout / home / product / ui
│   ├── lib/api.ts              lớp gọi API (có fallback khi API chưa chạy)
│   ├── lib/data/               dữ liệu dự phòng
│   └── types/index.ts          khớp với apps/api/src/types/dto.ts
│
└── apps/crawler/           Thu thập dữ liệu từ KCCShop + ảnh chính hãng
```

## 3. Chạy lần đầu

Cần: **Node.js 20+** và **Docker Desktop**.

```bash
# 1. Cài dependency cho cả monorepo + sinh Prisma Client
npm run setup

# 2. Tạo file .env (nếu chưa có) rồi bật MySQL
copy .env.example .env      # Windows;  Linux/macOS: cp .env.example .env
npm run db:up

# 3. Tạo bảng trong database
npm run db:migrate

# 4. Nạp dữ liệu mẫu để trang chủ có nội dung
npm run db:seed
```

Sau đó mở **hai terminal**:

```bash
# Terminal 1 — API
npm run dev:api        # http://localhost:4000

# Terminal 2 — Web
npm run dev:web        # http://localhost:3000
```

Kiểm tra API sống chưa: mở <http://localhost:4000/health>

> Nếu chưa bật API, trang web **vẫn chạy được** bằng dữ liệu dự phòng trong
> `apps/web/lib/data/` và in cảnh báo ở terminal. Đó là chủ ý, để làm giao diện
> mà không phụ thuộc backend.

## 4. Các lệnh hay dùng

| Lệnh | Tác dụng |
| ---- | -------- |
| `npm run db:up` / `db:down` | Bật / tắt MySQL trong Docker |
| `npm run db:migrate` | Tạo & áp dụng migration mới sau khi sửa schema |
| `npm run db:seed` | Nạp lại dữ liệu mẫu (chạy nhiều lần vẫn an toàn) |
| `npm run db:studio` | Mở Prisma Studio xem dữ liệu bằng giao diện |
| `npm run dev:api` | Chạy API ở chế độ watch |
| `npm run dev:web` | Chạy web ở chế độ dev |
| `npm run crawl` | Chạy crawler lấy dữ liệu tham khảo |
| `npm run build` | Build cả db + api + web |

## 5. Danh sách API hiện có

| Method | Endpoint | Mô tả |
| ------ | -------- | ----- |
| GET | `/health` | Kiểm tra API sống |
| GET | `/api/products` | Danh sách sản phẩm, có lọc & phân trang |
| GET | `/api/products/best-sellers?limit=4` | Top bán chạy |
| GET | `/api/products/:slug` | Chi tiết một sản phẩm |
| GET | `/api/categories` | Cây danh mục đầy đủ |
| GET | `/api/categories/featured?limit=6` | Danh mục nổi bật ở trang chủ |

Tham số của `/api/products`:

```
?category=linh-kien        lấy cả danh mục con (cpu, vga, ram...)
?brand=asus
?search=rtx
?minPrice=10000000&maxPrice=30000000
?featured=true
?flashSale=true
?sort=newest | price-asc | price-desc | best-selling | rating
?page=1&pageSize=20
```

## 6. Quy ước dữ liệu

- Chỉ sản phẩm `status = ACTIVE` mới hiện ra ngoài. Crawler nạp hàng về ở trạng
  thái `DRAFT` để admin duyệt và đặt giá trước.
- Giá crawl về ghi vào `refPrice` (giá tham khảo), **không** ghi đè `sellingPrice`.
- API **không** trả `costPrice`, `aiSearchText` và tồn kho tuyệt đối ra ngoài.
- `apps/api/src/types/dto.ts` và `apps/web/types/index.ts` phải luôn khớp nhau.

## 7. Tài khoản mẫu

| Email | Mật khẩu | Quyền |
| ----- | -------- | ----- |
| admin@pczone.vn | admin123 | ADMIN |

Đổi mật khẩu ngay sau lần chạy đầu tiên.

## 8. Việc còn lại

- [ ] Trang danh sách sản phẩm theo danh mục (`/danh-muc/[slug]`)
- [ ] Trang chi tiết sản phẩm (`/san-pham/[slug]`)
- [ ] Đăng ký / đăng nhập (JWT + bcrypt), giỏ hàng, đặt hàng
- [ ] Thanh toán VNPay Sandbox
- [ ] Service AI (Python/FastAPI): AI Search, AI Chat, AI Build PC
- [ ] Trang quản trị: duyệt sản phẩm DRAFT, quản lý đơn hàng
