# PCZone — Ngữ cảnh dự án cho các phiên làm việc tiếp theo

Cập nhật: 06/10/2026 (Asia/Bangkok), lần 3 — sau báo cáo Word đầy đủ (`a5faa56`): rà soát lỗ hổng thư viện, nâng Next.js lên 16.3.8, sửa một dòng README sai về VNPay. Lần 2: 30/09/2026 (đổi màu nhận diện, logo hãng, kiểm thử truy cập toàn bộ trang `aed0d37`, nút thu tiền COD `5d3fc76`, báo cáo Word); lần 1 cùng ngày tại `cc0f97a`; bản trước nữa: 23/09/2026 tại `471d1b0`.

## 1. Mục đích và phạm vi ghi nhận

- Người dùng yêu cầu lưu hiểu biết dự án để tiếp nối ở các phiên chat sau; bản này viết lại toàn bộ theo trạng thái thật ngày 30/09.
- Dự án: thư mục `pczone/` (cùng cấp với `AGENTS.md`). Đồ án chuyên ngành: website thương mại điện tử bán PC gaming, laptop, linh kiện, gaming gear, có AI Search, AI Chat, Build PC + AI gợi ý cấu hình. Giao diện và trao đổi bằng tiếng Việt.
- Khác bản 23/09: bản này dựa trên mã nguồn **và** các lần chạy thật trong phiên 29–30/09: kiểm thử đơn vị API (465 đạt trong 15 bộ — lần 1 ghi nhầm 294 vì chỉ cộng 9 bộ in kiểu `===== N pass`), kiểm thử đầu-cuối Playwright (56/56 đạt, DB riêng `pczone_e2e`), chạy thử toàn bộ cụm triển khai Docker trên máy dev. Mỗi mục ở phần 3 ghi rõ mức kiểm chứng.
- Không đọc hoặc chép giá trị trong `.env` / `.env.local` / `deploy/.env`; bản này không chứa khoá, token, mật khẩu hay dữ liệu khách hàng.
- `docs/` (bản ngữ cảnh này, hồ sơ bảo vệ, báo cáo Word) được đưa lên git theo yêu cầu người dùng. Ảnh banner tải lên lúc chạy (`apps/web/public/images/banners/`) được bỏ qua trong `.gitignore` theo lựa chọn của người dùng ngày 30/09.

## 2. Kiến trúc và cách chạy

Monorepo npm workspaces, Node.js >= 20:

| Phần | Vị trí | Vai trò |
| --- | --- | --- |
| Web | `apps/web` | Next.js 16.3, React 19.2, Tailwind 4.3, App Router; cổng dev 3000 |
| API | `apps/api` | Express 5.2, Zod 4.6, Prisma 6.19, JWT; cổng dev 4000 |
| DB dùng chung | `packages/db` | Prisma schema (31 model, 13 enum, 12 migration), seed, Prisma Client |
| Crawler | `apps/crawler` | Thu thập dữ liệu demo GEARVN, tải ảnh thật, chuyển WebP |
| Kiểm thử đầu-cuối | `apps/e2e` | Playwright 1.63 + axe-core; tự bật API :4101 + web production :3101 trên DB `pczone_e2e` |
| Triển khai | `Dockerfile`, `deploy/` | Docker Compose: MySQL + API + web + Caddy (HTTPS tự động) trên một VPS |
| MySQL dev | `docker-compose.yml` | MySQL 8.0, container `pczone-mysql` (thuộc compose project cũ khác tên — xem bộ nhớ phiên) |

- Lệnh thường dùng: `npm run setup`, `npm run db:up`, `npm run db:migrate`, `npm run dev:api`, `npm run dev:web`, `npm run build`.
- Kiểm thử: `npm test -w @pczone/api` (logic thuần, không cần DB), `npm run test:e2e` (trình duyệt Edge có sẵn; `E2E_BROWSER_CHANNEL` để đổi), `npm run report -w @pczone/e2e`.
- DB kiểm thử đầu-cuối chuẩn bị **không phá dữ liệu**: `prisma migrate deploy` + seed chạy lại được; từ chối mọi DB không có đuôi `_e2e`; Cài đặt hệ thống đưa về mặc định qua API trước khi chạy. Không thêm bước reset/drop khi chưa có đồng ý rõ ràng của người dùng. Ngày 30/09 đã chép thêm 53 bản ghi `ProductImage` (chỉ đọc từ DB dev) cho 14 sản phẩm mẫu vào `pczone_e2e` để ảnh chụp báo cáo có ảnh thật — không ảnh hưởng kịch bản nào.
- Triển khai: `bash deploy/export-data.sh` (máy dev: bản sao DB + ảnh) → `bash deploy/deploy.sh pczone-data.tar.gz` (máy chủ). Hướng dẫn đầy đủ ở README mục 14.
- Biến môi trường chính: `DATABASE_URL`, `JWT_SECRET` (>= 32 ký tự, bắt buộc); `API_URL` (server) / `NEXT_PUBLIC_API_URL` (trình duyệt, để rỗng = gọi `/api/*` cùng tên miền qua proxy của Next); `API_PUBLIC_URL`, `WEB_URL`, `CORS_ORIGIN`; `TRUST_PROXY` (số tầng proxy, mặc định tắt); `SITE_URL` (web: sitemap/robots/Open Graph); khoá tuỳ chọn Google/Facebook, VNPay, ngân hàng/MoMo, Resend, `OPENAI_API_KEY` + `OPENAI_BASE_URL` (đang dùng Gemini qua API tương thích OpenAI).

## 3. Chức năng hiện có và mức kiểm chứng

Mức kiểm chứng: **E2E** = có kịch bản Playwright đang đạt; **chạy thật** = đã chạy trên máy dev ở các phiên trước (trình duyệt/API, dữ liệu thử dọn lại sau); **đơn vị** = có kiểm thử đơn vị; **chỉ mã** = có mã nhưng chưa chạy thật.

| Nhóm | Chức năng | Kiểm chứng | Điểm vào |
| --- | --- | --- | --- |
| Cửa hàng | Trang chủ, danh mục (lọc/sắp xếp/phân trang), chi tiết sản phẩm, so sánh (gộp nhãn thông số trùng nghĩa) | E2E | `apps/web/app/(site)`, `components/product`, `lib/spec-labels.ts` |
| Tìm kiếm | Bộ tìm từ khoá tiếng Việt (không dấu, đồng nghĩa, lỗi gõ, mức giá); AI Search ngữ nghĩa, tự lùi về từ khoá khi thiếu khoá/tắt | E2E (từ khoá), chạy thật (AI) | `apps/api/src/search`, `src/ai` |
| Trợ lý AI | Chat stream SSE, truy hồi embedding (cosine trong bộ nhớ), máy chủ tự đối chiếu sản phẩm trích dẫn, lưu hội thoại | chạy thật, đơn vị | `ai-chat.service.ts`, `ai/retrieval.ts`, `/tro-ly-ai` |
| Build PC | Tự ráp, 9 luật tương thích, công suất nguồn, chia sẻ link, thêm cả bộ vào giỏ | E2E, đơn vị | `src/pc-build`, `/ai-build-pc` |
| AI gợi ý cấu hình | Gemini chọn theo mã danh mục, sửa 1 lần, tự đổi món vừa ngân sách bằng nhánh cận (không AI), lưu `PcBuild` + mã 8 ký tự, trang "Cấu hình của tôi" | chạy thật, đơn vị | `ai-build.service.ts`, `pc-build/budget-fit.ts` |
| Tài khoản | Đăng ký/đăng nhập, ghi nhớ, Google/Facebook + liên kết/huỷ liên kết, quên mật khẩu, xác minh email, sửa hồ sơ; trang Tài khoản dạng bảng điều khiển | E2E (đăng ký), chạy thật (phần còn lại); Facebook bằng tài khoản thật **chờ người dùng xác nhận** | `auth.*`, `oauth.*`, `account.service.ts`, `components/auth` |
| Giỏ & đặt hàng | Giỏ khách/tài khoản gộp khi đăng nhập, sổ địa chỉ, mã giảm giá, transaction trừ kho có điều kiện | E2E | `cart.service.ts`, `order.service.ts`, `components/checkout` |
| Theo dõi đơn | Tiến trình 5 bước từ lịch sử thật, mã vận đơn, tab theo nhóm trạng thái, tra cứu bằng mã + SĐT, tự huỷ | E2E | `OrderProgress.tsx`, `/tai-khoan/don-hang`, `/tra-cuu-don-hang` |
| Thanh toán | COD; chuyển khoản VietQR và MoMo xác nhận thủ công; phương thức không dùng được bị **ẩn** ở trang đặt hàng | E2E (COD) | `manual-payment.service.ts`, `PaymentMethodPicker.tsx` |
| VNPay | Ký/xác minh HMAC-SHA512, return + IPN, thanh toán lại | đơn vị với khoá giả; **chỉ mã** — chưa đăng ký sandbox, đang tắt | `vnpay.service.ts` |
| Đánh giá | Chỉ khi đơn chứa sản phẩm đã `DELIVERED`; chờ duyệt; quản trị duyệt/xoá/trả lời | E2E | `review.service.ts`, `/admin/reviews` |
| Quản trị | Đăng nhập riêng, 2FA TOTP, nhật ký thao tác, RBAC 4 vai trò; đơn hàng (vòng đời, xác nhận tiền, huỷ/hoàn trả/hoàn tiền, in, mã vận đơn), sản phẩm + kho, khách hàng, mã giảm giá, banner (tải ảnh), dashboard doanh thu + Excel, tài khoản quản trị, Cài đặt hệ thống | E2E (đơn hàng, đánh giá, cài đặt, phân quyền), chạy thật (phần còn lại) | `apps/api/src/routes/admin-*`, `apps/web/app/admin` |
| Trang chính sách | Bảo mật (có `#xoa-du-lieu` cho Facebook), điều khoản, đổi trả & bảo hành, vận chuyển & thanh toán — số liệu lấy từ Cài đặt | E2E (truy cập, tương phản) | `app/(site)/chinh-sach-*`, `dieu-khoan-su-dung` |
| Giao diện & truy cập | Màu nhận diện cam đậm chữ trắng đạt WCAG AA; nhãn cho mọi ô nhập quản trị; logo hãng thật (SVG Wikimedia) ở dải "Thương hiệu có tại PCZone", bấm để tìm hàng của hãng | E2E (axe-core: 19 trang khách, 7 trang tài khoản, toàn bộ khu quản trị kể cả trang sửa/chi tiết) | `app/globals.css`, `components/home/BrandStrip.tsx`, `apps/e2e/tests/accessibility.spec.ts` |
| SEO & header | `robots.txt`, `sitemap.xml` dựng lúc chạy, Open Graph sản phẩm, header chống clickjacking/nosniff/Referrer/Permissions, bỏ `X-Powered-By` | E2E | `app/robots.ts`, `app/sitemap.ts`, `next.config.ts` |
| Triển khai | Docker Compose + Caddy HTTPS, script chuyển dữ liệu, làm mới trang ISR sau khi lên | chạy thật trên máy dev; **chưa có VPS thật** | `Dockerfile`, `deploy/` |

## 4. Quy tắc nghiệp vụ cần giữ khi tiếp tục

- Sản phẩm công khai: `Product.status=ACTIVE`. DTO qua `src/mappers`; hợp đồng ở `apps/api/src/types/dto.ts`, kiểu web riêng ở `apps/web/types/index.ts` — đổi API thì đối chiếu cả hai.
- Web: `lib/api.ts` cache ISR 60 giây, có dữ liệu dự phòng khi API tắt (trang hiện được không chứng minh backend chạy). TopBar/Footer đọc cài đặt phía server nên hotline đổi có hiệu lực trong ~1 phút; phí ship ở giỏ hàng thì client hỏi lại API nên đúng ngay.
- Cài đặt hệ thống: bảng `Setting` (một dòng JSON mỗi nhóm), mặc định trong `apps/api/src/settings/system-settings.ts` (phí 30.000đ, miễn phí từ 500.000đ), API cache 30 giây, xoá cache khi lưu; chỉ OWNER (và ADMIN/STAFF cũ) có `settings:write`. Phương thức dùng được = đang bật **và** đã cấu hình `.env`; không cho lưu khi không còn phương thức nào dùng được.
- Đơn hàng: mã `PCZYYYYMMDD-NNNN`; phí ship tính trên tạm tính **trước** giảm giá. Vòng đời: PENDING → CONFIRMED → PACKING → SHIPPING → DELIVERED, nhân viên tiến đúng một bước mỗi lần. Khách tự huỷ khi PENDING/CONFIRMED và chưa thanh toán; nhân viên huỷ tới trước khi giao xong; hoàn trả từ SHIPPING (giao không thành công) hoặc DELIVERED. Huỷ/hoàn trả hoàn kho + trả lượt mã giảm giá; đơn đã trả tiền → hoàn tiền thủ công (PAID → REFUNDED). Xác nhận tiền chuyển khoản tự đưa đơn PENDING lên CONFIRMED. Đơn COD ghi nhận "đã thu tiền" bằng nút riêng khi đang giao/đã giao (không đổi trạng thái đơn, không thêm dòng lịch sử); chưa ghi nhận thì chưa tính doanh thu. Quy tắc chung ở `manualPaymentBlockReason` (`manual-payment.service.ts`); VNPay không ghi nhận tay.
- Đánh giá: chỉ khi có đơn `DELIVERED` chứa sản phẩm; mỗi sản phẩm/người/đơn một lần; phải duyệt mới công khai. Duyệt đánh giá thuộc quyền `products:*`.
- AI: không bao giờ bịa sản phẩm — trợ lý chỉ nhận ứng viên truy hồi từ DB và máy chủ tự đối chiếu trích dẫn; AI gợi ý cấu hình chọn theo mã, mã lạ bị bỏ, tương thích do luật mã hoá kiểm tra. Tắt AI ở Cài đặt → chat/build trả 503 kèm lý do, search lùi về từ khoá. Quota Gemini miễn phí có giới hạn.
- OAuth: nhận diện theo mã tài khoản nhà cung cấp, không tự gộp theo email; Google email đã xác minh được liên kết/trao lại tài khoản; Facebook trùng email bị từ chối (chống chiếm trước tài khoản).
- Bảo mật: bcrypt; access token 15 phút + refresh xoay vòng lưu băm; cookie httpOnly/SameSite, Secure ở production; phiên quản trị tách biệt (cookie + issuer riêng); kiểm Origin chống CSRF; giới hạn tần suất (dev nới x10); `TRUST_PROXY` khi đứng sau proxy; ảnh tải lên đối chiếu chữ ký đầu file.
- `next start` chỉ phục vụ file có sẵn trong `public/` lúc khởi động: banner tải lên hiển thị `unoptimized` (`lib/uploaded-images.ts`) và bản Docker để Caddy phục vụ thẳng `/images/banners/*`; ảnh sản phẩm phải có trước khi web khởi động.
- MoMo: ảnh QR tĩnh `public/images/payments/momo-qr.png` + số điện thoại/lời nhắn; không gọi MoMo Business API.
- So sánh: localStorage `pczone.compareSlugs`, tối đa 4, nhãn thông số gộp theo bảng đồng nghĩa khớp nguyên văn.
- Nội dung phải trung thực: ảnh thật (không ảnh AI), không số liệu/chứng nhận/quảng cáo bịa; trang chính sách không tự đặt con số kinh doanh chưa chốt. Dải logo hãng không ghi "đối tác"/"ủy quyền" (không có hợp đồng).
- Màu và tương phản: `brand-500` `#c2410c` (nút chữ trắng 5.2:1), `brand-600/700` cho chữ/link nhỏ trên nền nhạt; chữ xám trên nền trắng tối thiểu `slate-500`, trên nền trang `#eceff3` hoặc `slate-100` tối thiểu `slate-600`; nền tối (TopBar, Footer, Header, Hero, sidebar quản trị) giữ `slate-400`. Chip đỏ nhạt dùng `text-sale-700`. Ô nhập phải có `<label htmlFor>` hoặc `aria-label`. `accessibility.spec.ts` sẽ báo lỗi nếu vi phạm.

## 5. Dữ liệu và crawler

- 31 model: Catalog (Category, Brand, Product, ProductImage, ProductSpec, ProductEmbedding, InventoryTransaction); Người dùng (User, OAuthAccount, RefreshToken, PasswordResetToken, EmailVerificationToken, Address, AdminAuditLog); Thương mại (Cart, CartItem, Order, OrderItem, OrderStatusHistory, Payment, Voucher, VoucherRedemption); Tương tác, AI, nội dung (Review, WishlistItem, AiConversation, AiMessage, AiSearchLog, PcBuild, PcBuildItem, Banner, Setting).
- `ProductSpec`: thông số chuẩn hoá (~95 linh kiện) cho Build PC, chạy lại bằng `npm run db:specs`. `ProductEmbedding`: vector cho AI.
- Dữ liệu demo: `apps/crawler/data/demo-catalog.json` 422 sản phẩm + 14 seed = 436 (DB dev hiện trả 436 sản phẩm công khai). Ảnh thật từ hãng/snapshot, WebP, ~126 MB trong `apps/web/public/images/products` (git ignore, chép lên máy chủ bằng `export-data.sh`).
- Không chạy `db:seed` trần trên DB thật khi đã có đơn: seed `upsert` đưa tồn kho/số bán 14 sản phẩm mẫu về số tĩnh.

## 6. Chưa làm hoặc chưa đầy đủ

1. **Đưa lên VPS thật**: bộ triển khai đã chạy thử trên máy dev; chờ người dùng có máy chủ (Ubuntu, >= 2 GB RAM + swap, >= 15 GB) và tên miền (hoặc `<IP>.sslip.io`). Sau khi lên: khai callback Google/Facebook trên tên miền mới, đổi mật khẩu tài khoản quản trị mẫu, điền hotline/email thật ở Cài đặt.
2. **Đăng nhập Facebook bằng tài khoản thật**: nút chuyển đúng sang trang đăng nhập Facebook; chờ người dùng tự đăng nhập để kiểm tra phía máy chủ/DB.
3. Email tới khách thật cần xác minh tên miền trên Resend (`onboarding@resend.dev` chỉ gửi được tới chủ tài khoản Resend).
4. Chưa có nút tự xoá tài khoản (chính sách hướng dẫn gửi email hỗ trợ); thời hạn đổi trả và thời gian giao chưa có con số; số serial/IMEI, biên bản kiểm tra máy mới là chỗ giữ "Sắp ra mắt".
5. Cổng thanh toán thẻ quốc tế/trả góp; kiểm tra xung đột khi hai người cùng lưu Cài đặt (hiện người lưu sau thắng).
6. `npm audit --omit=dev` còn 5 cảnh báo ở thư viện chạy thật chưa có bản vá không phá vỡ: chuỗi `prisma` → `@prisma/config` → `deepmerge-ts` (chỉ chạy trong Prisma CLI) và `exceljs` → `uuid` (chỉ gọi `v4()` không truyền bộ đệm). Đã đối chiếu mã, không chạm đường bị lỗi (README mục 13). Cách "sửa" `npm audit` gợi ý (hạ `prisma`/`exceljs`/`eslint-config-next` về bản cũ) là vô nghĩa — không làm theo. Chạy lại `npm audit --omit=dev` trước khi lên VPS thật.

## 7. Quyết định đã chốt

- 28/09: **bỏ PCPoints / hạng thành viên** — không đề xuất lại.
- 28/09: chỉ đánh giá được sau khi đã nhận hàng (DELIVERED); gỡ toàn bộ chữ quảng cáo/số liệu bịa.
- 29/09: trang Cài đặt hệ thống gồm đủ 4 nhóm (cửa hàng, phí ship, thanh toán, AI).
- 30/09: **VNPay nhiều khả năng bỏ** — giữ mã, không chạy sandbox, ẩn khỏi trang đặt hàng; không đề xuất lại trừ khi người dùng nhắc.
- 30/09: nơi triển khai là **VPS + Docker** (không dùng Railway/Vercel/Render).
- 30/09: màu nhận diện **cam đậm, chữ trắng** (`#c2410c`); dải thương hiệu ở trang chủ dùng **logo thật của hãng** thay cho chữ.
- 30/09: đơn COD ghi nhận đã thu tiền bằng **nút xác nhận tay** (không tự đánh dấu khi giao xong); ảnh banner tải lên lúc chạy **không commit** (`.gitignore`).
- Quy trình: người dùng cho phép tự push lên GitHub (`khanhdat1/Do_An`) khi xong việc; commit theo đường dẫn cụ thể, quét bí mật trước khi push; không commit `.env` hay ảnh banner người dùng tải lên nếu chưa hỏi. Repo công khai: không đưa đường dẫn máy riêng, khoá, mật khẩu vào tài liệu.

## 8. Lịch sử 23/09 → 06/10

- 23–24/09: Admin Dashboard 6 đợt (đăng nhập/RBAC/2FA/nhật ký, vòng đời đơn, sản phẩm + kho, dashboard doanh thu, khách hàng, mã giảm giá, banner), xuất Excel 4 danh sách, tài khoản quản trị khác; tài khoản khách: quên mật khẩu, sửa hồ sơ, huỷ liên kết, xác minh email.
- 24–25/09: AI Search thật, AI Chat stream + trích dẫn thật (Gemini, `gemini-3.1-flash-lite`).
- 25–28/09: Build PC (chuẩn hoá thông số, 9 luật, trang tự ráp), chia sẻ qua Cloudflare Tunnel, AI gợi ý cấu hình + lưu/chia sẻ, tự điều chỉnh ngân sách.
- 28–29/09: gỡ quảng cáo bịa, bỏ PCPoints, đánh giá sau khi nhận hàng; trang Cài đặt; gộp nhãn so sánh; trang Tài khoản dạng bảng điều khiển; kiểm thử đầu-cuối Playwright.
- 30/09: bộ triển khai VPS + Docker (`9269ede`); trang chính sách, SEO, header bảo mật, kiểm tra chữ ký ảnh, sửa lỗi truy cập và hai link 404 ở trang chủ (`cc0f97a`); hồ sơ bảo vệ đồ án (`docs/bao-ve/`).
- 30/09 (chiều): đổi màu nhận diện sang cam đậm + sửa mọi lỗi tương phản/nhãn ô nhập ở trang khách, tài khoản và quản trị (E2E 56/56, kiểm tra truy cập chặt ở mọi trang); logo hãng thật ở trang chủ; gỡ khối "cộng đồng" và các câu bịa ở mục bán chạy.
- 30/09 (chiều, tiếp): báo cáo Word phần kỹ thuật `docs/bao-ve/bao-cao-do-an-pczone.docx` (Chương 3–5 + tài liệu tham khảo + phụ lục API/triển khai, 80 trang, 42 hình, ảnh chụp thật); sửa 2 sơ đồ lệch mã (máy trạng thái thêm Đang giao → Đã hoàn trả; trợ lý AI lấy 8 ứng viên, khung SSE `chunk`); `render-diagrams.cjs` nhận mã sơ đồ để vẽ lại riêng từng hình.
- 30/09 (tối): nút "Xác nhận đã thu tiền COD" cho đơn COD đang giao/đã giao (quy tắc `manualPaymentBlockReason`, +11 kiểm thử đơn vị, E2E vòng đời đơn có bước thu tiền; doanh thu tổng quan đã tính đơn COD); ảnh banner tải lên lúc chạy vào `.gitignore`. Báo cáo Word thêm Chương 1–2 và Kết luận, cập nhật theo phần COD và chụp lại ảnh quản trị (trang tổng quan có doanh thu từ đơn COD đã ghi nhận).
- 06/10: rà soát `npm audit` — nâng Next.js 16.3.5 → 16.3.8 (vá lỗi thực thi mã từ xa ở `ImageResponse` của `next/og`; dự án không dùng `next/og`) và `source-map-js` 1.2.2, kiểm thử lại đủ (lint, kiểm tra kiểu, 465 đơn vị, 56 đầu-cuối). Sửa dòng README nói VNPay "đã dùng được" (sai: VNPay chưa chạy thật, đang tắt).
- Trước khi tiếp tục: đọc `git status`/`git log` sau mốc `a5faa56`; có thể có một phiên chat khác làm song song trên cùng repo — kiểm tra trước khi commit.

## 9. Tài liệu nên đọc cùng

- `README.md`: cách chạy, API, kiểm thử (mục 4), triển khai (mục 14), checklist (mục 13).
- `docs/bao-ve/ho-so-bao-ve-pczone.html` + `docs/bao-ve/so-do/`: 13 sơ đồ (kiến trúc, use case, ERD sinh từ schema, máy trạng thái, tuần tự) dạng `.mmd` / `.svg` / `.png`, kịch bản demo, câu hỏi hội đồng. Sinh lại sau khi đổi mã: `node docs/bao-ve/cong-cu/gen-diagrams.mjs`, `node docs/bao-ve/cong-cu/render-diagrams.cjs` (cần mạng để tải Mermaid, dùng Edge qua Playwright), `node docs/bao-ve/cong-cu/build-dossier.mjs docs/bao-ve/ho-so-bao-ve-pczone.html`. Bản đã đăng (riêng tư): https://claude.ai/artifact/WHidRgJwT9TXwk8655rXxJ
- `docs/bao-ve/bao-cao-do-an-pczone.docx`: bản nháp báo cáo Word đầy đủ (90 trang: Chương 1 tổng quan, Chương 2 cơ sở lý thuyết có công thức, Chương 3 phân tích thiết kế, Chương 4 cài đặt, Chương 5 kiểm thử, Kết luận, tài liệu tham khảo, 2 phụ lục), trang bìa để trống thông tin trường/sinh viên cho người dùng điền; mục lục, danh mục hình/bảng là trường Word (Update Field). Dựng một lần bằng docx-js từ script tạm ngoài repo — từ nay sửa thẳng trong Word, không dựng lại đè lên bản người dùng đã chỉnh.
- `packages/db/prisma/schema.prisma`; `apps/api/src/app.ts`, `routes`, `services`, `middleware/permissions.ts`; `apps/web/app`, `components`, `lib/api.ts`, `lib/api-client.ts`; `apps/e2e/tests`; `deploy/`.
