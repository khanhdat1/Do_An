# PCZone KCCShop Crawler

Crawler mẫu cho đồ án PCZone, viết bằng **Node.js + TypeScript + Cheerio + Prisma + PostgreSQL**.

## Mục đích

- Đọc dữ liệu sản phẩm công khai từ KCCShop.
- Chuẩn hóa thành `Product`, `Brand`, `Category`, `ProductImage`.
- Lưu thông số kỹ thuật dạng `JSONB` qua Prisma `Json`.
- Có delay + concurrency thấp để tránh gửi request quá dày.

> Chỉ nên crawl dữ liệu công khai cho mục đích học tập/nghiên cứu. Trước khi crawl số lượng lớn, hãy tự kiểm tra điều khoản sử dụng và robots.txt của website tại thời điểm bạn chạy.

## Danh mục đã cấu hình

- Mainboard: https://kccshop.vn/main-bo-mach-chu/
- CPU: https://kccshop.vn/cpu-bo-vi-xu-ly/
- RAM: https://kccshop.vn/ram-bo-nho-trong/
- VGA: https://kccshop.vn/vga-card-man-hinh/
- SSD: https://kccshop.vn/o-cung-the-ran-ssd/
- Case: https://kccshop.vn/case-vo-may-tinh/
- PSU: https://kccshop.vn/psu-nguon-may-tinh/

## 1. Chạy PostgreSQL bằng Docker Compose

```bash
docker compose up -d
```

Kiểm tra container:

```bash
docker compose ps
```

## 2. Cài dependencies

```bash
npm install
```

## 3. Tạo `.env`

```bash
cp .env.example .env
```

Mặc định:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pczone?schema=public"
CRAWL_DELAY_MS=1500
CRAWL_CONCURRENCY=2
MAX_PRODUCTS_PER_CATEGORY=30
```

## 4. Tạo database schema

```bash
npm run prisma:generate
npm run prisma:migrate
```

## 5. Test đúng trang Mainboard bạn gửi

```bash
npm run single -- --url=https://kccshop.vn/mainboard-asrock-b760m-pro-rs-ddr5/ --category=mainboard
```

Crawler sẽ in JSON và lưu vào PostgreSQL.

Chỉ muốn xem JSON, không lưu DB:

```bash
npm run single -- --url=https://kccshop.vn/mainboard-asrock-b760m-pro-rs-ddr5/ --category=mainboard --save=false
```

## 6. Crawl một danh mục

Ví dụ lấy tối đa 20 Mainboard:

```bash
npm run dev -- category --category=mainboard --max=20
```

Ví dụ VGA:

```bash
npm run dev -- category --category=vga --max=20
```

Các slug hỗ trợ:

```text
mainboard
cpu
ram
vga
ssd
case
psu
```

## 7. Crawl tất cả danh mục

```bash
npm run crawl
```

Giới hạn mặc định lấy tối đa 30 sản phẩm/danh mục. Chỉnh `MAX_PRODUCTS_PER_CATEGORY` trong `.env` nếu cần.

## Dữ liệu lưu vào PostgreSQL

Ví dụ:

```json
{
  "name": "Mainboard ASRock B760M Pro RS DDR5",
  "slug": "mainboard-asrock-b760m-pro-rs-ddr5",
  "price": 2690000,
  "originalPrice": 2910000,
  "stockStatus": "IN_STOCK",
  "warrantyMonths": 36,
  "category": "Mainboard",
  "brand": "ASROCK",
  "shortSpecs": [
    "Hỗ trợ CPU Intel Gen 12/13/14 (LGA1700).",
    "Chipset Intel B760.",
    "4 khe DDR5, tối đa 256GB, 7200+(OC)."
  ],
  "specifications": {
    "CPU": "Supports 14th, 13th & 12th Gen Intel Core Processors (LGA1700)",
    "Chipset": "Intel B760",
    "Memory": "Dual Channel DDR5 ..."
  }
}
```

## Gợi ý tích hợp PCZone

Không nên dùng dữ liệu KCCShop như dữ liệu vận hành chính thức của shop. Với đồ án, nên coi đây là **nguồn seed/reference** và thêm các trường riêng của PCZone như:

- `sku`
- `inventoryQuantity`
- `costPrice`
- `sellingPrice`
- `isFeatured`
- `aiSearchText`
- `embeddingId`

Sau khi dữ liệu được import, module AI/RAG nên đọc dữ liệu từ PostgreSQL/Qdrant của PCZone, không truy cập KCCShop trực tiếp mỗi lần người dùng hỏi.
