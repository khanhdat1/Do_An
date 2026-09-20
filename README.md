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
│   ├── app/                    trang chủ, chi tiết sản phẩm, giỏ hàng, đăng nhập / đăng ký, tài khoản
│   ├── components/             layout / home / product / cart / auth / providers / ui
│   ├── lib/api.ts              gọi API từ server (cache ISR, có fallback khi API chưa chạy)
│   ├── lib/api-client.ts       gọi API từ trình duyệt (cookie, tự refresh token)
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
#    Mở .env, đặt JWT_SECRET bằng chuỗi ngẫu nhiên riêng của bạn (cách sinh ghi ngay trong file).
#    Thiếu JWT_SECRET thì API từ chối khởi động.
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
| GET | `/api/products/:slug` | Chi tiết một sản phẩm: ảnh, thông số, mô tả, breadcrumb |
| GET | `/api/categories` | Cây danh mục đầy đủ |
| GET | `/api/categories/featured?limit=6` | Danh mục nổi bật ở trang chủ |
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

- [ ] Trang danh sách sản phẩm theo danh mục (`/danh-muc/[slug]`) — breadcrumb ở trang chi tiết đã trỏ tới đây
- [x] Trang chi tiết sản phẩm (`/san-pham/[slug]`)
- [x] Đăng ký / đăng nhập (JWT + bcrypt), ghi nhớ đăng nhập, đăng nhập Google / Facebook, liên kết tài khoản mạng xã hội, trang tài khoản
- [ ] Hủy liên kết tài khoản mạng xã hội (phải chặn hủy liên kết cuối cùng của tài khoản không có mật khẩu, kẻo mất đường đăng nhập)
- [ ] Quên mật khẩu, xác minh email (cần gửi email; nút "Quên mật khẩu?" hiện mới chỉ báo tính năng đang phát triển)
- [x] Giỏ hàng (khách vãng lai + tài khoản, gộp giỏ khi đăng nhập)
- [ ] Đặt hàng: địa chỉ giao hàng, tạo đơn, trừ kho (`/thanh-toan` mới là trang giữ chỗ, đã bắt buộc đăng nhập)
- [ ] Thanh toán VNPay Sandbox
- [ ] Service AI (Python/FastAPI): AI Search, AI Chat, AI Build PC
- [ ] Trang quản trị: duyệt sản phẩm DRAFT, quản lý đơn hàng
