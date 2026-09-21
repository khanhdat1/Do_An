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
│   ├── prisma/schema.prisma    26 bảng, 4 tầng: catalog / người dùng / thương mại / AI
│   ├── prisma/migrations/      lịch sử migration
│   ├── prisma/seed.ts          dữ liệu mẫu: danh mục, thương hiệu, 14 sản phẩm, admin
│   ├── prisma/seed-descriptions.ts  bài mô tả dài của 14 sản phẩm mẫu
│   └── src/index.ts            Prisma Client singleton + re-export type
│
├── apps/api/               Express 5 + TypeScript
│   └── src/
│       ├── server.ts           điểm khởi động
│       ├── app.ts              cấu hình middleware + gắn router
│       ├── env.ts              đọc & kiểm tra biến môi trường
│       ├── routes/             định nghĩa endpoint + kiểm tra tham số (zod)
│       ├── services/           truy vấn Prisma, logic nghiệp vụ (sản phẩm, xác thực, giỏ hàng)
│       ├── mappers/            Prisma model → DTO cho frontend
│       ├── middleware/         lỗi tập trung, nhận diện JWT, chống CSRF, giới hạn tần suất
│       ├── utils/              cookie, trần số lượng giỏ hàng
│       └── types/dto.ts        hợp đồng dữ liệu với frontend
│
├── apps/web/               Next.js 16 + TypeScript + Tailwind 4
│   ├── app/                    trang chủ, danh mục (/danh-muc, /danh-muc/[slug]), chi tiết sản phẩm, giỏ hàng, đăng nhập / đăng ký, tài khoản
│   ├── components/             layout / home / category / product / cart / auth / providers / ui
│   ├── lib/category-query.ts   đọc / dựng bộ lọc trên URL của trang danh mục
│   ├── lib/api.ts              gọi API từ server (cache ISR, có fallback khi API chưa chạy)
│   ├── lib/api-client.ts       gọi API từ trình duyệt (cookie, tự refresh token)
│   ├── lib/data/               dữ liệu dự phòng
│   └── types/index.ts          khớp với apps/api/src/types/dto.ts
│
└── apps/crawler/           Thu thập dữ liệu tham khảo + nạp ảnh thật
    ├── data/demo-catalog.json  bản chụp ~420 sản phẩm demo (đưa vào git, xem "Dữ liệu demo" ở mục 4)
    └── src/
        ├── gearvn/             thu thập bản chụp từ GEARVN (collect.ts, kế hoạch plan.ts, đọc dữ liệu nhúng rsc.ts)
        ├── demo/               nạp bản chụp vào DB (load.ts) + viết thông số, mô tả (content/)
        └── images/             tải ảnh thật, chuyển WebP, chặn ảnh có logo shop khác (attach.ts, ingest.ts, watermark.ts)
```

## 3. Chạy lần đầu

Cần: **Node.js 20+** và **Docker Desktop**.

```bash
# 1. Cài dependency cho cả monorepo + sinh Prisma Client
npm run setup

# 2. Tạo file .env (nếu chưa có) rồi bật MySQL
copy .env.example .env      # Windows;  Linux/macOS: cp .env.example .env
#    Mở .env, đặt JWT_SECRET bằng chuỗi ngẫu nhiên riêng của bạn (cách sinh ghi ngay trong file).
#    Thiếu JWT_SECRET thì API từ chối khởi động.
npm run db:up

# 3. Tạo bảng trong database
npm run db:migrate

# 4. Nạp dữ liệu mẫu, ~420 sản phẩm demo VÀ tải ảnh thật cho tất cả (cần internet, khoảng 30 phút lần đầu)
npm run db:seed
```

> Muốn thử nhanh trước: `npm run db:seed:data` chỉ nạp 14 sản phẩm mẫu, không tải ảnh, mất vài giây
> và chạy được khi không có mạng. Phần còn lại nạp sau bằng `npm run seed-images` và `npm run demo-data`.

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
| `npm run db:seed` | Nạp **tất cả**: dữ liệu mẫu, ảnh của 14 sản phẩm mẫu, ~420 sản phẩm demo kèm ảnh (chạy nhiều lần vẫn an toàn) |
| `npm run db:seed:data` | Chỉ nạp dữ liệu mẫu (danh mục, hãng, 14 sản phẩm), không tải ảnh, chạy được khi không có mạng |
| `npm run db:seed:categories` | Chỉ cập nhật cây danh mục (thêm danh mục mới vào DB đang có dữ liệu, không đụng tới sản phẩm) |
| `npm run seed-images` | Chỉ tải ảnh cho sản phẩm mẫu chưa có ảnh (thêm `-- --force` để tải lại) |
| `npm run demo-data` | Nạp ~420 sản phẩm demo từ `data/demo-catalog.json` kèm ảnh (xem "Dữ liệu demo") |
| `npm run collect-demo` | Thu thập bổ sung bản chụp demo từ GEARVN cho đủ số lượng trong `plan.ts` (cần mạng; từ đầu mất ~30 phút, chạy bổ sung chỉ lấy phần còn thiếu) |
| `npm run db:studio` | Mở Prisma Studio xem dữ liệu bằng giao diện |
| `npm run dev:api` | Chạy API ở chế độ watch |
| `npm run dev:web` | Chạy web ở chế độ dev |
| `npm run crawl` | Chạy crawler lấy dữ liệu tham khảo |
| `npm run build` | Build cả db + api + web |

### Ảnh sản phẩm

`npm run db:seed` nạp sản phẩm mẫu **và** tải ảnh thật cho chúng trong cùng một lệnh (cần
internet, khoảng 1 phút; lần chạy sau tự bỏ qua sản phẩm đã có ảnh).

- **Chỉ dùng ảnh thật, không dùng ảnh do AI sinh.** Sản phẩm của hãng lấy ảnh studio nhiều góc
  từ chính trang sản phẩm của hãng (ASUS, AMD, Samsung, Corsair, Logitech, Gigabyte, Lenovo). Hai
  bộ PC lắp ráp của PCZone (không hãng nào chụp) và ảnh nền ở banner trang chủ dùng ảnh chụp
  thật miễn phí bản quyền từ Unsplash.
- Danh sách ảnh của từng sản phẩm nằm ở `apps/crawler/src/images/seed-manifest.ts`, đã chọn tay
  sau khi xem thử và ghi rõ trang nguồn. Thêm sản phẩm mới thì thêm một khối vào file này rồi
  chạy `npm run seed-images`. `npm test -w @pczone/crawler` kiểm tra file không sai slug và mọi
  ảnh đều nằm trên CDN của hãng hoặc Unsplash.
- Ảnh được tải về, kiểm tra kích thước, chuyển WebP ba cỡ (300 / 800 / 1600 px) vào
  `apps/web/public/images/products/<mã SKU>/` rồi ghi bảng `ProductImage` (kèm nguồn, trang gốc,
  checksum). Web phục vụ ảnh từ chính máy mình nên không chết khi hãng đổi đường dẫn. Thư mục này
  **không commit lên git**, mỗi máy tự tải bằng lệnh trên. Ảnh banner nằm ở `public/images/hero/`
  và có commit.
- Mất mạng thì sản phẩm vẫn hiện bình thường (ảnh tạm theo danh mục), có mạng chạy lại
  `npm run seed-images`.

| Lệnh | Tác dụng |
| ---- | -------- |
| `npm run seed-images` | Chỉ tải ảnh cho sản phẩm chưa có ảnh |
| `npm run seed-images -- --force` | Tải lại và thay toàn bộ ảnh trong danh sách |
| `npm run seed-images -- --dry-run` | Xem trước, không tải, không ghi DB |
| `npm run seed-images -- --only=asus` | Chỉ các sản phẩm có slug chứa "asus" |
| `npm run sync-images` | Với hàng crawl từ KCCShop: tự dò ảnh chính hãng ASRock / Gigabyte rồi so khớp model |

> Bản quyền ảnh thuộc về các hãng; dự án dùng cho mục đích học tập / demo. Bán hàng thật thì
> phải thay bằng ảnh có giấy phép của nhà phân phối. Ảnh Unsplash dùng theo giấy phép Unsplash.

### Dữ liệu demo (~420 sản phẩm)

Để trang danh mục có nhiều thứ để lọc, sắp xếp và phân trang, dự án kèm ~420 sản phẩm thật ở 18 danh mục
(CPU, mainboard, RAM, VGA, SSD, nguồn, case, laptop gaming / văn phòng, PC gaming / workstation, màn hình,
và Gaming Gear: bàn phím, chuột, tai nghe, loa, ghế, bàn), cộng 14 sản phẩm mẫu là khoảng 436. Hai nhóm lớn
nhất được nạp dày để trang danh mục có nhiều trang: **Laptop 150 sản phẩm** (gaming 70, văn phòng 80) và
**Gaming Gear 150 sản phẩm** (bàn phím 32, chuột 30, tai nghe 32, loa 16, ghế 32, bàn 8). Tách làm hai bước:

```
npm run collect-demo   →   apps/crawler/data/demo-catalog.json   →   npm run demo-data
(cần mạng)                 (đưa vào git)                            (nạp DB + tải ảnh, chạy lại thoải mái)
```

- **Nguồn:** [gearvn.com](https://gearvn.com) (robots.txt cho phép đọc `/collections` và `/products`).
  Crawler tự khai báo là crawler học tập, đọc tuần tự, cách nhau 1,5 giây. Kế hoạch (danh mục nào lấy
  bao nhiêu, từ bộ sưu tập nào) nằm ở `apps/crawler/src/gearvn/plan.ts`; tên sản phẩm, giá, thông số và địa
  chỉ ảnh được chụp lại vào `demo-catalog.json`, nên clone repo về chỉ cần `npm run demo-data`, không phải
  cào lại. GEARVN đổi giao diện cũng không ảnh hưởng dữ liệu đã chụp.
- **Chạy bổ sung.** `want` trong `plan.ts` là TỔNG số sản phẩm của danh mục. Nâng số đó rồi chạy lại
  `npm run collect-demo` thì chỉ lấy phần còn thiếu (file được ghi lại sau mỗi sản phẩm, bị ngắt giữa chừng
  thì chạy lại sẽ tiếp tục). Ứng viên được xếp để có nhiều hãng và nhiều **mẫu khác nhau** (không lấy mười ba
  màu của cùng một chiếc ghế khi còn mẫu khác), hàng còn trước rồi mới tới hàng đang hết. Trang thiếu bảng
  thông số bị bỏ để nhường chỗ ứng viên khác (mức tối thiểu chỉnh theo từng danh mục bằng `minAttributes`).
- **Laptop đọc thông số từ tên.** Phần lớn trang laptop của GEARVN không có bảng thông số, nhưng tên luôn ghi
  `(CPU/ card đồ họa/ RAM/ SSD/ màn hình/ hệ điều hành)`; `apps/crawler/src/gearvn/title-specs.ts` tách phần
  đó thành thông số (không đoán những gì tên không ghi). Bài mô tả bù độ dài bằng vài câu kiến thức phổ thông
  về từng thành phần (hậu tố HX/H/U của chip, RTX 50 khác RTX 40, màn OLED...) ở `content/laptop-notes.ts`.
- **Chữ do PCZone tự viết.** Bảng thông số, các chip, dòng mô tả ngắn và bài mô tả dài (khoảng 2.000–3.500
  ký tự, có tiêu đề mục, ảnh xen giữa, lưu ý khi mua, hỏi đáp) được dựng từ thông số kỹ thuật bằng các mẫu ở
  `apps/crawler/src/demo/content/`, không chép văn bản của nguồn. Câu nào thiếu thông số thì bị bỏ, không đoán.
- **Ảnh thật, chặn logo shop khác.** Ảnh do GEARVN tự chụp (nhiều nhất ở bộ PC) đóng logo "GEARVN.COM" ở góc;
  `apps/crawler/src/images/watermark.ts` nhận ra logo trắng ở bốn góc bằng cách so khớp hình dạng rồi **bỏ hẳn
  tấm đó** (không cắt hay xoá logo vì đó là sửa ảnh của người khác để giấu nguồn). Mỗi sản phẩm giữ tối đa 4 ảnh.
- **Đã xem mắt toàn bộ ảnh chính và các bộ ảnh rủi ro.** Bộ nhận diện chỉ bắt logo trắng, nên những gì nó bỏ sót
  (logo dạng màu trên nền sáng, biển hiệu GEARVN trong phông ảnh, ảnh quảng cáo tiếng Anh nhiều chữ của hãng) được
  ghi tay vào `apps/crawler/data/image-blocklist.json` (mỗi dòng có lý do). Muốn loại thêm một ảnh: thêm địa chỉ
  ảnh gốc vào file rồi chạy lại `npm run demo-data`; sản phẩm nào đang dùng ảnh đó sẽ được nạp lại ảnh (thay bằng
  ảnh kế tiếp của nguồn), sản phẩm khác bỏ qua. `npm test -w @pczone/crawler` kiểm tra mọi địa chỉ trong file
  vẫn còn trong bản chụp và không sản phẩm nào bị loại hết ảnh. Ảnh ghép của chính hãng (như huy hiệu "2 năm bảo
  hành" của ASUS Việt Nam kèm dải biểu tượng) vẫn được giữ khi sản phẩm không còn ảnh nào khác; ảnh khuyến mãi của
  cửa hàng bán lẻ và ảnh quảng cáo nhiều chữ tiếng Anh thì luôn bị loại.
- **Giá là giá tham khảo tại ngày thu thập** (ghi trong `demo-catalog.json`). Bộ PC được bán dưới tên "PCZone".
- **Số liệu vận hành là giả lập**, đặt một lần khi tạo sản phẩm và chạy lại không đè: tồn kho, số đã bán,
  ngày đăng. **Đánh giá để 0** (thẻ sản phẩm hiện "Chưa có đánh giá"), không bịa lượt đánh giá.
- Sản phẩm demo vào thẳng trạng thái `ACTIVE` (khác hàng crawl từ KCCShop nằm ở `DRAFT` chờ duyệt) vì đây là
  dữ liệu đã chọn lọc, cần bán được ngay trong giỏ hàng.

| Lệnh | Tác dụng |
| ---- | -------- |
| `npm run demo-data` | Nạp tất cả (bỏ qua ảnh sản phẩm đã có) |
| `npm run demo-data -- --no-images` | Chỉ dữ liệu, chưa tải ảnh |
| `npm run demo-data -- --only=cpu,ssd` | Chỉ vài danh mục |
| `npm run demo-data -- --force-images` | Tải lại ảnh của mọi sản phẩm |
| `npm run demo-data -- --dry-run` | Xem trước, không ghi DB, không tải ảnh |
| `npm run collect-demo -- --only=ssd` | Chỉ bổ sung riêng một danh mục (các danh mục khác giữ nguyên) |
| `npm run collect-demo -- --fresh --only=ssd` | Bỏ dữ liệu cũ của danh mục đó rồi thu thập lại từ đầu |
| `npm run collect-demo -- --dry-run` | Chỉ đọc trang danh sách, in số ứng viên |

> `collect-demo` chỉ thêm sản phẩm mới, không đổi giá của sản phẩm đã có (dùng `--fresh` khi muốn cập nhật giá).
> Sau khi thu thập nên nạp DB rồi xem lại ảnh (mở trang danh mục và trang chi tiết) trước khi commit.

### Mô tả sản phẩm

Mục "Mô tả sản phẩm" ở trang chi tiết là một bài viết dài: tiêu đề kèm thông số, đoạn mở đầu, các
mục có tiêu đề nhỏ, ảnh xen giữa, rồi đoạn giới thiệu PCZone ở cuối (giao diện tự thêm, kèm hotline
và email). Bảng thông số kỹ thuật nằm bên cạnh và đứng yên khi bạn cuộn đọc.

- Bài mô tả của 14 sản phẩm mẫu nằm ở `packages/db/prisma/seed-descriptions.ts`, bảng thông số ở
  `packages/db/prisma/seed.ts`. Số liệu kỹ thuật đã đối chiếu với trang sản phẩm chính hãng; chỗ nào
  hãng không công bố thì không viết. Sửa xong chạy `npm run db:seed:data` để cập nhật vào DB (web giữ
  cache tối đa 1 phút nên có thể phải tải lại trang một hai lần).
- Viết bằng chữ thuần kèm vài ký hiệu (xem `apps/web/lib/description.ts`), nên không có chỗ nào để
  chèn mã HTML vào trang:

| Viết | Hiển thị |
| ---- | -------- |
| `# Tiêu đề` | Tiêu đề chính của bài (tên sản phẩm + thông số nổi bật) |
| `## Tên mục` | Tiêu đề của một mục |
| `- ý ngắn` | Gạch đầu dòng (các dòng liền nhau gộp thành một danh sách) |
| `[ảnh 2]` hoặc `[ảnh 2: chú thích]` | Chèn ảnh thứ 2 của thư viện ảnh sản phẩm, chú thích mặc định "PCZone - tên sản phẩm" |
| dòng trống | Ngăn cách các đoạn |

Mô tả cũ dạng chữ thuần (nhập tay, crawler) không dùng ký hiệu nào vẫn hiển thị bình thường.

## 5. Danh sách API hiện có

| Method | Endpoint | Mô tả |
| ------ | -------- | ----- |
| GET | `/health` | Kiểm tra API sống |
| GET | `/api/products` | Danh sách sản phẩm, có lọc & phân trang |
| GET | `/api/products/best-sellers?limit=4` | Top bán chạy |
| GET | `/api/products/:slug` | Chi tiết một sản phẩm: ảnh, thông số, mô tả, breadcrumb |
| GET | `/api/categories` | Cây danh mục đầy đủ |
| GET | `/api/categories/featured?limit=6` | Danh mục nổi bật ở trang chủ |
| GET | `/api/categories/:slug` | Một danh mục cho trang danh mục: breadcrumb, danh mục con (kèm số sản phẩm cả nhánh), các hãng và khoảng giá để dựng bộ lọc. 404 nếu không có |
| POST | `/api/auth/register` | Đăng ký, đăng nhập luôn, gộp giỏ hàng khách |
| POST | `/api/auth/login` | `{ email, password, remember? }` — đăng nhập, gộp giỏ hàng khách vào tài khoản |
| POST | `/api/auth/refresh` | Đổi refresh token (cookie) lấy cặp token mới |
| POST | `/api/auth/logout` | Thu hồi refresh token, xoá cookie |
| GET | `/api/auth/me` | Người dùng hiện tại (`{ "user": null }` nếu chưa đăng nhập) |
| GET | `/api/auth/google`, `/api/auth/facebook` | Bắt đầu đăng nhập mạng xã hội (`?next=/gio-hang`), chuyển sang trang đồng ý. Thêm `?link=1` để người **đã đăng nhập** liên kết thêm tài khoản (mục 8) |
| GET | `/api/auth/google/callback`, `/api/auth/facebook/callback` | Google / Facebook gọi về; đăng nhập (hoặc liên kết) xong chuyển về web |
| GET | `/api/auth/providers` | Các tài khoản Google / Facebook đã liên kết với người dùng hiện tại (cần đăng nhập) |
| GET | `/api/cart` | Giỏ hàng của khách / tài khoản hiện tại |
| POST | `/api/cart/items` | Thêm vào giỏ `{ productId, quantity? }` (cộng dồn) |
| PATCH | `/api/cart/items/:itemId` | Đặt số lượng `{ quantity }` |
| DELETE | `/api/cart/items/:itemId` | Xoá một dòng khỏi giỏ |
| DELETE | `/api/cart` | Làm trống giỏ |

Tham số của `/api/products`:

```
?category=linh-kien        lấy cả danh mục con (cpu, vga, ram...)
?brand=asus                một hãng; nhiều hãng cách nhau dấu phẩy: ?brand=asus,msi
?search=rtx
?minPrice=10000000&maxPrice=30000000
?inStock=true              chỉ sản phẩm còn hàng (tồn kho trừ số đang giữ chỗ còn dương)
?featured=true
?flashSale=true
?sort=newest | price-asc | price-desc | best-selling | rating
?page=1&pageSize=20        tối đa 60
```

Mọi kiểu sắp xếp đều kèm khoá phụ `id`, nên sản phẩm bằng nhau ở khoá chính (cùng giá, cùng số đã bán)
vẫn có thứ tự cố định giữa hai lần gọi: bấm sang trang 2 không gặp lại sản phẩm đã thấy ở trang 1.

### Trang danh mục (`/danh-muc/[slug]`)

Toàn bộ bộ lọc nằm trên URL, ví dụ `/danh-muc/man-hinh?brand=asus,lg&minPrice=3000000&inStock=true&sort=price-asc&page=2`:
gửi link là người nhận thấy đúng kết quả đang xem, bấm Back quay lại đúng bộ lọc trước, và trang vẫn được
dựng ở server. Bộ lọc có: hãng (kèm số sản phẩm), khoảng giá (mức gợi ý tự chia theo giá của danh mục
+ ô nhập tay), chỉ hàng còn; sắp xếp; phân trang 12 sản phẩm / trang. Trên mobile bộ lọc là ngăn kéo mở bằng
nút "Bộ lọc". Danh mục cha (`/danh-muc/linh-kien`) hiện thêm ô chọn nhanh các danh mục con; `/danh-muc` liệt
kê mọi danh mục.

## 6. Quy ước dữ liệu

- Chỉ sản phẩm `status = ACTIVE` mới hiện ra ngoài. Crawler nạp hàng về ở trạng
  thái `DRAFT` để admin duyệt và đặt giá trước.
- Giá crawl về ghi vào `refPrice` (giá tham khảo), **không** ghi đè `sellingPrice`.
- API **không** trả `costPrice`, `aiSearchText` và tồn kho tuyệt đối ra ngoài. Ô chọn số
  lượng ở trang chi tiết dùng `maxQuantity` = min(tồn khả dụng, 10).
- Ảnh có `needsReview = true` (còn watermark shop khác, so khớp model chưa chắc) không bao
  giờ được trả ra — cả ở thẻ sản phẩm lẫn gallery trang chi tiết.
- Bảng thông số (`Product.specifications`) nhận hai dạng: mảng `[{ "label", "value" }]` (giữ
  đúng thứ tự, dùng cho seed / nhập tay) hoặc object `{ "Chipset": "..." }` (crawler ghi; MySQL
  tự sắp xếp lại khoá của kiểu JSON nên thứ tự không kiểm soát được).
- `apps/api/src/types/dto.ts` và `apps/web/types/index.ts` phải luôn khớp nhau.

## 7. Xác thực và giỏ hàng — cách hoạt động

**Đăng nhập (JWT + bcrypt).** Mật khẩu băm bằng bcrypt (cost 12), không lưu bản gốc.
Sau khi đăng nhập API cấp hai token, cả hai nằm trong **cookie `httpOnly`** — JavaScript
trên trang không đọc được, nên XSS không lấy cắp được token:

| Token | Dạng | Hạn | Lưu DB |
| ----- | ---- | --- | ------ |
| Access token | JWT (HS256) | 15 phút | Không |
| Refresh token | Chuỗi ngẫu nhiên 384 bit | 30 ngày | Có, **chỉ lưu hash** (bảng `RefreshToken`) |

Access token hết hạn thì request nhận 401; `lib/api-client.ts` tự gọi `/api/auth/refresh`
rồi gửi lại request, người dùng không thấy gì. Mỗi lần refresh, refresh token được **xoay
vòng** (token cũ bị thu hồi). Đăng xuất xoá hẳn dòng refresh token trong DB.

**Ghi nhớ đăng nhập.** Ô "Ghi nhớ đăng nhập trên thiết bị này" điều khiển thời gian sống của
phiên: tick (mặc định) thì cookie và refresh token sống 30 ngày; bỏ tick thì cookie là cookie
phiên (đóng trình duyệt là mất) và refresh token chỉ sống 1 ngày. Chế độ đã chọn được giữ
nguyên qua các lần refresh.

**Giỏ hàng khách vãng lai.** Chưa đăng nhập vẫn thêm được vào giỏ: API cấp cookie
`pcz_cart` (chính là `Cart.sessionId`). Khi đăng nhập hoặc đăng ký, giỏ đó được gộp vào giỏ
của tài khoản (cùng sản phẩm thì cộng số lượng) rồi xoá.

**Kiểm tra ở server, không tin frontend.** Giá lấy từ DB tại thời điểm tính; số lượng bị
chặn theo tồn kho khả dụng và trần 10 sản phẩm mỗi dòng; sản phẩm đổi giá / hết hàng / ngừng
bán sau khi đã vào giỏ được đánh dấu để khách xử lý trước khi đặt hàng.

**Các lớp bảo vệ đã có:** chống dò mật khẩu (giới hạn số lần đăng nhập sai theo IP), thông
báo lỗi đăng nhập không lộ email nào đã đăng ký, kiểm tra header `Origin` chống CSRF, cookie
`SameSite=Lax`, ghim thuật toán JWT (chặn `alg: none`), chống mở trang đăng nhập rồi chuyển
hướng ra ngoài (`?next=` chỉ nhận đường dẫn nội bộ), và với đăng nhập mạng xã hội: `state` dùng
một lần gắn với cookie của đúng trình duyệt (chống CSRF đăng nhập), client secret chỉ nằm ở server.

> **Khi triển khai:** web và API phải cùng "site" (ví dụ `shop.pczone.vn` và `api.pczone.vn`)
> thì cookie `SameSite=Lax` mới đi kèm request; đặt `NODE_ENV=production` để cookie có cờ
> `Secure` (bắt buộc HTTPS); nếu API nằm sau reverse proxy thì bật `app.set("trust proxy", ...)`
> để giới hạn tần suất theo đúng IP khách.

## 8. Đăng nhập bằng Google / Facebook

Chức năng dùng OAuth 2.0 (luồng "authorization code") và **chỉ hoạt động khi bạn điền khoá**
vào `.env`. Chưa điền thì bấm nút sẽ hiện thông báo "chưa được cấu hình", các cách đăng
nhập khác vẫn chạy bình thường.

### Lấy khoá Google

1. Vào <https://console.cloud.google.com> → tạo project → **APIs & Services → OAuth consent
   screen**: chọn *External*, điền tên ứng dụng và email hỗ trợ. Khi ứng dụng còn ở trạng thái
   *Testing*, thêm email của bạn vào mục **Test users** (chỉ những email này đăng nhập được).
2. **Credentials → Create credentials → OAuth client ID → Web application**. Ở
   **Authorized redirect URIs** điền đúng y hệt:
   `http://localhost:4000/api/auth/google/callback`
3. Chép *Client ID* và *Client secret* vào `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

### Lấy khoá Facebook

1. Vào <https://developers.facebook.com> → **My Apps → Create App** → đặt tên, ở bước
   *Trường hợp sử dụng* chọn **Xác thực và yêu cầu dữ liệu từ người dùng bằng tính năng Đăng
   nhập bằng Facebook** (*Authenticate and request data from users with Facebook Login*).
2. **Trường hợp sử dụng → Tùy chỉnh**: tab *Quyền và tính năng* đã có sẵn `email` và
   `public_profile` (trạng thái *Sẵn sàng thử nghiệm*), không cần thêm quyền nào khác. Sang tab
   *Cài đặt*, ở ô **URI chuyển hướng OAuth hợp lệ** (*Valid OAuth Redirect URIs*) điền rồi lưu:
   `http://localhost:4000/api/auth/facebook/callback`
3. **Cài đặt ứng dụng → Thông tin cơ bản**: chép *ID ứng dụng* và *Khóa bí mật của ứng dụng*
   (bấm *Hiển thị*) vào `.env`: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`. Khung đỏ "Currently
   ineligible for submission" ở trang này chỉ liên quan tới việc công khai ứng dụng, bỏ qua khi
   thử nghiệm. Khi app còn ở chế độ *Đang phát triển*, chỉ tài khoản có vai trò Quản trị viên /
   Nhà phát triển / Người thử nghiệm mới đăng nhập được (thêm ở **Vai trò trong ứng dụng**).

Sau khi sửa `.env`, khởi động lại API. `API_PUBLIC_URL` phải khớp phần đầu của địa chỉ callback
đã khai (mặc định `http://localhost:4000`), `WEB_URL` là nơi trình duyệt được đưa về sau khi
đăng nhập (mặc định `http://localhost:3000`). Lên production thì đổi cả hai sang tên miền thật
và khai thêm callback mới bên Google / Facebook.

### Luồng hoạt động

```
Bấm "Đăng nhập với Google"
  → GET  /api/auth/google            API tạo `state` ngẫu nhiên, lưu vào cookie httpOnly, chuyển sang Google
  → Google hiện trang chọn tài khoản / đồng ý
  → GET  /api/auth/google/callback   Google gọi về kèm `code` + `state`
        API kiểm tra `state` khớp cookie → đổi `code` lấy hồ sơ (server gọi server, có client secret)
        → tìm / tạo User → cấp cookie phiên như đăng nhập thường → gộp giỏ hàng khách
  → chuyển trình duyệt về web (`?next=`)
```

### Liên kết tài khoản — vì sao không tự gộp theo email

Tài khoản mạng xã hội được nhận diện bằng mã cố định của nhà cung cấp (`sub` của Google, `id`
của Facebook) lưu ở bảng `OAuthAccount`, **không phải bằng email**. Email chỉ được xét ở lần
đầu một tài khoản mạng xã hội xuất hiện:

| Tình huống | Kết quả |
| ---------- | ------- |
| Tài khoản mạng xã hội đã liên kết trước đó | Đăng nhập thẳng vào User đó |
| Chưa có User nào dùng email này | Tạo User mới (mật khẩu là chuỗi ngẫu nhiên không ai biết → không đăng nhập bằng mật khẩu được) |
| Đã có User dùng email này, đăng nhập bằng **Google** (email đã xác minh), User đó đã xác minh email | Liên kết thêm |
| Như trên nhưng User đó **chưa xác minh email** (đăng ký bằng mật khẩu) | Trao tài khoản cho chủ email thật: mật khẩu cũ bị vô hiệu, các liên kết và phiên cũ bị huỷ |
| Đã có User dùng email này, đăng nhập bằng **Facebook** | Từ chối (`oauth_email_taken`); người dùng đăng nhập bằng cách cũ rồi tự liên kết (bên dưới) |

Lý do: hệ thống chưa gửi email xác minh khi đăng ký, nên nếu chỉ "liên kết theo email", kẻ
xấu có thể đăng ký trước bằng email của nạn nhân (kèm mật khẩu của hắn) rồi chờ nạn nhân đăng
nhập Google — hắn vẫn giữ quyền vào tài khoản (tấn công *pre-hijacking*). Trao tài khoản cho
chủ email thật và huỷ mọi thứ kẻ đăng ký trước đang giữ là cách xử lý phổ biến (Firebase Auth
cũng làm vậy). Facebook không bảo đảm email đã xác minh nên email của nó không bao giờ được
dùng để chiếm hay gộp vào tài khoản có sẵn.

### Liên kết thủ công — lối ra khi Facebook trùng email

Gặp `oauth_email_taken` thì đăng nhập bằng cách cũ (mật khẩu hoặc Google), vào
**Tài khoản → Tài khoản liên kết** và bấm **Liên kết** ở dòng Facebook (hoặc Google). Cách này
an toàn vì người bấm đã chứng minh được cả hai bên: đang đăng nhập PCZone (phiên hiện tại) và
đăng nhập được tài khoản mạng xã hội vừa quay về, nên không cần đối chiếu email. Email Facebook
khác hay trùng tài khoản của người khác đều không ảnh hưởng; Facebook không có email cũng liên
kết được.

```
Bấm "Liên kết" (trang Tài khoản)
  → POST /api/auth/refresh            làm mới phiên để access token còn hạn (điều hướng không tự refresh được như fetch)
  → GET  /api/auth/facebook?link=1    API kiểm tra phiên, ghi `linkUserId` vào cookie state (httpOnly), chuyển sang Facebook
  → GET  /api/auth/facebook/callback  kiểm tra `state` và phiên hiện tại vẫn đúng `linkUserId` → đổi `code` lấy hồ sơ → tạo OAuthAccount
  → về /tai-khoan?linked=facebook   (thất bại: /tai-khoan?error=<mã>)
```

Quy tắc: mỗi tài khoản PCZone liên kết tối đa **một** tài khoản cho mỗi nhà cung cấp, và một tài
khoản Google / Facebook chỉ thuộc **một** User. Mã lỗi riêng của luồng này: `oauth_login_required`
(chưa đăng nhập, hoặc phiên đã đổi giữa chừng), `oauth_already_linked`, `oauth_provider_taken`.
Chưa có nút *Hủy liên kết*.

## 9. Tài khoản mẫu

| Email | Mật khẩu | Quyền |
| ----- | -------- | ----- |
| admin@pczone.vn | admin123 | ADMIN |

Đổi mật khẩu ngay sau lần chạy đầu tiên.

## 10. Việc còn lại

- [x] Trang danh sách sản phẩm theo danh mục (`/danh-muc/[slug]`, `/danh-muc`): lọc hãng / giá / còn hàng, sắp xếp, phân trang
- [x] ~420 sản phẩm demo có ảnh thật, thông số và mô tả dài; nhóm Laptop và nhóm Gaming Gear (bàn phím, chuột, tai nghe, loa, ghế, bàn) đều 150 sản phẩm (xem "Dữ liệu demo" ở mục 4)
- [ ] Tìm kiếm (`/tim-kiem`): ô tìm ở header chưa có trang kết quả
- [x] Trang chi tiết sản phẩm (`/san-pham/[slug]`)
- [x] Đăng ký / đăng nhập (JWT + bcrypt), ghi nhớ đăng nhập, đăng nhập Google / Facebook, liên kết tài khoản mạng xã hội, trang tài khoản
- [ ] Hủy liên kết tài khoản mạng xã hội (phải chặn hủy liên kết cuối cùng của tài khoản không có mật khẩu, kẻo mất đường đăng nhập)
- [ ] Quên mật khẩu, xác minh email (cần gửi email; nút "Quên mật khẩu?" hiện mới chỉ báo tính năng đang phát triển)
- [x] Giỏ hàng (khách vãng lai + tài khoản, gộp giỏ khi đăng nhập)
- [ ] Đặt hàng: địa chỉ giao hàng, tạo đơn, trừ kho (`/thanh-toan` mới là trang giữ chỗ, đã bắt buộc đăng nhập)
- [ ] Thanh toán VNPay Sandbox
- [ ] Service AI (Python/FastAPI): AI Search, AI Chat, AI Build PC
- [ ] Trang quản trị: duyệt sản phẩm DRAFT, quản lý đơn hàng
