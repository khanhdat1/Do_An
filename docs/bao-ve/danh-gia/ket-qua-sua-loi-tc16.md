# Sửa lỗi TC16 (đặt hàng đồng thời trả 500 thay vì 409)

Người thực hiện: Claude Code, trên máy Windows của nhóm. Báo cáo Word không bị sửa. Chưa commit; nhóm tự xem diff và commit.

## 1. Thông tin và thay đổi mã

- **Thời gian:** 2026-10-13, bắt đầu 06:36. Các lần chạy kiểm chứng từ 06:38:37 đến 06:40:05 (+07).
- **Commit gốc:** `d322a67` (chưa có commit mới).
- **Tệp đã sửa / thêm:**
  - `apps/api/src/services/order.service.ts` (sửa): `createOrder` gọi `runCreateOrder` qua `retryOnTransactionConflict`.
  - `apps/api/src/utils/prisma-errors.ts` (sửa, thêm 2 hàm tiện ích nhỏ): `isTransactionConflict` nhận diện P2034, và `retryOnTransactionConflict` chạy lại TOÀN BỘ transaction khi gặp P2034, tối đa 5 lần, nghỉ ngẫu nhiên 20–80 ms × số lần đã thử. Tôi để 2 hàm ở đây vì tệp này đã chứa `isUniqueViolation` (P2002), cùng nhóm tiện ích nhận diện lỗi Prisma.
  - `apps/api/src/utils/prisma-errors.test.ts` (thêm): kiểm thử đơn vị cho 2 hàm trên, viết theo mẫu `check()` của các tệp `*.test.ts` sẵn có.
- **Cách sửa:** đúng như đề xuất. Không đổi thông báo lỗi, không đổi định dạng mã đơn, giữ nguyên vòng thử lại P2002 bên trong transaction.
  - Khi MySQL huỷ transaction vì deadlock, `createOrder` chạy lại từ đầu.
  - Lượt chạy lại đọc lại giỏ hàng và tồn kho. Nếu đã có người khác mua mất món cuối, yêu cầu nhận `ConflictError` (409) như thiết kế ban đầu.
  - Nếu deadlock lặp lại đủ 5 lần, lỗi P2034 vẫn được ném ra và thành 500 như trước; trường hợp này không xảy ra trong 3 lần chạy.

### git diff đầy đủ

```diff
diff --git a/apps/api/src/services/order.service.ts b/apps/api/src/services/order.service.ts
index ff39b4c..fbff800 100644
--- a/apps/api/src/services/order.service.ts
+++ b/apps/api/src/services/order.service.ts
@@ -5,7 +5,7 @@ import { publicImages } from "../mappers/product.mapper.js";
 import { ConflictError, NotFoundError } from "../middleware/errors.js";
 import type { CreateOrderResultDto, OrderDto, OrderGroupDto, Paginated, OrderSummaryDto, ShippingSettingsDto } from "../types/dto.js";
 import { generateOrderCode } from "../utils/order-code.js";
-import { isUniqueViolation } from "../utils/prisma-errors.js";
+import { isUniqueViolation, retryOnTransactionConflict } from "../utils/prisma-errors.js";
 import { calcShippingFee } from "../utils/shipping.js";
 import { ORDER_GROUP_STATUSES } from "./account.service.js";
 import { createAddress, type AddressInput } from "./address.service.js";
@@ -231,7 +231,9 @@ export async function createOrder(input: CreateOrderInput): Promise<CreateOrderR
   const settings = await getSettings();
   assertPaymentMethodEnabled(settings.payments, input.paymentMethod);
 
-  const { orderId, payUrl } = await runCreateOrder(input, settings.shipping);
+  // Nhiều khách đặt cùng lúc có thể cùng sinh một `orderCode` (mã theo số đơn trong ngày) → InnoDB báo deadlock (P2034)
+  // và huỷ cả transaction. Chạy lại từ đầu: lượt sau đọc lại giỏ + tồn kho, ai hết hàng sẽ nhận 409 như thiết kế thay vì 500
+  const { orderId, payUrl } = await retryOnTransactionConflict(() => runCreateOrder(input, settings.shipping));
   const row = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
   return { order: toOrderDto(row), payUrl };
 }
diff --git a/apps/api/src/utils/prisma-errors.ts b/apps/api/src/utils/prisma-errors.ts
index a3e03dd..f3033d9 100644
--- a/apps/api/src/utils/prisma-errors.ts
+++ b/apps/api/src/utils/prisma-errors.ts
@@ -4,3 +4,33 @@ import { Prisma } from "@pczone/db";
 export function isUniqueViolation(error: unknown): boolean {
   return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
 }
+
+/**
+ * P2034 = transaction bị huỷ vì xung đột ghi hoặc deadlock (MySQL InnoDB chọn transaction này làm "nạn nhân").
+ * Toàn bộ transaction đã bị rollback ở phía DB, nên theo tài liệu Prisma cách xử lý đúng là chạy lại CẢ transaction.
+ */
+export function isTransactionConflict(error: unknown): boolean {
+  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
+}
+
+const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
+
+/**
+ * Chạy `run` (một transaction trọn vẹn), gặp P2034 thì chạy lại từ đầu — tối đa `attempts` lần, nghỉ ngắn có ngẫu
+ * nhiên tăng dần giữa các lần (20–80 ms × số lần đã thử) để các transaction đang tranh nhau không lại đụng nhau đúng
+ * cùng lúc. Lỗi khác, hoặc hết lượt thử, thì ném ra nguyên vẹn. `wait` chỉ để kiểm thử thay bằng hàm không chờ.
+ */
+export async function retryOnTransactionConflict<T>(
+  run: () => Promise<T>,
+  attempts = 5,
+  wait: (ms: number) => Promise<void> = sleep,
+): Promise<T> {
+  for (let attempt = 1; ; attempt++) {
+    try {
+      return await run();
+    } catch (error) {
+      if (!isTransactionConflict(error) || attempt >= attempts) throw error;
+      await wait((20 + Math.random() * 60) * attempt);
+    }
+  }
+}
diff --git a/apps/api/src/utils/prisma-errors.test.ts b/apps/api/src/utils/prisma-errors.test.ts
new file mode 100644
index 0000000..0822bd4
--- /dev/null
+++ b/apps/api/src/utils/prisma-errors.test.ts
@@ -0,0 +1,83 @@
+// Kiểm thử nhận diện lỗi Prisma và thử lại transaction khi deadlock. Chạy: npx tsx src/utils/prisma-errors.test.ts
+import { Prisma } from "@pczone/db";
+import { isTransactionConflict, isUniqueViolation, retryOnTransactionConflict } from "./prisma-errors.js";
+
+let passed = 0;
+let failed = 0;
+
+function check(label: string, actual: unknown, expected: unknown) {
+  const a = JSON.stringify(actual);
+  const e = JSON.stringify(expected);
+  if (a === e) {
+    console.log(`  ✓ ${label}`);
+    passed++;
+  } else {
+    console.log(`  ✗ ${label}\n      mong đợi: ${e}\n      nhận được: ${a}`);
+    failed++;
+  }
+}
+
+const prismaError = (code: string) =>
+  new Prisma.PrismaClientKnownRequestError(`lỗi giả lập ${code}`, { code, clientVersion: "test" });
+const deadlock = () => prismaError("P2034");
+const noWait = async () => {};
+
+console.log("\n[1] Nhận diện mã lỗi");
+check("P2034 là xung đột transaction", isTransactionConflict(deadlock()), true);
+check("P2002 không phải xung đột transaction", isTransactionConflict(prismaError("P2002")), false);
+check("Error thường không phải xung đột transaction", isTransactionConflict(new Error("P2034")), false);
+check("chuỗi/undefined không phải xung đột transaction", [isTransactionConflict("P2034"), isTransactionConflict(undefined)], [false, false]);
+check("P2002 vẫn là vi phạm unique", isUniqueViolation(prismaError("P2002")), true);
+check("P2034 không phải vi phạm unique", isUniqueViolation(deadlock()), false);
+
+console.log("\n[2] Thử lại cả transaction khi gặp P2034");
+{
+  let calls = 0;
+  const result = await retryOnTransactionConflict(async () => {
+    calls++;
+    if (calls < 3) throw deadlock();
+    return "ok";
+  }, 5, noWait);
+  check("deadlock 2 lần rồi thành công → trả kết quả lần 3", { result, calls }, { result: "ok", calls: 3 });
+}
+{
+  let calls = 0;
+  let caught: unknown;
+  try {
+    await retryOnTransactionConflict(async () => {
+      calls++;
+      throw deadlock();
+    }, 5, noWait);
+  } catch (error) {
+    caught = error;
+  }
+  check("deadlock mãi → dừng sau đúng 5 lần và ném lại P2034", { calls, conflict: isTransactionConflict(caught) }, { calls: 5, conflict: true });
+}
+{
+  let calls = 0;
+  let caught: unknown;
+  try {
+    await retryOnTransactionConflict(async () => {
+      calls++;
+      throw new Error("hết hàng (ConflictError)");
+    }, 5, noWait);
+  } catch (error) {
+    caught = error;
+  }
+  check("lỗi khác (vd hết hàng) → không thử lại, ném nguyên vẹn", { calls, message: (caught as Error).message }, { calls: 1, message: "hết hàng (ConflictError)" });
+}
+{
+  const waits: number[] = [];
+  let calls = 0;
+  await retryOnTransactionConflict(async () => {
+    calls++;
+    if (calls < 4) throw deadlock();
+    return calls;
+  }, 5, async (ms) => {
+    waits.push(ms);
+  });
+  check("có nghỉ giữa các lần, trong khoảng 20–80 ms × số lần", waits.map((ms, i) => ms >= 20 * (i + 1) && ms <= 80 * (i + 1)), [true, true, true]);
+}
+
+console.log(`\n===== ${passed} pass / ${failed} fail =====`);
+if (failed > 0) process.exit(1);
```

(Tệp `prisma-errors.test.ts` chưa được git theo dõi, nên phần diff của nó lấy bằng `git diff --no-index /dev/null <tệp>`.)

## 2. Typecheck và kiểm thử đơn vị

- `npm run typecheck` trong `apps/api` (`tsc -p tsconfig.json --noEmit`): **sạch**, exit 0, không có lỗi.
- `npm test -w @pczone/api`: **465/465 đạt**, 0 lỗi, exit 0. Script chạy 15 tệp; số đạt từng tệp theo thứ tự trong script: 87, 25, 9, 20, 8, 22, 9, 10, 61, 66, 7, 28, 46, 57, 10.
- Ca kiểm thử mới `src/utils/prisma-errors.test.ts`: **10/10 đạt**, chạy riêng bằng `npx tsx apps/api/src/utils/prisma-errors.test.ts`. Tên các ca:
  1. P2034 là xung đột transaction
  2. P2002 không phải xung đột transaction
  3. Error thường không phải xung đột transaction
  4. chuỗi/undefined không phải xung đột transaction
  5. P2002 vẫn là vi phạm unique
  6. P2034 không phải vi phạm unique
  7. deadlock 2 lần rồi thành công → trả kết quả lần 3
  8. deadlock mãi → dừng sau đúng 5 lần và ném lại P2034
  9. lỗi khác (vd hết hàng) → không thử lại, ném nguyên vẹn
  10. có nghỉ giữa các lần, trong khoảng 20–80 ms × số lần
- **Lưu ý:** script `test` trong `apps/api/package.json` liệt kê từng tệp, nên tệp test mới **chưa** được `npm test` chạy. Tôi không sửa package.json vì quy tắc chỉ cho sửa `order.service.ts` và thêm tiện ích nhỏ. Muốn đưa vào thì thêm `&& tsx src/utils/prisma-errors.test.ts` vào cuối script `test`.

## 3. Kết quả chạy lại TC16–TC20 (`npx playwright test -c playwright.api-only.config.ts`)

| Lần | Giờ bắt đầu | Mã HTTP | Số đơn tạo được | Tồn kho trước → sau | Số dòng EXPORT trong lượt | Kết quả |
|---|---|---|---|---|---|---|
| 1 (cả 5 ca) | 06:38:37 | **201 × 1, 409 × 9, 500 × 0** | 1 (`PCZ20261013-0007`) | 1 → 0 | 1 (`EXPORT −1`, còn 0, đơn 0007) | Đạt |
| 2 (`-g TC16`) | 06:39:13 | **201 × 1, 409 × 9, 500 × 0** | 1 (`PCZ20261013-0012`) | 1 → 0 | 1 (`EXPORT −1`, còn 0, đơn 0012) | Đạt |
| 3 (`-g TC16`) | 06:39:38 | **201 × 1, 409 × 9, 500 × 0** | 1 (`PCZ20261013-0013`) | 1 → 0 | 1 (`EXPORT −1`, còn 0, đơn 0013) | Đạt |

Trước khi sửa (phiên trước, 2 lần chạy): 201 × 1, 409 × 1, **500 × 8**.

Trong cả 3 lần, 9 yêu cầu 409 nhận một trong hai thông báo có sẵn:
- "…không còn đủ số lượng. Vui lòng quay lại giỏ hàng để kiểm tra." (kiểm tồn kho ở đầu transaction);
- "…vừa hết hàng. Vui lòng quay lại giỏ hàng để kiểm tra." (câu lệnh trừ kho có điều kiện).

Log API của cả 3 lần không có dòng P2034 nào và không có lỗi 500 ("Lỗi không lường trước") nào.

**TC17–TC20 ở lần chạy 1** (vẫn đạt như trước khi sửa):

| Mã | Kết quả |
|---|---|
| TC17 | Đơn `PCZ20261013-0008` dùng WELCOME10, giảm 300.000đ. Khách huỷ: HTTP 200, đơn CANCELLED. Tồn kho 5 → 3 → 5. usageCount 0 → 1 → 0. Sổ kho: EXPORT −2, ADJUST +2 ("Hoàn kho do huỷ đơn…"). **Đạt** |
| TC18 | Đơn `PCZ20261013-0009` đi PENDING → CONFIRMED → PACKING. Nhân viên huỷ: HTTP 200, đơn CANCELLED. Tồn kho 5 → 4 → 5. Sổ kho ADJUST +1. Lịch sử ghi "Quản trị viên PCZone" và lý do "TC18 e2e: khách gọi điện đổi ý (1791848342814)". paymentStatus PENDING → PENDING. **Đạt** |
| TC19 | Đơn `PCZ20261013-0010` đi tới SHIPPING. Hoàn trả: HTTP 200, đơn RETURNED. Tồn kho 5 → 4 → 5. Sổ kho **RETURN +1**. paymentStatus PENDING → PENDING. **Đạt** |
| TC20 | Đơn `PCZ20261013-0011` (PENDING / PENDING). mark-refunded: **HTTP 409**, "Chỉ đánh dấu hoàn tiền cho đơn đã huỷ hoặc đã hoàn, và đã từng thu tiền thành công." paymentStatus PENDING → PENDING. **Đạt** |

### Đối chiếu CSDL `pczone_e2e` (chỉ SELECT): sổ kho và đơn của sản phẩm TC16 trong 3 lần chạy

```
+--------+----------------+---------------+------------------+-------------------------+
| type   | quantityChange | quantityAfter | orderCode        | createdAt               |
+--------+----------------+---------------+------------------+-------------------------+
| ADJUST |            -37 |             1 | NULL             | 2026-10-12 23:38:59.873 |
| EXPORT |             -1 |             0 | PCZ20261013-0007 | 2026-10-12 23:39:00.536 |
| ADJUST |            -37 |             1 | NULL             | 2026-10-12 23:39:36.548 |
| EXPORT |             -1 |             0 | PCZ20261013-0012 | 2026-10-12 23:39:37.689 |
| ADJUST |            -37 |             1 | NULL             | 2026-10-12 23:40:03.701 |
| EXPORT |             -1 |             0 | PCZ20261013-0013 | 2026-10-12 23:40:04.373 |
+--------+----------------+---------------+------------------+-------------------------+
+------------------+---------+
| orderCode        | status  |
+------------------+---------+
| PCZ20261013-0007 | PENDING |
| PCZ20261013-0012 | PENDING |
| PCZ20261013-0013 | PENDING |
+------------------+---------+
```

(createdAt theo giờ UTC. Mỗi lần chạy có 1 phiếu ADJUST đưa tồn kho 38 → 1, vì prepare-db nạp lại seed trước mỗi lần chạy, và đúng 1 dòng EXPORT của đơn duy nhất.)

### Kết quả Playwright nguyên văn (bỏ các dòng `[WebServer]`)

Lần 1:

```

Running 5 tests using 1 worker

[KET-QUA] {"ca":"TC16","soKhach":10,"maHttp":{"201":1,"409":9},"donTaoDuoc":["PCZ20261013-0007"],"thongBaoLoi":["\"Ổ cứng SSD Samsung 990 Pro 2TB NVMe M.2\" không còn đủ số lượng. Vui lòng quay lại giỏ hàng để kiểm tra.","\"Ổ cứng SSD Samsung 990 Pro 2TB NVMe M.2\" vừa hết hàng. Vui lòng quay lại giỏ hàng để kiểm tra."],"tonKhoTruoc":1,"tonKhoSau":0,"soKhoExportLuotNay":[{"type":"EXPORT","quantityChange":-1,"quantityAfter":0,"orderCode":"PCZ20261013-0007"}]}
  ok 1 tests\order-edge-cases.spec.ts:155:1 › TC16 - 10 khách đặt cùng lúc sản phẩm chỉ còn 1 (6.5s)
[KET-QUA] {"ca":"TC17","orderCode":"PCZ20261013-0008","trangThaiLucDat":"PENDING","maGiamGia":"WELCOME10","giamGia":300000,"maHttpHuy":200,"trangThaiSauHuy":"CANCELLED","paymentStatusSauHuy":"PENDING","tonKho":{"truocDat":5,"sauDat":3,"sauHuy":5},"usageCount":{"truocDat":0,"sauDat":1,"sauHuy":0},"soKhoCuaDon":[{"type":"ADJUST","quantityChange":2,"quantityAfter":5,"note":"Hoàn kho do huỷ đơn PCZ20261013-0008"},{"type":"EXPORT","quantityChange":-2,"quantityAfter":3,"note":"Xuất kho theo đơn PCZ20261013-0008"}],"lichSuCuoi":{"status":"CANCELLED","note":"Khách tự huỷ đơn","createdAt":"2026-10-12T23:39:01.944Z"}}
  ok 2 tests\order-edge-cases.spec.ts:197:1 › TC17 - khách tự huỷ đơn Chờ xác nhận có mã giảm giá: hoàn kho, trả lượt mã (1.2s)
[KET-QUA] {"ca":"TC18","orderCode":"PCZ20261013-0009","trangThaiTruocHuy":"PACKING","maHttpHuy":200,"trangThaiSauHuy":"CANCELLED","paymentStatus":{"truocHuy":"PENDING","sauHuy":"PENDING"},"tonKho":{"truocDat":5,"dangDongGoi":4,"sauHuy":5},"soKhoCuaDon":[{"type":"ADJUST","quantityChange":1,"quantityAfter":5,"note":"Hoàn kho do nhân viên huỷ đơn PCZ20261013-0009"},{"type":"EXPORT","quantityChange":-1,"quantityAfter":4,"note":"Xuất kho theo đơn PCZ20261013-0009"}],"lichSuCuoi":{"status":"CANCELLED","note":"TC18 e2e: khách gọi điện đổi ý (1791848342814)","changedByName":"Quản trị viên PCZone","createdAt":"2026-10-12T23:39:03.047Z"}}
  ok 3 tests\order-edge-cases.spec.ts:246:1 › TC18 - nhân viên huỷ đơn đang đóng gói, có lý do: hoàn kho, ghi lịch sử, không tự hoàn tiền (1.1s)
[KET-QUA] {"ca":"TC19","orderCode":"PCZ20261013-0010","trangThaiTruoc":"SHIPPING","maHttpHoanTra":200,"trangThaiSau":"RETURNED","paymentStatus":{"truoc":"PENDING","sau":"PENDING"},"tonKho":{"truocDat":5,"dangGiao":4,"sauHoanTra":5},"soKhoCuaDon":[{"type":"RETURN","quantityChange":1,"quantityAfter":5,"note":"Khách trả hàng — đơn PCZ20261013-0010"},{"type":"EXPORT","quantityChange":-1,"quantityAfter":4,"note":"Xuất kho theo đơn PCZ20261013-0010"}],"lichSuCuoi":{"status":"RETURNED","note":"TC19 e2e: giao không thành công, hàng về kho","changedByName":"Quản trị viên PCZone","createdAt":"2026-10-12T23:39:04.116Z"}}
  ok 4 tests\order-edge-cases.spec.ts:291:1 › TC19 - hoàn trả đơn đang giao: Đã hoàn trả, hoàn kho loại RETURN (1.1s)
[KET-QUA] {"ca":"TC20","orderCode":"PCZ20261013-0011","trangThaiDon":"PENDING","maHttp":409,"phanHoi":{"error":"HttpError","message":"Chỉ đánh dấu hoàn tiền cho đơn đã huỷ hoặc đã hoàn, và đã từng thu tiền thành công."},"paymentStatus":{"truoc":"PENDING","sau":"PENDING"}}
  ok 5 tests\order-edge-cases.spec.ts:333:1 › TC20 - ghi nhận hoàn tiền cho đơn chưa thu tiền bị từ chối (409) (851ms)

  5 passed (25.9s)
```

Lần 2:

```

Running 1 test using 1 worker

[KET-QUA] {"ca":"TC16","soKhach":10,"maHttp":{"201":1,"409":9},"donTaoDuoc":["PCZ20261013-0012"],"thongBaoLoi":["\"Ổ cứng SSD Samsung 990 Pro 2TB NVMe M.2\" không còn đủ số lượng. Vui lòng quay lại giỏ hàng để kiểm tra.","\"Ổ cứng SSD Samsung 990 Pro 2TB NVMe M.2\" vừa hết hàng. Vui lòng quay lại giỏ hàng để kiểm tra."],"tonKhoTruoc":1,"tonKhoSau":0,"soKhoExportLuotNay":[{"type":"EXPORT","quantityChange":-1,"quantityAfter":0,"orderCode":"PCZ20261013-0012"}]}
  ok 1 tests\order-edge-cases.spec.ts:155:1 › TC16 - 10 khách đặt cùng lúc sản phẩm chỉ còn 1 (7.8s)

  1 passed (23.0s)
```

Lần 3:

```

Running 1 test using 1 worker

[KET-QUA] {"ca":"TC16","soKhach":10,"maHttp":{"201":1,"409":9},"donTaoDuoc":["PCZ20261013-0013"],"thongBaoLoi":["\"Ổ cứng SSD Samsung 990 Pro 2TB NVMe M.2\" không còn đủ số lượng. Vui lòng quay lại giỏ hàng để kiểm tra.","\"Ổ cứng SSD Samsung 990 Pro 2TB NVMe M.2\" vừa hết hàng. Vui lòng quay lại giỏ hàng để kiểm tra."],"tonKhoTruoc":1,"tonKhoSau":0,"soKhoExportLuotNay":[{"type":"EXPORT","quantityChange":-1,"quantityAfter":0,"orderCode":"PCZ20261013-0013"}]}
  ok 1 tests\order-edge-cases.spec.ts:155:1 › TC16 - 10 khách đặt cùng lúc sản phẩm chỉ còn 1 (6.8s)

  1 passed (23.0s)
```

## 4. Kết luận

**TC16 đạt** ở cả 3 lần chạy: đúng 1 đơn được tạo, 9 yêu cầu nhận 409, không còn 500, tồn kho cuối bằng 0, sổ kho có đúng 1 dòng EXPORT thuộc đơn được tạo. TC17–TC20 vẫn đạt. Như vậy cả 5 ca của Bảng 5.9 đều đạt với mã đã sửa.

## 5. Sự cố và các điểm làm khác hướng dẫn

1. Hàm tiện ích được thêm vào tệp có sẵn `apps/api/src/utils/prisma-errors.ts`, không tạo tệp tiện ích mới, vì tệp này đã là nơi đặt hàm nhận diện lỗi Prisma (`isUniqueViolation`). Tôi tách hàm thử lại ra khỏi `order.service.ts` để kiểm thử đơn vị được mà không cần CSDL. Tham số `wait` chỉ dùng để test thay thời gian chờ.
2. **Tệp test mới chưa được `npm test` chạy** (xem mục 2), vì không được sửa `package.json`.
3. **Không có dòng log nào cho biết bao nhiêu lần đã thử lại:** lỗi P2034 được bắt và thử lại nên không còn hiện trong log, và tôi không thêm log để giữ thay đổi nhỏ. Bằng chứng gián tiếp là thông báo 409 "không còn đủ số lượng" giờ xuất hiện. Thông báo này đến từ bước kiểm tồn kho ở đầu transaction. Lúc 10 yêu cầu bắt đầu, tồn kho đều là 1, nên nó chỉ có thể xuất hiện ở lượt chạy lại sau khi đơn thắng đã trừ kho. Trước khi sửa, thông báo này không xuất hiện. Đây là suy luận từ mã và kết quả.
4. Lần chạy 2 và 3 dùng `-g "TC16"` nên chỉ chạy TC16, đúng yêu cầu "chạy TC16 thêm 2 lần". Mỗi lần, prepare-db vẫn nạp lại seed vào `pczone_e2e`.
5. Không đụng CSDL dev `pczone`; chỉ đọc (SELECT) trên `pczone_e2e`. Không build web, không chạy bộ e2e đầy đủ. Không sửa test TC16–TC20.
6. **`ket-qua-kiem-thu-don-hang.md` (phiên trước) vẫn ghi TC16 "Không đạt"** theo mã cũ. Tôi không sửa tệp đó vì đó là kết quả trước khi sửa lỗi. Khi điền Bảng 5.9, dùng kết quả ở tệp này cho mã đã sửa; có thể nêu cả hai nếu báo cáo muốn kể quá trình phát hiện và sửa lỗi.
7. Chưa commit. `git status` sau phiên này có thêm `M apps/api/src/services/order.service.ts`, `M apps/api/src/utils/prisma-errors.ts` và `?? apps/api/src/utils/prisma-errors.test.ts`, ngoài các thay đổi của các phiên trước.
