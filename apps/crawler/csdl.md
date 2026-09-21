# PCZone — Thiết kế cơ sở dữ liệu

**Đồ án chuyên ngành** · MySQL 8 + Prisma ORM · Cập nhật 20/09/2026

---

## 1. Tổng quan

Cơ sở dữ liệu gồm **26 bảng** và **12 kiểu liệt kê (enum)**, chia làm bốn tầng:

| Tầng | Bảng | Vai trò |
|---|---|---|
| **1. Catalog** | Category, Brand, Product, ProductImage, ProductSpec | Danh mục sản phẩm — nền tảng của mọi tầng trên |
| **2. Người dùng** | User, Address, RefreshToken, OAuthAccount | Xác thực JWT, đăng nhập Google / Facebook, hồ sơ khách hàng, sổ địa chỉ |
| **3. Thương mại** | Cart, CartItem, Order, OrderItem, OrderStatusHistory, Payment, InventoryTransaction, Voucher, VoucherRedemption, Review, WishlistItem | Giỏ hàng → đặt hàng → thanh toán → kho |
| **4. AI** | ProductEmbedding, AiConversation, AiMessage, PcBuild, PcBuildItem, AiSearchLog | RAG, trợ lý chat, xây dựng cấu hình PC |

Ba tầng đầu phủ **tier bắt buộc** và **tier nâng cao** của đồ án; tầng 4 phủ **tier nổi bật** (AI Search, AI Assistant, AI Build PC).

### Sơ đồ quan hệ rút gọn

```
Category ──┬─< Product >─┬── Brand
  (cây)    │             │
           │             ├──< ProductImage
           │             ├──1  ProductSpec        ◄── AI Build PC đọc bảng này
           │             ├──1  ProductEmbedding   ◄── ánh xạ sang Qdrant
           │             ├──< CartItem >── Cart ──── User
           │             ├──< OrderItem >── Order ──┬── User
           │             ├──< Review                ├──< Payment
           │             ├──< WishlistItem          ├──< OrderStatusHistory
           │             ├──< PcBuildItem >── PcBuild
           │             └──< InventoryTransaction
           │
User ──┬──< Address              Voucher ──< VoucherRedemption
       ├──< RefreshToken         Voucher ──< Order
       ├──< OAuthAccount
       ├──< AiConversation ──< AiMessage
       └──< AiSearchLog
```

---

## 2. Tầng 1 — Catalog

### 2.1 Category

Bổ sung so với schema crawler:

- **`parentId` — quan hệ tự tham chiếu.** Cho phép cây danh mục: *Linh kiện máy tính → Mainboard*. Lưới 12 danh mục ở trang chủ lấy các nút gốc (`parentId = null`), trang danh mục lấy các nút con.
- **`componentType`** — nối danh mục với enum `ComponentType`. Đây là cầu nối để AI Build PC biết "danh mục Mainboard chứa linh kiện loại MAINBOARD" mà không phải đoán qua tên. Danh mục không phải linh kiện (VD: "Phụ kiện") để `null`.
- **`sortOrder`, `isActive`, `icon`, `imageUrl`** — phục vụ hiển thị.

### 2.2 Product

Đây là bảng thay đổi nhiều nhất. Nhóm theo mục đích:

**Mã hàng và nguồn dữ liệu**

| Trường | Ý nghĩa |
|---|---|
| `sku` | Mã nội bộ PCZone, duy nhất. VD `PCZ-MB-ASR-B760M`. Đây mới là mã dùng trong vận hành, không phải `id` |
| `source` | `MANUAL` \| `SEED` (14 sản phẩm mẫu) \| `KCCSHOP` (crawler cũ, nằm ở DRAFT chờ duyệt) \| `GEARVN` (bộ demo ~120 sản phẩm, nạp thẳng ACTIVE). Phân biệt hàng tự nhập và hàng do crawler sinh |
| `sourceUrl` | URL gốc, duy nhất và cho phép `null` (hàng tự nhập không có) |

**Bốn mức giá** — đây là điểm quan trọng trong báo cáo:

| Trường | Ai thấy | Dùng để |
|---|---|---|
| `costPrice` | Chỉ admin | Tính lợi nhuận, báo cáo |
| `sellingPrice` | Khách | Giá bán thực tế, **bắt buộc** |
| `originalPrice` | Khách | Giá gạch ngang, hiển thị mức giảm |
| `refPrice` | Nội bộ | Giá tham khảo từ nguồn crawl, để so sánh thị trường |

Dùng `Decimal(14, 0)` vì VNĐ không có phần thập phân, và `Decimal` tránh sai số làm tròn của `Float` khi cộng tiền đơn hàng. 14 chữ số đủ cho 99 nghìn tỷ đồng.

**Kho**

`inventoryQuantity` là tồn thực tế, `reservedQuantity` là số đã giữ cho các đơn chưa hoàn tất. Số bán được cho khách = `inventoryQuantity - reservedQuantity`. Cách này tránh tình trạng hai khách cùng mua thanh RAM cuối cùng.

**Số liệu tổng hợp** — `viewCount`, `soldCount`, `ratingAvg`, `ratingCount` là dữ liệu **phi chuẩn hoá có chủ đích**. Lẽ ra `ratingAvg` tính được bằng `AVG()` trên bảng `Review`, nhưng trang danh sách sản phẩm hiển thị sao cho 20 sản phẩm cùng lúc — chạy 20 câu `AVG` mỗi lần tải trang là không chấp nhận được. Đổi lại phải cập nhật hai trường này mỗi khi có đánh giá mới được duyệt.

**Hỗ trợ AI** — `aiSearchText` là văn bản đã gộp sẵn (tên + thương hiệu + thông số chính + mô tả ngắn) để đưa vào mô hình sinh embedding. Sinh sẵn giúp không phải ghép chuỗi lại mỗi lần đồng bộ vector.

### 2.3 ProductSpec — bảng then chốt của AI Build PC

`Product.specifications` là JSON thô lấy từ trang nguồn, mỗi hãng một kiểu đặt tên (`"Chipset"`, `"Chip set"`, `"Bo mạch chủ chipset"`). **Không thể viết câu SQL so sánh trên dữ liệu đó.**

`ProductSpec` là bản chuẩn hoá quan hệ 1–1 với `Product`, mỗi thông số một cột có kiểu rõ ràng. Nhờ đó bốn luật tương thích đã xác định trong thiết kế hệ thống trở thành truy vấn đơn giản:

| Luật | Truy vấn |
|---|---|
| Socket CPU = socket mainboard | `cpu.socket = mainboard.socket` |
| Loại RAM = loại mainboard hỗ trợ | `ram.ramType = mainboard.ramType` |
| VGA vừa case | `vga.gpuLengthMm <= case.caseMaxGpuMm` |
| PSU đủ công suất | `psu.psuWattage >= SUM(tdpWatts) * 1.3` |

Có thể mở rộng thêm: tản nhiệt vừa case (`coolerHeightMm <= caseMaxCoolerMm`), mainboard vừa case (`formFactor` nằm trong `caseFormFactors`).

Bốn index đặt trên `ProductSpec` (`componentType + socket`, `+ ramType`, `+ psuWattage`, `+ formFactor`) chính là đường đi của thuật toán gợi ý: khi đã chọn CPU LGA1700, câu truy vấn tìm mainboard tương thích đi thẳng vào index thay vì quét toàn bảng.

**Lưu ý triển khai:** phải có một bước chuẩn hoá dữ liệu — đọc `Product.specifications` thô, bóc ra các trường và ghi vào `ProductSpec`. Bước này nên làm bằng một script riêng (có thể dùng LLM để bóc tách), chạy sau khi crawler xong.

### 2.4 ProductImage

Giữ nguyên `source` / `sourceUrl` để phân biệt ảnh KCCShop và ảnh chính hãng — logic "ưu tiên giữ ảnh chính hãng" trong `db.ts` phụ thuộc vào hai trường này.

Hai sửa lỗi so với schema hiện tại, đã giải thích ở mục 5.

**Ảnh của sản phẩm mẫu (seed):** `npm run seed-images` (`apps/crawler/src/images/attach.ts`) gắn ảnh thật cho 14 sản phẩm trong `seed.ts` theo danh sách chọn tay ở `seed-manifest.ts`. Mỗi ảnh đi qua tầng ingest chung (kiểm tra kích thước, chuyển WebP ba cỡ, lưu checksum) rồi thành một dòng `ProductImage` với `source` là tên hãng (ASUS, AMD, SAMSUNG, CORSAIR, LOGITECH, GIGABYTE, LENOVO) hoặc `UNSPLASH` cho hai bộ PC lắp ráp của PCZone (không hãng nào có ảnh), `sourceUrl` là trang chứa ảnh và `remoteUrl` là URL gốc. Cả bộ ảnh của một sản phẩm được thay trong một giao dịch, và nếu không tải được ảnh nào thì giữ nguyên ảnh cũ. Chỉ dùng ảnh chụp / ảnh studio thật, không dùng ảnh do AI sinh.

**Bộ dữ liệu demo (`source = 'GEARVN'`):** `npm run demo-data` (`apps/crawler/src/demo/load.ts`) nạp ~120 sản phẩm thật ở 14 danh mục từ bản chụp `apps/crawler/data/demo-catalog.json` (thu thập bằng `npm run collect-demo`). Mỗi sản phẩm được tạo trong `Product` với `sourceUrl` là trang gốc (khoá chống trùng), `sellingPrice` = giá tham khảo tại ngày thu thập, `refPrice` cùng giá đó, `originalPrice` là giá niêm yết nếu đang giảm, `status = ACTIVE`. `shortSpecs`, `specifications` (mảng `[{label, value}]`), `shortDescription` và `description` do PCZone tự viết từ thông số (`src/demo/content/`), không lấy chữ của nguồn. Tồn kho (`inventoryQuantity`), `soldCount` và `publishedAt` là số giả lập ổn định theo sản phẩm, chỉ đặt lúc tạo mới để chạy lại không đè lên tồn kho đã giảm vì đơn hàng; `ratingAvg` và `ratingCount` để 0. Bộ PC lắp ráp mang thương hiệu `PCZone`. `Brand` được tạo khi chưa có (khớp theo slug hoặc tên), không sửa hãng đã có.

Ảnh của bộ demo cũng đi qua tầng ingest chung, `ProductImage.source = 'GEARVN'`, `sourceUrl` là trang sản phẩm và `remoteUrl` là URL gốc; tối đa 4 ảnh mỗi sản phẩm. Ảnh dính logo GEARVN bị bỏ tự động (`src/images/watermark.ts` so khớp hình dạng logo trắng ở bốn góc); ảnh đã xem mắt và loại thủ công (ảnh quảng cáo nhiều chữ, logo dạng màu, biển hiệu trong phông ảnh) nằm ở `apps/crawler/data/image-blocklist.json`. Không xoá hay cắt logo khỏi ảnh của người khác.

---

## 3. Tầng 2 — Người dùng

### 3.1 User

`passwordHash` lưu kết quả bcrypt, **không bao giờ lưu mật khẩu gốc**. Ba vai trò qua enum `UserRole`: `CUSTOMER` (khách), `STAFF` (nhân viên xử lý đơn), `ADMIN` (toàn quyền).

### 3.2 RefreshToken

Mô hình JWT hai token: access token ngắn hạn (15 phút, **không lưu DB** — đó là ý nghĩa của JWT), refresh token dài hạn có lưu DB để thu hồi được.

Điểm đáng nói trong báo cáo: bảng lưu `tokenHash` chứ không lưu token gốc. Nếu database bị lộ, kẻ tấn công vẫn không đăng nhập được. `userAgent` và `ipAddress` cho phép làm chức năng "đăng xuất khỏi thiết bị khác".

Ô "Ghi nhớ đăng nhập" không có cột riêng: hạn của dòng (`expiresAt − createdAt`) chính là dấu hiệu — 30 ngày là có nhớ, 1 ngày là chỉ trong phiên trình duyệt. Khi refresh, token mới giữ đúng chế độ của token cũ.

### 3.3 Address

Tách riêng thay vì nhét vào `User` vì một khách có nhiều địa chỉ (nhà, công ty). Chia bốn cấp theo chuẩn hành chính Việt Nam: Tỉnh/Thành → Quận/Huyện → Phường/Xã → số nhà.

### 3.4 OAuthAccount — đăng nhập Google / Facebook

Một `User` có thể liên kết với nhiều tài khoản mạng xã hội (quan hệ 1–N). Khoá nhận diện là cặp **`(provider, providerAccountId)`** — `sub` của Google, `id` của Facebook — với ràng buộc `UNIQUE`, tức một tài khoản Google chỉ thuộc về đúng một `User`.

Điểm cần nhấn mạnh khi bảo vệ: **không nhận diện người dùng bằng email**. Email có thể đổi, và không phải nhà cung cấp nào cũng bảo đảm email đã xác minh (Facebook thì không). Nếu tự gộp tài khoản theo email, kẻ xấu đăng ký trước bằng email của nạn nhân rồi chờ nạn nhân đăng nhập Google sẽ vẫn giữ được quyền vào tài khoản đó (*pre-hijacking*). Vì vậy chỉ email do **Google** bảo đảm đã xác minh mới được dùng để liên kết vào tài khoản có sẵn, và khi tài khoản đó chưa từng xác minh email thì nó được trao cho chủ email thật (mật khẩu cũ bị vô hiệu, mọi liên kết và phiên cũ bị huỷ). Quy tắc đầy đủ nằm ở `apps/api/src/services/oauth.service.ts` và mục 8 của README.

Lối ra hợp lệ cho trường hợp Facebook trùng email là **liên kết thủ công**: người dùng đăng nhập bằng cách cũ rồi bấm "Liên kết" ở trang Tài khoản. Lúc này danh tính đã được chứng minh từ cả hai phía (phiên PCZone đang mở + đăng nhập được tài khoản mạng xã hội) nên không cần dựa vào email. Ràng buộc "mỗi User một tài khoản cho mỗi nhà cung cấp" hiện do tầng ứng dụng kiểm tra (`linkSocialProfile`), chưa có `UNIQUE(userId, provider)` ở mức CSDL.

Người chỉ đăng nhập bằng mạng xã hội vẫn có `User.passwordHash` (cột bắt buộc) nhưng là băm của một chuỗi ngẫu nhiên 256 bit không ai biết, nên không thể đăng nhập bằng mật khẩu.

---

## 4. Tầng 3 — Thương mại

### 4.1 Cart — hỗ trợ khách vãng lai

`userId` và `sessionId` đều nullable và đều unique. Khách chưa đăng nhập có giỏ theo `sessionId`; khi đăng nhập thì gộp giỏ đó vào giỏ của tài khoản.

> MySQL cho phép nhiều giá trị `NULL` trong một unique index, nên thiết kế này hợp lệ — khác với ràng buộc unique thông thường.

`CartItem.priceAtAdd` lưu giá lúc thêm vào giỏ, để cảnh báo "sản phẩm đã đổi giá" khi khách quay lại sau vài ngày.

### 4.2 Order — nguyên tắc snapshot

Đây là quyết định thiết kế quan trọng nhất của tầng thương mại, và là điểm nên nhấn mạnh khi bảo vệ.

**Đơn hàng không được giữ khoá ngoại tới `Address`.** Nếu giữ, khách sửa địa chỉ vào tháng sau thì đơn hàng cũ sẽ hiển thị sai địa chỉ đã giao — làm hỏng chứng từ. Vì vậy `Order` **sao chép** thông tin giao hàng thành các trường độc lập (`recipientName`, `shippingProvince`, ...).

Cùng lý do, `OrderItem` sao chép `productName`, `productSku`, `productImage`, `unitPrice`. Sản phẩm có thể đổi tên, tăng giá, hoặc ngừng kinh doanh, nhưng hoá đơn phải giữ nguyên nội dung tại thời điểm mua. `productId` vẫn giữ (nullable, `onDelete: SetNull`) để có link dẫn về trang sản phẩm khi nó còn tồn tại.

`orderCode` là mã hiển thị cho khách (`PCZ20260919-0001`), khác với `id` dạng cuid dùng nội bộ. Khách gọi điện đọc mã này, không đọc cuid.

### 4.3 OrderStatusHistory

Bảy trạng thái đơn (`PENDING → CONFIRMED → PACKING → SHIPPING → DELIVERED`, cộng `CANCELLED` và `RETURNED`). Bảng lịch sử ghi mọi lần chuyển trạng thái kèm người thực hiện, phục vụ hai việc: màn hình theo dõi đơn của khách, và tra soát khi có khiếu nại.

### 4.4 Payment — vì sao tách khỏi Order

Một đơn có thể thanh toán **nhiều lần**: khách bấm VNPay, hết phiên, quay lại trả lần hai. Nếu nhét trường thanh toán vào `Order` thì lần thử thứ hai sẽ ghi đè lần đầu và mất dấu vết.

Các trường riêng của VNPay Sandbox: `transactionNo`, `bankCode`, `responseCode` (mã `"00"` là thành công), và `gatewayData` giữ nguyên payload IPN để đối soát khi có tranh chấp.

`Order.paymentStatus` là trạng thái tổng hợp để hiển thị nhanh; `Payment.status` là trạng thái của từng lần thử.

### 4.5 InventoryTransaction

Sổ nhập–xuất kho. Nguyên tắc: **mọi thay đổi `Product.inventoryQuantity` phải đi kèm một dòng ở đây**, trong cùng một transaction. `quantityChange` âm khi xuất, dương khi nhập; `quantityAfter` là tồn sau giao dịch, cho phép kiểm tra chéo khi số liệu lệch.

Đây cũng là nguồn dữ liệu cho phần báo cáo doanh thu và giá vốn của trang quản trị.

### 4.6 Voucher

`discountType` quyết định cách đọc `discountValue`: `PERCENT` thì là phần trăm (kèm `maxDiscount` làm trần giảm), `FIXED` thì là số tiền.

Ba lớp giới hạn: `usageLimit` (tổng lượt toàn hệ thống), `perUserLimit` (mỗi người), `minOrderAmount` (giá trị đơn tối thiểu). Bảng `VoucherRedemption` ghi từng lượt dùng để kiểm tra `perUserLimit`.

### 4.7 Review

`@@unique([productId, userId, orderId])` — mỗi người đánh giá một sản phẩm một lần trên mỗi đơn. Khách mua lại lần hai thì được đánh giá lại.

`isVerified` đánh dấu "đã mua hàng" (suy ra từ `orderId` khác null), `isApproved` là duyệt của admin — đánh giá chỉ hiện ra khi được duyệt, chống spam.

> `rating` từ 1 đến 5 phải kiểm tra ở tầng service. Prisma không sinh được ràng buộc `CHECK` của MySQL.

---

## 5. Tầng 4 — AI

### 5.1 ProductEmbedding — vector ở đâu?

Vector nằm ở **Qdrant**, MySQL chỉ giữ ánh xạ. Lý do: MySQL 8 không có kiểu vector và không đánh index tìm kiếm tương tự được (khác PostgreSQL có pgvector).

| Trường | Vai trò |
|---|---|
| `vectorId` | ID của point bên Qdrant |
| `collection` | Tên collection, mặc định `pczone_products` |
| `model`, `dimensions` | Model nào sinh ra vector này — quan trọng khi đổi model |
| `contentHash` | SHA-256 của `aiSearchText` tại lúc sinh vector |
| `status` | `PENDING` \| `INDEXED` \| `STALE` \| `FAILED` |

**Cơ chế đồng bộ:** khi sản phẩm được sửa, tính lại hash của `aiSearchText`; nếu khác `contentHash` thì đặt `status = STALE`. Một job nền quét các dòng `PENDING` và `STALE` để sinh lại vector. Nhờ vậy không bao giờ phải sinh lại toàn bộ.

### 5.2 AiConversation & AiMessage

`AiMessage.citedProductIds` là trường thể hiện trực tiếp **nguyên tắc grounding** đã đặt ra: *AI chỉ được dùng dữ liệu sản phẩm lấy từ database, không tự sinh thông tin sản phẩm*. Mỗi câu trả lời ghi lại đúng những sản phẩm nó đã trích dẫn — đây là bằng chứng kiểm chứng được, dùng cho phần đánh giá chất lượng trong báo cáo.

`retrievedChunks` giữ kết quả RAG thô để gỡ lỗi khi AI trả lời sai. `tokensIn`/`tokensOut`/`latencyMs` cho phép đo chi phí và tốc độ.

### 5.3 PcBuild & PcBuildItem

`@@unique([buildId, componentType])` — mỗi loại linh kiện chỉ một dòng trong một cấu hình. Hai thanh RAM là một dòng `quantity = 2`, không phải hai dòng. Ràng buộc này ngăn cấu hình vô lý (hai CPU) ngay ở tầng database.

`validationResult` lưu kết quả kiểm tra tương thích dạng JSON:

```json
[
  { "rule": "CPU_SOCKET", "severity": "ERROR",
    "message": "CPU dùng socket AM5 nhưng mainboard là LGA1700",
    "productIds": ["prod_cpu_x", "prod_mb_y"] },
  { "rule": "PSU_WATTAGE", "severity": "WARNING",
    "message": "PSU 550W sát ngưỡng với hệ thống ước tính 480W" }
]
```

`estimatedWattage` = tổng `tdpWatts` các linh kiện; `recommendedPsuW` = `estimatedWattage × 1.3`.

`shareCode` cho phép chia sẻ cấu hình qua link — một tính năng nhỏ nhưng dễ ghi điểm khi demo.

### 5.4 AiSearchLog

Ghi lại câu hỏi tự nhiên, bộ lọc mà AI suy ra (`parsedFilters`), số kết quả, và sản phẩm khách bấm vào. Đây là nguồn số liệu để viết phần **đánh giá chất lượng AI** trong báo cáo — tỷ lệ tìm kiếm có kết quả, tỷ lệ có click.

---

## 6. Ba lỗi đã sửa so với schema hiện tại

### 6.1 Khoá ngoại `ProductImage → Product` bị đổi thành RESTRICT

Migration `20260917180014_init` đã đổi từ `CASCADE` sang `RESTRICT`. Hậu quả: **không xoá được sản phẩm nào còn ảnh** — MySQL/Postgres sẽ từ chối với lỗi ràng buộc khoá ngoại.

Schema mới đặt lại `onDelete: Cascade`: xoá sản phẩm thì ảnh của nó đi theo.

### 6.2 Mất ràng buộc unique khiến `skipDuplicates` vô hiệu

Cùng migration đó đã bỏ `@@unique([productId, url])`. Nhưng `createMany({ skipDuplicates: true })` trong `db.ts` **dựa vào chính ràng buộc này** để lọc trùng. Không còn ràng buộc thì ảnh trùng URL vẫn được chèn.

Schema mới khôi phục: `@@unique([productId, url(length: 255)])`. Phần `length: 255` là bắt buộc trên MySQL vì `url` là `VARCHAR(500)`, vượt giới hạn 3072 byte của index InnoDB khi dùng bộ mã utf8mb4.

### 6.3 Thiếu index cho truy vấn thực tế

Schema cũ chỉ có ba index rời rạc (`categoryId`, `brandId`, `price`). Truy vấn thật của trang danh mục là "lọc theo danh mục **và** trạng thái, sắp xếp theo giá" — ba index rời không phục vụ được câu này.

Schema mới dùng **index tổ hợp** theo đúng hình dạng truy vấn:

| Index | Phục vụ |
|---|---|
| `[categoryId, status, sellingPrice]` | Trang danh mục có lọc giá |
| `[status, isFeatured]` | Khối sản phẩm nổi bật trang chủ |
| `[status, isFlashSale, flashSaleEndsAt]` | Khối Flash Sale |
| `[soldCount]` | Sắp xếp "bán chạy nhất" |
| `@@fulltext([name, shortDescription])` | Tìm kiếm từ khoá (trước khi tới lớp AI) |

---

## 7. Chuyển crawler từ PostgreSQL sang MySQL

Crawler hiện tại dùng PostgreSQL. Bốn việc cần làm:

**1. Đổi provider và chuỗi kết nối**

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

```env
DATABASE_URL="mysql://root:root@localhost:3306/pczone"
```

**2. `shortSpecs` không còn là mảng.** MySQL không hỗ trợ scalar list của Prisma:

```diff
- shortSpecs String[]
+ shortSpecs Json?
```

Trong `db.ts` thì `data.shortSpecs` truyền thẳng vào được — Prisma tự chuyển mảng JS thành JSON.

**3. `@db.Decimal(14, 0)` giữ nguyên**, MySQL hỗ trợ đầy đủ.

**4. `mode: "insensitive"` không hoạt động trên MySQL.** Hai script `replace-all-*.ts` dùng:

```ts
where: { name: { contains: "ASRock", mode: "insensitive" } }
```

MySQL mặc định đã dùng collation không phân biệt hoa thường (`utf8mb4_0900_ai_ci`), nên chỉ cần bỏ `mode`:

```ts
where: { name: { contains: "ASRock" } }
```

**5. `docker-compose.yml`** đổi sang MySQL 8:

```yaml
services:
  mysql:
    image: mysql:8.0
    container_name: pczone-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: pczone
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_0900_ai_ci
    ports:
      - "3306:3306"
    volumes:
      - pczone_mysqldata:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-proot"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  pczone_mysqldata:
```

> Bộ mã phải là **utf8mb4**, không phải `utf8`. `utf8` của MySQL chỉ 3 byte, không chứa được emoji và một số ký tự — tên sản phẩm và nội dung đánh giá sẽ lỗi.

---

## 8. Thứ tự triển khai đề xuất

Với 8–12 tuần còn lại, không nên migrate cả 26 bảng ngay. Chia bốn đợt:

| Đợt | Bảng | Mở khoá tính năng |
|---|---|---|
| **1** | Category, Brand, Product, ProductImage | Chạy lại crawler trên MySQL, có trang danh mục và chi tiết sản phẩm |
| **2** | User, Address, RefreshToken, Cart, CartItem, Order, OrderItem, OrderStatusHistory, Payment | Toàn bộ tier bắt buộc — đăng nhập, giỏ hàng, đặt hàng, VNPay |
| **3** | ProductSpec, ProductEmbedding, AiConversation, AiMessage, PcBuild, PcBuildItem, AiSearchLog | Ba tính năng AI nổi bật |
| **4** | Voucher, VoucherRedemption, Review, WishlistItem, InventoryTransaction | Tier nâng cao |

Mỗi đợt một migration riêng, đặt tên rõ ràng:

```bash
npx prisma migrate dev --name catalog
npx prisma migrate dev --name commerce
npx prisma migrate dev --name ai_layer
npx prisma migrate dev --name advanced_features
```

> Ba migration hiện tại đều tên `init` (`20260917175047_init`, `20260917180014_init`, `20260917180447_init`). Đặt tên trùng nhau làm lịch sử migration khó đọc — nên đặt tên mô tả đúng thay đổi.

---

## 9. Điểm cần lưu ý khi cài đặt

**Ràng buộc mà database không kiểm được, phải kiểm ở tầng service:**

- `Review.rating` trong khoảng 1–5 (Prisma không sinh `CHECK` cho MySQL)
- `Order.totalAmount = subtotal − discountAmount + shippingFee`
- `OrderItem.lineTotal = unitPrice × quantity`
- `Product.reservedQuantity ≤ inventoryQuantity`
- Mỗi `User` chỉ một `Address` có `isDefault = true`

**Việc phải chạy trong cùng một transaction:**

- Tạo đơn: trừ kho + ghi `InventoryTransaction` + tạo `Order` + `OrderItem`
- Duyệt đánh giá: cập nhật `Review.isApproved` + tính lại `Product.ratingAvg`, `ratingCount`
- Huỷ đơn: hoàn kho + ghi giao dịch kho + đổi trạng thái + ghi lịch sử

**Về `fullTextIndex`:** đây là preview feature của Prisma. Nếu phiên bản đang dùng báo lỗi, xoá dòng `previewFeatures` và ba khối `@@fulltext`, rồi tạo index bằng SQL thuần trong file migration.

**Về Prisma 7:** tài liệu thiết kế có nhắc Prisma 7 + MariaDB driver adapter. Nếu nâng lên Prisma 7, `url = env("DATABASE_URL")` trong `datasource` không còn được chấp nhận — chuỗi kết nối chuyển sang `prisma.config.ts` và truyền adapter vào constructor của `PrismaClient`. Schema hiện tại viết theo cú pháp Prisma 6 để khớp với crawler đang chạy.