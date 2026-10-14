# Kết quả kiểm thử đơn hàng TC16–TC20 (Bảng 5.9)

Người thực hiện: Claude Code, trên máy Windows của nhóm. Báo cáo Word chỉ được đọc (Phụ lục D.5 và Bảng 5.9), không bị sửa. Mã ứng dụng (apps/api, apps/web, packages/db) không bị sửa. Chỉ thêm 2 tệp mới trong apps/e2e. Chưa commit.

## 1. Thông tin lần chạy

- **Lần chạy cuối (dùng cho báo cáo):** 2026-10-13, 06:22:22 → 06:22:52 (+07), lệnh `npx playwright test -c playwright.api-only.config.ts` trong `apps/e2e`.
- Lần chạy trước đó: 06:20:42 → 06:21:52, xem mục 6.
- **Commit:** `d322a67`
- **Số khách dùng cho TC16: 10.** Đăng ký 10 khách không bị 429 nên không phải giảm xuống 5. API chạy ở chế độ development (NODE_ENV không đặt), nên mọi giới hạn tần suất được nới gấp 10 lần; giới hạn đăng ký là 100 lần/giờ.
- **CSDL:** `pczone_e2e` (riêng cho e2e), do `scripts/prepare-db.mjs` chuẩn bị: migrate deploy, seed, chuẩn hoá thông số. Lần chạy đầu tiên tự tạo CSDL này vì trước đó chưa có. CSDL dev `pczone` không bị đụng tới.
- **Sản phẩm dùng:** TC16 dùng `ssd-samsung-990-pro-2tb`; TC17–TC20 dùng `ram-corsair-vengeance-rgb-ddr5-32gb`. Cả hai là sản phẩm mẫu trong seed.ts mà không test nào khác dùng. Tồn kho được đặt bằng phiếu ADJUST của API quản trị ở đầu mỗi ca.
- **Môi trường:** tài khoản quản trị mẫu của seed (`admin@pczone.vn`, vai trò ADMIN, tên "Quản trị viên PCZone"). Mỗi khách là một khách mới đăng ký và một APIRequestContext riêng. Header Origin là `http://127.0.0.1:3101` (WEB_URL của e2e).

## 2. Kết quả từng ca

| Mã | Kỳ vọng | Kết quả thực tế (lần chạy cuối) | Đạt/Không đạt |
|---|---|---|---|
| TC16 | Tồn kho = 1; 10 khách đặt cùng lúc: đúng 1 đơn, 9 yêu cầu nhận 409, tồn kho cuối = 0, sổ kho có đúng 1 dòng EXPORT | Mã HTTP: **201 × 1, 409 × 1, 500 × 8**. Đơn tạo được: 1 (`PCZ20261013-0002`). Tồn kho trước/sau: **1 → 0**. Sổ kho lượt này: đúng 1 dòng `EXPORT −1, quantityAfter 0, đơn PCZ20261013-0002`. Yêu cầu 409 có thông báo: "Ổ cứng SSD Samsung 990 Pro 2TB NVMe M.2" vừa hết hàng… 8 yêu cầu 500 có thông báo "Lỗi máy chủ. Xem log của API để biết chi tiết."; log API ghi 8 lỗi Prisma **P2034** ("Transaction failed due to a write conflict or a deadlock") tại `tx.order.create()` (order.service.ts:122). Lần chạy trước cho đúng kết quả này (201×1, 409×1, 500×8; đơn PCZ20261013-0001). | **Không đạt** (không bán vượt, nhưng 8/9 yêu cầu thua nhận 500 thay vì 409) |
| TC17 | Khách tự huỷ đơn Chờ xác nhận có mã giảm giá: đơn Đã huỷ, tồn kho hoàn lại, lượt dùng mã được trả, có dòng sổ kho hoàn | Đơn `PCZ20261013-0003`, 2 sản phẩm, mã WELCOME10 giảm 300.000đ, trạng thái lúc đặt PENDING. Khách huỷ: **HTTP 200**, trạng thái **CANCELLED**. Tồn kho 5 → 3 (sau đặt) → **5** (sau huỷ). usageCount của WELCOME10: **0 → 1 → 0**; VoucherRedemption của đơn: 0 dòng. Sổ kho: `EXPORT −2 (còn 3)`, rồi `ADJUST +2 (còn 5), "Hoàn kho do huỷ đơn PCZ20261013-0003"`. Lịch sử: PENDING → CANCELLED, note "Khách tự huỷ đơn", không có người thực hiện (khách). paymentStatus PENDING; dòng Payment chuyển CANCELLED. | **Đạt** |
| TC18 | Nhân viên huỷ đơn đang đóng gói, có lý do: hoàn kho, lịch sử ghi người thực hiện và lý do, không tự hoàn tiền | Đơn `PCZ20261013-0004` đi PENDING → CONFIRMED → PACKING. Huỷ: **HTTP 200**, trạng thái **CANCELLED**. Tồn kho 5 → 4 (đang đóng gói) → **5**. Sổ kho: `EXPORT −1 (còn 4)`, rồi `ADJUST +1 (còn 5), "Hoàn kho do nhân viên huỷ đơn PCZ20261013-0004"`. Dòng lịch sử cuối: PACKING → CANCELLED, người thực hiện **"Quản trị viên PCZone" (ADMIN)**, lý do **"TC18 e2e: khách gọi điện đổi ý (1791847369595)"**. paymentStatus trước/sau: **PENDING → PENDING** (không tự hoàn tiền); dòng Payment PENDING chuyển CANCELLED. | **Đạt** |
| TC19 | Hoàn trả đơn đang giao: trạng thái Đã hoàn trả, hoàn kho loại RETURN | Đơn `PCZ20261013-0005` đi PENDING → CONFIRMED → PACKING → SHIPPING. Hoàn trả: **HTTP 200**, trạng thái **RETURNED**. Tồn kho 5 → 4 (đang giao) → **5**. Sổ kho: `EXPORT −1 (còn 4)`, rồi **`RETURN +1 (còn 5)`, "Khách trả hàng — đơn PCZ20261013-0005"**. Lịch sử cuối: SHIPPING → RETURNED, người thực hiện "Quản trị viên PCZone", lý do "TC19 e2e: giao không thành công, hàng về kho". paymentStatus PENDING → PENDING. | **Đạt** |
| TC20 | Ghi nhận hoàn tiền cho đơn chưa thu tiền: bị từ chối 409, paymentStatus không đổi | Đơn COD `PCZ20261013-0006`, trạng thái PENDING, paymentStatus PENDING. `POST /api/admin/orders/:code/mark-refunded`: **HTTP 409**, `{"error":"HttpError","message":"Chỉ đánh dấu hoàn tiền cho đơn đã huỷ hoặc đã hoàn, và đã từng thu tiền thành công."}`. paymentStatus trước/sau: **PENDING → PENDING**. | **Đạt** |

**Nhận xét về TC16** (lỗi thật của luồng đặt hàng; theo quy tắc chỉ báo cáo, không sửa):
- **Phần chống bán vượt vẫn đúng:** chỉ 1 đơn được tạo, tồn kho không âm, sổ kho chỉ có 1 dòng EXPORT.
- **Phần mã lỗi sai:** 8 trong 9 yêu cầu thua nhận **500** thay vì 409.
- **Nguyên nhân** (suy từ mã và log, đã đọc mã nhưng không sửa):
  - `utils/order-code.ts` sinh mã đơn bằng cách đếm số đơn trong ngày, rồi lấy số đếm + 1.
  - 10 transaction chạy song song đều đếm ra cùng một số, nên cùng INSERT một `orderCode`; cột này có ràng buộc unique.
  - MySQL InnoDB phát hiện deadlock giữa các lần chèn trùng khoá, và Prisma báo lỗi `P2034`.
  - Vòng thử lại trong `runCreateOrder` chỉ bắt lỗi trùng khoá (P2002), không bắt P2034. Lỗi này rơi xuống bộ xử lý lỗi chung nên thành 500.
- **Hệ quả:** chỉ 2/10 yêu cầu đi tới bước trừ kho có điều kiện. TC16 vì thế chưa thực sự thử được câu lệnh trừ kho có điều kiện với 9 yêu cầu cạnh tranh; nó chỉ cho thấy không có đơn thứ hai nào được tạo.
- **Hướng sửa** (để nhóm tự quyết, tôi chưa làm): bắt P2034 trong createOrder để thử lại cả transaction hoặc trả 409, hoặc sinh mã đơn không phụ thuộc phép đếm.

### Đối chiếu trực tiếp CSDL `pczone_e2e` sau lần chạy cuối (chỉ SELECT, nguyên văn)

```sql
SELECT o.orderCode, o.status, o.paymentStatus, o.discountAmount, v.code AS voucher FROM `Order` o LEFT JOIN Voucher v ON v.id = o.voucherId WHERE o.orderCode BETWEEN 'PCZ20261013-0002' AND 'PCZ20261013-0006' ORDER BY o.orderCode;
SELECT p.slug, t.type, t.quantityChange, t.quantityAfter, o.orderCode, t.note, t.createdAt FROM InventoryTransaction t JOIN Product p ON p.id = t.productId LEFT JOIN `Order` o ON o.id = t.orderId WHERE p.slug IN ('ssd-samsung-990-pro-2tb','ram-corsair-vengeance-rgb-ddr5-32gb') AND t.createdAt >= '2026-10-12 23:22:00' ORDER BY t.createdAt;
SELECT p.slug, p.inventoryQuantity, p.reservedQuantity FROM Product p WHERE p.slug IN ('ssd-samsung-990-pro-2tb','ram-corsair-vengeance-rgb-ddr5-32gb');
SELECT code, usageCount FROM Voucher WHERE code = 'WELCOME10';
SELECT COUNT(*) AS redemption_tc17 FROM VoucherRedemption WHERE orderId = 'PCZ20261013-0003';
SELECT o.orderCode, h.fromStatus, h.toStatus, u.fullName AS nguoi_thuc_hien, u.role, h.note FROM OrderStatusHistory h JOIN `Order` o ON o.id = h.orderId LEFT JOIN User u ON u.id = h.changedBy WHERE o.orderCode IN ('PCZ20261013-0003','PCZ20261013-0004','PCZ20261013-0005','PCZ20261013-0006') ORDER BY o.orderCode, h.createdAt;
SELECT o.orderCode, pm.method, pm.status AS payment_row_status FROM Payment pm JOIN `Order` o ON o.id = pm.orderId WHERE o.orderCode BETWEEN 'PCZ20261013-0002' AND 'PCZ20261013-0006' ORDER BY o.orderCode;
```

```
+------------------+-----------+---------------+----------------+-----------+
| orderCode        | status    | paymentStatus | discountAmount | voucher   |
+------------------+-----------+---------------+----------------+-----------+
| PCZ20261013-0002 | PENDING   | PENDING       |              0 | NULL      |
| PCZ20261013-0003 | CANCELLED | PENDING       |         300000 | WELCOME10 |
| PCZ20261013-0004 | CANCELLED | PENDING       |              0 | NULL      |
| PCZ20261013-0005 | RETURNED  | PENDING       |              0 | NULL      |
| PCZ20261013-0006 | PENDING   | PENDING       |              0 | NULL      |
+------------------+-----------+---------------+----------------+-----------+
+-------------------------------------+--------+----------------+---------------+------------------+-------------------------------------------------------+-------------------------+
| slug                                | type   | quantityChange | quantityAfter | orderCode        | note                                                  | createdAt               |
+-------------------------------------+--------+----------------+---------------+------------------+-------------------------------------------------------+-------------------------+
| ssd-samsung-990-pro-2tb             | ADJUST |            -37 |             1 | NULL             | e2e: đặt tồn kho = 1                                  | 2026-10-12 23:22:45.718 |
| ssd-samsung-990-pro-2tb             | EXPORT |             -1 |             0 | PCZ20261013-0002 | Xuất kho theo đơn PCZ20261013-0002                    | 2026-10-12 23:22:46.393 |
| ram-corsair-vengeance-rgb-ddr5-32gb | ADJUST |            -77 |             5 | NULL             | e2e: đặt tồn kho = 5                                  | 2026-10-12 23:22:47.648 |
| ram-corsair-vengeance-rgb-ddr5-32gb | EXPORT |             -2 |             3 | PCZ20261013-0003 | Xuất kho theo đơn PCZ20261013-0003                    | 2026-10-12 23:22:48.474 |
| ram-corsair-vengeance-rgb-ddr5-32gb | ADJUST |              2 |             5 | PCZ20261013-0003 | Hoàn kho do huỷ đơn PCZ20261013-0003                  | 2026-10-12 23:22:48.620 |
| ram-corsair-vengeance-rgb-ddr5-32gb | ADJUST |              0 |             5 | NULL             | e2e: đặt tồn kho = 5                                  | 2026-10-12 23:22:48.989 |
| ram-corsair-vengeance-rgb-ddr5-32gb | EXPORT |             -1 |             4 | PCZ20261013-0004 | Xuất kho theo đơn PCZ20261013-0004                    | 2026-10-12 23:22:49.690 |
| ram-corsair-vengeance-rgb-ddr5-32gb | ADJUST |              1 |             5 | PCZ20261013-0004 | Hoàn kho do nhân viên huỷ đơn PCZ20261013-0004        | 2026-10-12 23:22:49.836 |
| ram-corsair-vengeance-rgb-ddr5-32gb | ADJUST |              0 |             5 | NULL             | e2e: đặt tồn kho = 5                                  | 2026-10-12 23:22:50.144 |
| ram-corsair-vengeance-rgb-ddr5-32gb | EXPORT |             -1 |             4 | PCZ20261013-0005 | Xuất kho theo đơn PCZ20261013-0005                    | 2026-10-12 23:22:50.825 |
| ram-corsair-vengeance-rgb-ddr5-32gb | RETURN |              1 |             5 | PCZ20261013-0005 | Khách trả hàng — đơn PCZ20261013-0005                 | 2026-10-12 23:22:51.015 |
| ram-corsair-vengeance-rgb-ddr5-32gb | ADJUST |              0 |             5 | NULL             | e2e: đặt tồn kho = 5                                  | 2026-10-12 23:22:51.305 |
| ram-corsair-vengeance-rgb-ddr5-32gb | EXPORT |             -1 |             4 | PCZ20261013-0006 | Xuất kho theo đơn PCZ20261013-0006                    | 2026-10-12 23:22:51.940 |
+-------------------------------------+--------+----------------+---------------+------------------+-------------------------------------------------------+-------------------------+
+-------------------------------------+-------------------+------------------+
| slug                                | inventoryQuantity | reservedQuantity |
+-------------------------------------+-------------------+------------------+
| ram-corsair-vengeance-rgb-ddr5-32gb |                 4 |                0 |
| ssd-samsung-990-pro-2tb             |                 0 |                0 |
+-------------------------------------+-------------------+------------------+
+-----------+------------+
| code      | usageCount |
+-----------+------------+
| WELCOME10 |          0 |
+-----------+------------+
+-----------------+
| redemption_tc17 |
+-----------------+
|               0 |
+-----------------+
+------------------+------------+-----------+---------------------------+-------+----------------------------------------------------------+
| orderCode        | fromStatus | toStatus  | nguoi_thuc_hien           | role  | note                                                     |
+------------------+------------+-----------+---------------------------+-------+----------------------------------------------------------+
| PCZ20261013-0003 | NULL       | PENDING   | NULL                      | NULL  | Tạo đơn hàng                                             |
| PCZ20261013-0003 | PENDING    | CANCELLED | NULL                      | NULL  | Khách tự huỷ đơn                                         |
| PCZ20261013-0004 | NULL       | PENDING   | NULL                      | NULL  | Tạo đơn hàng                                             |
| PCZ20261013-0004 | PENDING    | CONFIRMED | Quản trị viên PCZone      | ADMIN | NULL                                                     |
| PCZ20261013-0004 | CONFIRMED  | PACKING   | Quản trị viên PCZone      | ADMIN | NULL                                                     |
| PCZ20261013-0004 | PACKING    | CANCELLED | Quản trị viên PCZone      | ADMIN | TC18 e2e: khách gọi điện đổi ý (1791847369595)           |
| PCZ20261013-0005 | NULL       | PENDING   | NULL                      | NULL  | Tạo đơn hàng                                             |
| PCZ20261013-0005 | PENDING    | CONFIRMED | Quản trị viên PCZone      | ADMIN | NULL                                                     |
| PCZ20261013-0005 | CONFIRMED  | PACKING   | Quản trị viên PCZone      | ADMIN | NULL                                                     |
| PCZ20261013-0005 | PACKING    | SHIPPING  | Quản trị viên PCZone      | ADMIN | NULL                                                     |
| PCZ20261013-0005 | SHIPPING   | RETURNED  | Quản trị viên PCZone      | ADMIN | TC19 e2e: giao không thành công, hàng về kho             |
| PCZ20261013-0006 | NULL       | PENDING   | NULL                      | NULL  | Tạo đơn hàng                                             |
+------------------+------------+-----------+---------------------------+-------+----------------------------------------------------------+
+------------------+--------+--------------------+
| orderCode        | method | payment_row_status |
+------------------+--------+--------------------+
| PCZ20261013-0002 | COD    | PENDING            |
| PCZ20261013-0003 | COD    | CANCELLED          |
| PCZ20261013-0004 | COD    | CANCELLED          |
| PCZ20261013-0005 | COD    | PENDING            |
| PCZ20261013-0006 | COD    | PENDING            |
+------------------+--------+--------------------+
```

Ghi chú: createdAt lưu theo giờ UTC; 23:22 UTC ngày 12/10 là 06:22 giờ Việt Nam ngày 13/10. Các dòng `ADJUST 0` là phiếu "đặt tồn kho = 5" ở đầu mỗi ca khi tồn kho đang là 5 sẵn. `ADJUST −37` và `ADJUST −77` là lúc đưa tồn kho mẫu (38 và 82) về 1 và 5.

## 3. Kết quả Playwright, lần chạy cuối (nguyên văn, bỏ các dòng log `[WebServer]` của API)

```

Running 5 tests using 1 worker

[KET-QUA] {"ca":"TC16","soKhach":10,"maHttp":{"201":1,"409":1,"500":8},"donTaoDuoc":["PCZ20261013-0002"],"thongBaoLoi":["Lỗi máy chủ. Xem log của API để biết chi tiết.","\"Ổ cứng SSD Samsung 990 Pro 2TB NVMe M.2\" vừa hết hàng. Vui lòng quay lại giỏ hàng để kiểm tra."],"tonKhoTruoc":1,"tonKhoSau":0,"soKhoExportLuotNay":[{"type":"EXPORT","quantityChange":-1,"quantityAfter":0,"orderCode":"PCZ20261013-0002"}]}
  x  1 tests\order-edge-cases.spec.ts:155:1 › TC16 - 10 khách đặt cùng lúc sản phẩm chỉ còn 1 (6.5s)
[KET-QUA] {"ca":"TC17","orderCode":"PCZ20261013-0003","trangThaiLucDat":"PENDING","maGiamGia":"WELCOME10","giamGia":300000,"maHttpHuy":200,"trangThaiSauHuy":"CANCELLED","paymentStatusSauHuy":"PENDING","tonKho":{"truocDat":5,"sauDat":3,"sauHuy":5},"usageCount":{"truocDat":0,"sauDat":1,"sauHuy":0},"soKhoCuaDon":[{"type":"ADJUST","quantityChange":2,"quantityAfter":5,"note":"Hoàn kho do huỷ đơn PCZ20261013-0003"},{"type":"EXPORT","quantityChange":-2,"quantityAfter":3,"note":"Xuất kho theo đơn PCZ20261013-0003"}],"lichSuCuoi":{"status":"CANCELLED","note":"Khách tự huỷ đơn","createdAt":"2026-10-12T23:22:48.642Z"}}
  ok 2 tests\order-edge-cases.spec.ts:197:1 › TC17 - khách tự huỷ đơn Chờ xác nhận có mã giảm giá: hoàn kho, trả lượt mã (1.4s)
[KET-QUA] {"ca":"TC18","orderCode":"PCZ20261013-0004","trangThaiTruocHuy":"PACKING","maHttpHuy":200,"trangThaiSauHuy":"CANCELLED","paymentStatus":{"truocHuy":"PENDING","sauHuy":"PENDING"},"tonKho":{"truocDat":5,"dangDongGoi":4,"sauHuy":5},"soKhoCuaDon":[{"type":"ADJUST","quantityChange":1,"quantityAfter":5,"note":"Hoàn kho do nhân viên huỷ đơn PCZ20261013-0004"},{"type":"EXPORT","quantityChange":-1,"quantityAfter":4,"note":"Xuất kho theo đơn PCZ20261013-0004"}],"lichSuCuoi":{"status":"CANCELLED","note":"TC18 e2e: khách gọi điện đổi ý (1791847369595)","changedByName":"Quản trị viên PCZone","createdAt":"2026-10-12T23:22:49.844Z"}}
  ok 3 tests\order-edge-cases.spec.ts:246:1 › TC18 - nhân viên huỷ đơn đang đóng gói, có lý do: hoàn kho, ghi lịch sử, không tự hoàn tiền (1.1s)
[KET-QUA] {"ca":"TC19","orderCode":"PCZ20261013-0005","trangThaiTruoc":"SHIPPING","maHttpHoanTra":200,"trangThaiSau":"RETURNED","paymentStatus":{"truoc":"PENDING","sau":"PENDING"},"tonKho":{"truocDat":5,"dangGiao":4,"sauHoanTra":5},"soKhoCuaDon":[{"type":"RETURN","quantityChange":1,"quantityAfter":5,"note":"Khách trả hàng — đơn PCZ20261013-0005"},{"type":"EXPORT","quantityChange":-1,"quantityAfter":4,"note":"Xuất kho theo đơn PCZ20261013-0005"}],"lichSuCuoi":{"status":"RETURNED","note":"TC19 e2e: giao không thành công, hàng về kho","changedByName":"Quản trị viên PCZone","createdAt":"2026-10-12T23:22:51.026Z"}}
  ok 4 tests\order-edge-cases.spec.ts:291:1 › TC19 - hoàn trả đơn đang giao: Đã hoàn trả, hoàn kho loại RETURN (1.2s)
[KET-QUA] {"ca":"TC20","orderCode":"PCZ20261013-0006","trangThaiDon":"PENDING","maHttp":409,"phanHoi":{"error":"HttpError","message":"Chỉ đánh dấu hoàn tiền cho đơn đã huỷ hoặc đã hoàn, và đã từng thu tiền thành công."},"paymentStatus":{"truoc":"PENDING","sau":"PENDING"}}
  ok 5 tests\order-edge-cases.spec.ts:333:1 › TC20 - ghi nhận hoàn tiền cho đơn chưa thu tiền bị từ chối (409) (894ms)


  1) tests\order-edge-cases.spec.ts:155:1 › TC16 - 10 khách đặt cùng lúc sản phẩm chỉ còn 1 ────────

    Error: 9 yêu cầu nhận 409

    expect(received).toBe(expected) // Object.is equality

    Expected: 9
    Received: 1

      189 |
      190 |   expect.soft(created, "đúng 1 đơn được tạo").toHaveLength(1);
    > 191 |   expect.soft(statusCount[409] ?? 0, `${RACE_CUSTOMERS - 1} yêu cầu nhận 409`).toBe(RACE_CUSTOMERS - 1);
          |                                                                                ^
      192 |   expect.soft(stockAfter, "tồn kho cuối").toBe(0);
      193 |   expect.soft(exportRows, "đúng 1 dòng EXPORT trong lượt này").toHaveLength(1);
      194 |   if (exportRows.length === 1 && createdCodes.length === 1) expect.soft(exportRows[0].orderCode).toBe(createdCodes[0]);
        at C:\Users\QUANG\Documents\Do_An\pczone\apps\e2e\tests\order-edge-cases.spec.ts:191:80

    Error Context: test-results\order-edge-cases-TC16---10-3acfd-cùng-lúc-sản-phẩm-chỉ-còn-1\error-context.md

  1 failed
    tests\order-edge-cases.spec.ts:155:1 › TC16 - 10 khách đặt cùng lúc sản phẩm chỉ còn 1 ─────────
  4 passed (27.7s)
```

Log API trong cùng lần chạy có **8** khối lỗi giống hệt nhau (đếm bằng `grep -c P2034`). Khối đầu tiên, nguyên văn:

```
[WebServer] Lỗi không lường trước: PrismaClientKnownRequestError: 
[WebServer] Invalid `tx.order.create()` invocation in
[WebServer] C:\Users\QUANG\Documents\Do_An\pczone\apps\api\src\services\order.service.ts:122:32
[WebServer] 
[WebServer]   119 for (let attempt = 0; attempt < ORDER_CODE_RETRY; attempt++) {
[WebServer]   120   const orderCode = await generateOrderCode(tx, attempt);
[WebServer]   121   try {
[WebServer] → 122     order = await tx.order.create(
[WebServer] Transaction failed due to a write conflict or a deadlock. Please retry your transaction
[WebServer]     at ei.handleRequestError (C:\Users\QUANG\Documents\Do_An\pczone\node_modules\@prisma\client\src\runtime\RequestHandler.ts:228:13)
[WebServer]     at ei.handleAndLogRequestError (C:\Users\QUANG\Documents\Do_An\pczone\node_modules\@prisma\client\src\runtime\RequestHandler.ts:174:12)
[WebServer]     at ei.request (C:\Users\QUANG\Documents\Do_An\pczone\node_modules\@prisma\client\src\runtime\RequestHandler.ts:143:12)
[WebServer]     at async a (C:\Users\QUANG\Documents\Do_An\pczone\node_modules\@prisma\client\src\runtime\getPrismaClient.ts:833:24)
[WebServer]     at async <anonymous> (C:\Users\QUANG\Documents\Do_An\pczone\apps\api\src\services\order.service.ts:122:17)
[WebServer]     at async Proxy._transactionWithCallback (C:\Users\QUANG\Documents\Do_An\pczone\node_modules\@prisma\client\src\runtime\getPrismaClient.ts:722:18)
[WebServer]     at async createOrder (C:\Users\QUANG\Documents\Do_An\pczone\apps\api\src\services\order.service.ts:234:31)
[WebServer]     at async <anonymous> (C:\Users\QUANG\Documents\Do_An\pczone\apps\api\src\routes\orders.routes.ts:64:20) {
[WebServer]   code: 'P2034',
[WebServer]   meta: { modelName: 'Order' },
[WebServer]   clientVersion: '6.19.3'
[WebServer] }
```

## 4. Các chỗ đã chỉnh so với mã mẫu D.5

| Mã mẫu D.5 | Đã chỉnh thành | Lý do (theo mã thật) |
|---|---|---|
| `API = "http://localhost:4101"`, `ORIGIN = "http://localhost:3101"` | Lấy `API_URL`, `WEB_URL` từ `apps/e2e/e2e-env.ts`, tức `http://127.0.0.1:4101` / `:3101` | Dùng chung cổng với cấu hình e2e. `CORS_ORIGIN` của API e2e là đúng `http://127.0.0.1:3101`; Origin `localhost:3101` không nằm trong danh sách nên `originGuard` sẽ trả 403 |
| `unwrap(res)` đọc `b.data ?? b` | Đọc thẳng JSON | API trả thẳng DTO, không bọc trong `data` |
| `pickProduct`: `GET /api/admin/products?status=ACTIVE&pageSize=1`, lấy sản phẩm đầu | Lấy id theo slug cố định qua `GET /api/products/:slug` (2 sản phẩm mẫu không test nào khác dùng) | Sản phẩm đầu danh sách có thể là sản phẩm test khác đang dùng; cần sản phẩm cố định để sổ kho dễ đối chiếu |
| `setStock`: body `{ type: "ADJUST", quantity, note }` | `{ type: "ADJUST", newQuantity, note }` | Schema Zod `inventoryBody` (admin-products.routes.ts): nhánh ADJUST dùng `newQuantity` (số kiểm kê), không phải `quantity` |
| `stockOf`: đọc `(b.product ?? b).inventoryQuantity` | Đọc `inventoryQuantity` của `GET /api/admin/products/:id` | `AdminProductDetailDto` trả thẳng `inventoryQuantity` |
| `newCustomer`: email `e2e+tag-…`, mật khẩu cố định `Passw0rd!23` | `uniqueEmail(tag)` và `randomPassword()` của `tests/helpers.ts` | Dùng chung quy ước email và mật khẩu của bộ e2e (không trùng giữa các lượt) |
| `POST /api/addresses`: id đọc ở `(addr.address ?? addr).id` | Giữ route và body (`TEST_ADDRESS` của helpers), kiểm HTTP 201, đọc `address.id ?? id` | Đúng route; body theo `addressInputSchema` |
| `placeOrder`: `{ addressId, paymentMethod: "COD" }` (đánh dấu CHỈNH) | Giữ nguyên, thêm `voucherCode` khi cần (TC17) | Đúng `createOrderBody`: `addressId` hoặc `newAddress`, `paymentMethod`, `voucherCode` tuỳ chọn |
| `orderCodeOf`: `(b.order ?? b).orderCode` | `body.order.orderCode`, kèm kiểm HTTP 201 | `CreateOrderResultDto = { order, payUrl? }` |
| `moveAdmin`: `PATCH .../status { status }` | Giữ nguyên (`advance`) | Đúng `statusBody` (`status`, `note` tuỳ chọn); mỗi lần chỉ tiến 1 bước |
| `POST /api/orders/:code/cancel { }` | Giữ nguyên | Đúng `cancelBody` (`reason` tuỳ chọn) |
| `POST /api/admin/orders/:code/cancel { reason: "e2e" }` | Giữ route, lý do có nội dung riêng, và kiểm lý do đó xuất hiện trong lịch sử | Đúng `reasonBody`. Lý do riêng để chứng minh lịch sử ghi đúng lý do đã nhập |
| `POST /api/admin/orders/:code/return { reason }` | Giữ nguyên | Đúng route và `reasonBody` |
| `POST /api/admin/orders/:code/mark-refunded { }` | Giữ nguyên | Đúng route (`noteBody`, `note` tuỳ chọn) |
| Tài khoản quản trị `admin@pczone.vn / admin123` (CHỈNH: OWNER của e2e) | Giữ nguyên | Đúng `SEED_ADMIN` trong `tests/helpers.ts`; seed tạo vai trò ADMIN, có quyền `orders:write`, `products:write`, `vouchers:read` |
| `test.describe.configure({ mode: "serial" })` | **Bỏ** | Ở lần chạy 1, TC16 không đạt làm TC17–TC20 bị bỏ qua ("did not run"). Các ca độc lập (mỗi ca tự đặt tồn kho, tự tạo khách) và cấu hình chạy 1 worker nên vẫn tuần tự |
| TC16 chỉ kiểm số 201/409 và tồn kho | Thêm kiểm **sổ kho có đúng 1 dòng EXPORT** trong lượt này và dòng đó thuộc đúng đơn được tạo | Theo kỳ vọng của Bảng 5.9 |
| TC17: đơn **không** dùng mã, chỉ kiểm tồn kho | Đơn dùng mã **WELCOME10**, 2 sản phẩm; kiểm usageCount trước/sau đặt/sau huỷ, dòng sổ kho hoàn +2, trạng thái CANCELLED | Bảng 5.9 yêu cầu "đơn có mã giảm giá" và "lượt dùng mã được trả"; mã mẫu thiếu phần này |
| TC18, TC19 chỉ kiểm tồn kho | Thêm kiểm trạng thái, lịch sử (người thực hiện, lý do), paymentStatus không đổi (TC18), dòng sổ kho loại RETURN (TC19) | Theo kỳ vọng của Bảng 5.9 |
| TC20 chỉ kiểm 409 | Thêm kiểm paymentStatus trước = PENDING và không đổi sau | Theo kỳ vọng "paymentStatus không đổi" |
| `expect(...)` | `expect.soft(...)` cho các kỳ vọng chính, kèm một dòng `[KET-QUA] {...}` in số liệu thật trước khi so | Một điều kiện sai không che mất các điều kiện khác, và ca không đạt vẫn có đủ số liệu để ghi báo cáo |
| Số khách TC16 cố định 10 | Mặc định 10; đổi được qua biến môi trường `E2E_TC16_CUSTOMERS` | Phòng trường hợp phải giảm xuống 5 khi gặp 429 (thực tế không cần) |

Ngoài ra tôi tạo `apps/e2e/playwright.api-only.config.ts` theo yêu cầu. Cấu hình này giống `playwright.config.ts` ở phần webServer của API (cùng lệnh `prepare-db.mjs && tsx src/server.ts`, cùng biến môi trường, CSDL `pczone_e2e`, cổng 4101). Khác ở chỗ: không có webServer web, `testMatch` chỉ `order-edge-cases.spec.ts`, `baseURL` là API, header Origin là WEB_URL, không có project setup và không có globalTeardown (vì không build web).

## 5. Tổng số ca đầu-cuối theo `--list` (cấu hình chính `playwright.config.ts`)

- `npx playwright test --list --project=chromium` **báo lỗi**, vì cấu hình chính không có project tên "chromium". Nguyên văn:

```
Error: Project(s) "chromium" not found. Available projects: "setup", "e2e"
```

- Chạy lại không lọc project (`npx playwright test --list`, và `--project=e2e` cho cùng kết quả vì e2e phụ thuộc setup): **`Total: 61 tests in 9 files`**.
  - Project setup: 1 ca (`reset-state.setup.ts`). Project e2e: 60 ca.
  - Trong 60 ca e2e có **5 ca mới** của `order-edge-cases.spec.ts` (TC16–TC20). Trước khi thêm tệp này là 56 ca (55 ca e2e + 1 setup).
  - Chia theo tệp: accessibility 39, storefront 5, order-edge-cases 5, security 4, seo-headers 4, admin-settings 1, build-pc 1, order-lifecycle 1, reset-state.setup 1.
- Lưu ý: `testMatch` của cấu hình chính là `.*\.spec\.ts`, nên `npm run test:e2e` cũng chạy 5 ca mới. Với mã hiện tại, TC16 sẽ không đạt ở đó.

## 6. Sự cố và các điểm làm khác hướng dẫn

1. **Đã chạy 2 lần.**
   - Lần 1 (06:20:42): TC16 không đạt (201×1, 409×1, 500×8, đơn PCZ20261013-0001, tồn kho 1 → 0, 1 dòng EXPORT); TC17–TC20 **không chạy** vì chế độ serial lấy từ D.5.
   - Tôi chỉ bỏ chế độ serial; kỳ vọng của TC16 giữ nguyên.
   - Lần 2 là lần chạy cuối. Hai lần cho cùng kết quả TC16. Theo hướng dẫn, khi test đã chạy được mà ca vẫn không đạt thì dừng sửa và ghi nhận.
2. Lần 1 tự tạo CSDL `pczone_e2e` (trước đó chưa có) qua `prepare-db.mjs`: migrate deploy và seed, đúng cách cấu hình e2e vẫn làm. Mỗi lần chạy, prepare-db nạp lại seed, nên tồn kho sản phẩm mẫu được đưa về số ban đầu. Các đơn của lượt trước được giữ lại, nên mã đơn đánh số tiếp từ 0001.
3. Hướng dẫn bước 7 ghi `--project=chromium`, nhưng cấu hình chính không có project này. Tôi ghi lỗi nguyên văn và báo số theo `--list` không lọc (mục 5).
4. Không cần giảm TC16 xuống 5 khách vì không gặp 429.
5. Mã mẫu D.5 dùng Origin `localhost:3101`. Thực tế phải dùng `127.0.0.1:3101`, vì đó mới là giá trị có trong CORS_ORIGIN của API e2e (mục 4).
6. Ngoài 2 tệp mới trong apps/e2e, không tệp nào trong repo bị sửa vì nhiệm vụ này. Thư mục `apps/e2e/test-results/` do Playwright tạo đã có trong `.gitignore`. Các thay đổi khác đang có trong `git status` (sơ đồ ERD, các file đánh giá AI, `ket-qua-gui-di/`) là của nhiệm vụ trước.
7. API e2e do Playwright tự bật và tự tắt sau mỗi lần chạy. Không bật web, không build web.
8. Kiểm số liệu: dùng API quản trị (trong test) và SELECT trực tiếp trên `pczone_e2e` (mục 2). Không chạy câu ghi nào trên CSDL.

## Các tệp cần gửi đi

- `C:\Users\QUANG\Documents\Do_An\pczone\ket-qua-kiem-thu-don-hang.md` (tệp này)
- `C:\Users\QUANG\Documents\Do_An\pczone\apps\e2e\tests\order-edge-cases.spec.ts`
- (tham khảo thêm) `C:\Users\QUANG\Documents\Do_An\pczone\apps\e2e\playwright.api-only.config.ts`
