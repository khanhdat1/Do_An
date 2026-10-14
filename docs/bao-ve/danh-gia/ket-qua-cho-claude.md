# Kết quả thu thập số liệu cho báo cáo PCZone

Người thu thập: Claude Code, chạy trên máy Windows của nhóm, ngày 13/10/2026. Báo cáo Word không bị sửa.

## 1. Môi trường (bước 1)

- Node: `v24.21.0`
- Ngày giờ bắt đầu: 2026-10-13 04:39:46 +0700
- Commit: `d322a67`
- Trong `.env` ở thư mục gốc:
  - `OPENAI_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai/"`
  - `OPENAI_CHAT_MODEL="gemini-3.1-flash-lite"`
  - `OPENAI_EMBEDDING_MODEL="gemini-embedding-2-preview"`
  - OPENAI_API_KEY: **có**

## 2. Kiểm tra dữ liệu (bước 2)

`npm run db:up`: container `pczone-mysql` báo `Up 2 hours (healthy)`.

```
== SELECT source, status, COUNT(*) FROM Product GROUP BY source, status;
+--------+--------+----------+
| source | status | COUNT(*) |
+--------+--------+----------+
| SEED   | ACTIVE |       14 |
| GEARVN | ACTIVE |      422 |
+--------+--------+----------+
== SELECT COUNT(*) FROM ProductSpec;
+----------+
| COUNT(*) |
+----------+
|       94 |
+----------+
== SELECT model, dimensions, status, COUNT(*) FROM ProductEmbedding GROUP BY model, dimensions, status;
+----------------------------+------------+---------+----------+
| model                      | dimensions | status  | COUNT(*) |
+----------------------------+------------+---------+----------+
| gemini-embedding-2-preview |       3072 | INDEXED |      436 |
+----------------------------+------------+---------+----------+
```

- Tổng số sản phẩm ACTIVE: **436**. Khớp đúng với "khoảng 436 sản phẩm" ở mục 5.6.1, nên có thể bỏ chữ "khoảng".
- ProductSpec = 94, khác 0, nên **không chạy** `npm run db:specs`.

## 3. thong-ke-anh.sql (Bảng 4.7)

Chạy với `--default-character-set=utf8mb4` để tên tiếng Việt không bị lỗi ký tự. Kết quả nguyên văn:

```
+-------------------------------------------------------+
| muc                                                   |
+-------------------------------------------------------+
| --- 1. BANG 4.7: nguon san pham x nguon anh chinh --- |
+-------------------------------------------------------+
+----------------+-----------------+-------------+
| nguon_san_pham | nguon_anh_chinh | so_san_pham |
+----------------+-----------------+-------------+
| GEARVN         | GEARVN          |         422 |
| SEED           | ASUS            |           4 |
| SEED           | UNSPLASH        |           2 |
| SEED           | AMD             |           2 |
| SEED           | SAMSUNG         |           2 |
| SEED           | CORSAIR         |           1 |
| SEED           | LENOVO          |           1 |
| SEED           | GIGABYTE        |           1 |
| SEED           | LOGITECH        |           1 |
+----------------+-----------------+-------------+
+-----------------------------------------+
| muc                                     |
+-----------------------------------------+
| --- 2. san pham dang ban theo nguon --- |
+-----------------------------------------+
+----------------+-------------+
| nguon_san_pham | so_san_pham |
+----------------+-------------+
| GEARVN         |         422 |
| SEED           |          14 |
| TONG           |         436 |
+----------------+-------------+
+-----------------------------------------------+
| muc                                           |
+-----------------------------------------------+
| --- 3. so anh / san pham, anh can xem lai --- |
+-----------------------------------------------+
+----------------+-------------+----------+---------------+-----------------+
| nguon_san_pham | so_san_pham | tong_anh | anh_tb_moi_sp | anh_can_xem_lai |
+----------------+-------------+----------+---------------+-----------------+
| GEARVN         |         422 |     1530 |           3.6 |               0 |
| SEED           |          14 |       53 |           3.8 |               0 |
+----------------+-------------+----------+---------------+-----------------+
```

Tự kiểm a): dòng TONG ở mục 2 là **436**, bằng số sản phẩm ACTIVE ở bước 2 → **khớp**.

## 4. thong-ke-productspec.sql (Bảng 5.8)

Lưu ý: file này ghi mục đích là "Bảng 5.9" và chỉ đếm 6 loại CPU, MAINBOARD, RAM, VGA, CASE, PSU, không có SSD. Theo báo cáo hiện tại, số liệu này thuộc **Bảng 5.8**.

Kết quả nguyên văn:

```
+--------------------------------------+
| muc                                  |
+--------------------------------------+
| --- 1. danh muc -> componentType --- |
+--------------------------------------+
+---------------+--------------------------+-------------------+
| componentType | danh_muc                 | san_pham_dang_ban |
+---------------+--------------------------+-------------------+
| CPU           | CPU – Vi xử lý           |                12 |
| MAINBOARD     | Mainboard                |                14 |
| RAM           | RAM                      |                15 |
| VGA           | VGA – Card đồ họa        |                14 |
| SSD           | Ổ cứng SSD               |                14 |
| PSU           | Nguồn máy tính           |                12 |
| CASE          | Vỏ case                  |                13 |
| MONITOR       | Màn hình                 |                28 |
| KEYBOARD      | Bàn phím                 |                32 |
| MOUSE         | Chuột                    |                31 |
+---------------+--------------------------+-------------------+
+-----------------------------------------+
| muc                                     |
+-----------------------------------------+
| --- 2. BANG 5.9: do phu ProductSpec --- |
+-----------------------------------------+
+-----------+----------+--------------+--------------------+-----------+
| loai      | san_pham | co_dong_spec | du_truong_bat_buoc | ty_le_pct |
+-----------+----------+--------------+--------------------+-----------+
| CPU       |       12 |           12 |                 12 |     100.0 |
| MAINBOARD |       14 |           14 |                 14 |     100.0 |
| RAM       |       15 |           15 |                 15 |     100.0 |
| VGA       |       14 |           14 |                  8 |      57.1 |
| CASE      |       13 |           13 |                  5 |      38.5 |
| PSU       |       12 |           12 |                 12 |     100.0 |
| TONG      |       80 |           80 |                 66 |      82.5 |
+-----------+----------+--------------+--------------------+-----------+
+-----------------------------+
| muc                         |
+-----------------------------+
| --- 3. thieu truong nao --- |
+-----------------------------+
+-----------+-----------------+----------+-------+
| loai      | truong          | san_pham | thieu |
+-----------+-----------------+----------+-------+
| CPU       | congSuat        |       12 |     0 |
| CPU       | hasIgpu         |       12 |     0 |
| CPU       | socket          |       12 |     0 |
| MAINBOARD | formFactor      |       14 |     0 |
| MAINBOARD | ramSlots        |       14 |     0 |
| MAINBOARD | ramType         |       14 |     0 |
| MAINBOARD | socket          |       14 |     0 |
| RAM       | ramModules      |       15 |     0 |
| RAM       | ramType         |       15 |     0 |
| VGA       | gpuLengthMm     |       14 |     1 |
| VGA       | tdpWatts        |       14 |     5 |
| CASE      | caseFormFactors |       13 |     0 |
| CASE      | caseMaxGpuMm    |       13 |     8 |
| PSU       | psuWattage      |       12 |     0 |
+-----------+-----------------+----------+-------+
+---------------------------------+
| muc                             |
+---------------------------------+
| --- 4. ProductSpec sai loai --- |
+---------------------------------+
+---------------+
| spec_sai_loai |
+---------------+
|             0 |
+---------------+
+---------------------------+
| muc                       |
+---------------------------+
| --- 5. gia tri le doi --- |
+---------------------------+
+------------------------------------+---------+---+
| van_de                             | gia_tri | n |
+------------------------------------+---------+---+
| MAINBOARD.socket khong co CPU khop | LGA1700 | 4 |
+------------------------------------+---------+---+
+------------------------------+
| muc                          |
+------------------------------+
| --- 6. mau doi chieu tay --- |
+------------------------------+
+-----------+----------------------------+---------+---------+------------+----------+------------+---------+-------------+--------------+---------------------------------+------------+----------+-----------+
| loai      | sku                        | socket  | ramType | formFactor | ramSlots | ramModules | hasIgpu | gpuLengthMm | caseMaxGpuMm | caseFormFactors                 | psuWattage | tdpWatts | maxPowerW |
+-----------+----------------------------+---------+---------+------------+----------+------------+---------+-------------+--------------+---------------------------------+------------+----------+-----------+
| CPU       | PCZ-CPU-AMD-3AB906         | AM4     | DDR4    | NULL       |     NULL |       NULL |       1 |        NULL |         NULL | NULL                            |       NULL |       65 | NULL      |
| CPU       | PCZ-CPU-INTEL-D8E593       | LGA1851 | DDR5    | NULL       |     NULL |       NULL |       1 |        NULL |         NULL | NULL                            |       NULL |      125 | 159       |
| CPU       | PCZ-CPU-AMD-A5A44E         | AM4     | DDR4    | NULL       |     NULL |       NULL |       1 |        NULL |         NULL | NULL                            |       NULL |       65 | NULL      |
| CPU       | PCZ-CPU-INTEL-E7F110       | LGA1851 | DDR5    | NULL       |     NULL |       NULL |       1 |        NULL |         NULL | NULL                            |       NULL |      125 | 250       |
| MAINBOARD | PCZ-MAINBO-GIGABYTE-93DD92 | LGA1700 | DDR5    | ATX        |        4 |       NULL |    NULL |        NULL |         NULL | NULL                            |       NULL |     NULL | NULL      |
| MAINBOARD | PCZ-MAINBO-GIGABYTE-C52502 | LGA1851 | DDR5    | ATX        |        4 |       NULL |    NULL |        NULL |         NULL | NULL                            |       NULL |     NULL | NULL      |
| MAINBOARD | PCZ-MAINBO-ASUS-31ADA2     | AM5     | DDR5    | ATX        |        4 |       NULL |    NULL |        NULL |         NULL | NULL                            |       NULL |     NULL | NULL      |
| MAINBOARD | PCZ-MAINBO-ASUS-D32988     | AM5     | DDR5    | mATX       |        4 |       NULL |    NULL |        NULL |         NULL | NULL                            |       NULL |     NULL | NULL      |
| RAM       | PCZ-RAM-CORSAIR-403050     | NULL    | DDR5    | NULL       |     NULL |          2 |    NULL |        NULL |         NULL | NULL                            |       NULL |     NULL | NULL      |
| RAM       | PCZ-RAM-TEAMGROU-CAF20D    | NULL    | DDR4    | NULL       |     NULL |          1 |    NULL |        NULL |         NULL | NULL                            |       NULL |     NULL | NULL      |
| RAM       | PCZ-RAM-CORSAIR-06C2AC     | NULL    | DDR5    | NULL       |     NULL |          2 |    NULL |        NULL |         NULL | NULL                            |       NULL |     NULL | NULL      |
| RAM       | PCZ-RAM-TEAMGROU-8601F0    | NULL    | DDR4    | NULL       |     NULL |          1 |    NULL |        NULL |         NULL | NULL                            |       NULL |     NULL | NULL      |
| VGA       | PCZ-VGA-GIGABYTE-BDF822    | NULL    | NULL    | NULL       |     NULL |       NULL |    NULL |         342 |         NULL | NULL                            |       NULL |     NULL | NULL      |
| VGA       | PCZ-VGA-ASUS-A58E19        | NULL    | NULL    | NULL       |     NULL |       NULL |    NULL |         305 |         NULL | NULL                            |       NULL |     NULL | NULL      |
| VGA       | PCZ-VGA-MSI-553405         | NULL    | NULL    | NULL       |     NULL |       NULL |    NULL |         197 |         NULL | NULL                            |       NULL |      115 | NULL      |
| VGA       | PCZ-VGA-GIGABYTE-2720E2    | NULL    | NULL    | NULL       |     NULL |       NULL |    NULL |         208 |         NULL | NULL                            |       NULL |     NULL | NULL      |
| CASE      | PCZ-CASE-NZXT-4B7E20       | NULL    | NULL    | NULL       |     NULL |       NULL |    NULL |        NULL |         NULL | ["E-ATX", "ATX", "mATX", "ITX"] |       NULL |     NULL | NULL      |
| CASE      | PCZ-CASE-MSI-750AA0        | NULL    | NULL    | NULL       |     NULL |       NULL |    NULL |        NULL |          405 | ["E-ATX", "ATX", "mATX", "ITX"] |       NULL |     NULL | NULL      |
| CASE      | PCZ-CASE-CORSAIR-805348    | NULL    | NULL    | NULL       |     NULL |       NULL |    NULL |        NULL |         NULL | ["E-ATX", "ATX", "mATX", "ITX"] |       NULL |     NULL | NULL      |
| CASE      | PCZ-CASE-LIANLI-0A4273     | NULL    | NULL    | NULL       |     NULL |       NULL |    NULL |        NULL |          408 | ["E-ATX", "ATX", "mATX", "ITX"] |       NULL |     NULL | NULL      |
| PSU       | PCZ-PSU-NZXT-DB59A3        | NULL    | NULL    | NULL       |     NULL |       NULL |    NULL |        NULL |         NULL | NULL                            |        750 |     NULL | NULL      |
| PSU       | PCZ-PSU-FSP-BDA031         | NULL    | NULL    | NULL       |     NULL |       NULL |    NULL |        NULL |         NULL | NULL                            |        750 |     NULL | NULL      |
| PSU       | PCZ-PSU-FSP-F1E2C6         | NULL    | NULL    | NULL       |     NULL |       NULL |    NULL |        NULL |         NULL | NULL                            |        650 |     NULL | NULL      |
| PSU       | PCZ-PSU-CORSAIR-18F53C     | NULL    | NULL    | NULL       |     NULL |       NULL |    NULL |        NULL |         NULL | NULL                            |        650 |     NULL | NULL      |
+-----------+----------------------------+---------+---------+------------+----------+------------+---------+-------------+--------------+---------------------------------+------------+----------+-----------+
```

Kết quả mục 2 thiếu SSD và COOLER, nên tôi chạy thêm câu bổ sung (chỉ đọc) trong lời nhắc. Kết quả nguyên văn:

```
+------+----------+---------+-------------------+------------------+----------------+----------------+
| loai | dang_ban | co_spec | storageCapacityGb | storageInterface | coolerHeightMm | coolerTdpWatts |
+------+----------+---------+-------------------+------------------+----------------+----------------+
| SSD  |       14 |      14 |                14 |               14 |              0 |              0 |
+------+----------+---------+-------------------+------------------+----------------+----------------+
```

(Kết quả chỉ có dòng SSD. Không có dòng COOLER vì không có sản phẩm ACTIVE nào thuộc danh mục có componentType = 'COOLER'.)

Tự kiểm:
- b) Mục 1 có **đủ 7 loại** CPU, MAINBOARD, RAM, VGA, SSD, PSU, CASE và loại nào cũng có sản phẩm. Mục 1 còn có MONITOR, KEYBOARD, MOUSE. BUILD_SLOTS trong `apps/api/src/pc-build/slots.ts` dòng 7 là `["CPU", "MAINBOARD", "RAM", "VGA", "SSD", "PSU", "CASE"]`.
- c) Mục 4 `spec_sai_loai` = **0** → đạt.
- d) COOLER: co_spec = **0**. CSDL **không có danh mục tản nhiệt nào** (không danh mục nào gắn componentType = COOLER) và **không có sản phẩm tản nhiệt nào đang bán**. Hàng "Tản nhiệt" ở Bảng 5.8 không có dữ liệu để điền; anh/chị quyết định bỏ hay giữ hàng này.
- Thêm: mục 5 có 1 giá trị lẻ đôi: `MAINBOARD.socket khong co CPU khop | LGA1700 | 4`. Có 4 mainboard LGA1700 nhưng không có CPU LGA1700 nào (CPU Intel trong kho đều là LGA1851).

## 5. Phụ lục C

### 5.1 Đối chiếu với file Word

- File Word: `C:\PCZone-baocao\bao-cao.docx`. Máy không có pandoc, nên tôi chép file ra bản sao `.zip` trong thư mục nháp, giải nén và đọc `word/document.xml`.
- Tìm thấy Bảng C.1 (T01–T20), C.2 (H01–H12) và C.3 (B01–B10), tổng **42 câu**. **Cả 42 câu khớp nguyên văn** với danh sách bản ngày 11/10 trong lời nhắc. Chỗ khác duy nhất là dấu ngoặc ở cột tiêu chí của T17: Word dùng ngoặc cong “rẻ”, lời nhắc dùng ngoặc thẳng. Câu hỏi không khác.
- `cau-hoi.csv`: UTF-8 có BOM, phân cách `;`, cột `ma;loai;nhom;cau_hoi;ky_vong`, đúng 42 dòng dữ liệu, không có dòng `VD-`. Số câu theo nhóm đã chốt: search nhu-cau 8, rang-buoc 7, ten-goi 5; chat tu-van 9, bay 3; build thuong 8, bien 2.

### 5.2 Luật chấm đã chốt

Anh/chị đã duyệt các luật dưới đây **trước** khi chạy bước 5. Không sửa sau khi thấy kết quả.

| Mã | Luật đã chốt | Số SP đúng | Ghi chú |
|---|---|---|---|
| T01 | Cả danh mục Laptop Văn phòng (`laptop-van-phong`) | 80 | |
| T02 | Danh mục `laptop-gaming`, giá bán ≤ 25.000.000 | 1 | Chỉ có ASUS TUF A15 FA507NV (24.490.000đ), nên P@5 tối đa là 0,2 |
| T03 | Chuột, giá ≤ 2.000.000, trường "Kết nối" có Wireless / Không dây / Bluetooth / 2.4 / Đa kết nối | 16 | |
| T04 | VGA, giá bán từ 12.000.000 đến 18.000.000 | 3 | |
| T05 | Màn hình, "Kích thước" bắt đầu bằng 27, số đầu tiên trong "Tần số quét" ≥ 144 | 12 | |
| T06 | Bàn phím, theo trường dữ liệu: "Loại bàn phím" có chữ "cơ" (không tính "giả cơ"); nếu thiếu "Loại" thì xét switch cơ học (Blue/Brown/Cherry MX/Clicky) | 26 | Có tính ROG Falchion Ace 75 HE vì CSDL ghi Loại = "Cơ". Loại 2 ROG Azoth 96 HE (CSDL ghi "Hall Effect (Từ tính)") và 4 AULA "cao su / giả cơ" |
| T07 | Tai nghe có trường "Micro" khác rỗng | 31 | Chỉ loại ROG Kithara, vì CSDL không có trường Micro |
| T08 | Chỉ ghế có chữ "công thái học" trong tên hoặc mô tả ngắn | 12 | |
| T09 | SSD, storageCapacityGb = 1000, giao tiếp NVMe | 5 | |
| T10 | PSU ≥ 750 W, có chuẩn 80 Plus (mọi cấp) | 9 | |
| T11 | Chỉ vỏ case nhận ITX và **không** nhận ATX/E-ATX | 3 | |
| T12 | RAM DDR5, kit 32GB (ramCapacity = 32) | 3 | |
| T13 | Mainboard có socket trùng socket của CPU Ryzen 7 trong CSDL | 5 | **Đã áp dụng: chỉ AM5.** CSDL có 3 CPU Ryzen 7 (7800X3D, 9700X, 9800X3D), cả 3 đều AM5. Không có Ryzen 7 AM4 nên không tính bo B450 (AM4) |
| T14 | CPU hãng Intel | 5 | Cả 5 đều là Core Ultra 200S |
| T15 | `ky_vong` rỗng, **không chấm** (mẫu số Hit@5 là 19) | 0 | Cửa hàng không có tản nhiệt nước; câu này chỉ để quan sát |
| T16 | Danh mục `loa` | 16 | |
| T17 | PC để bàn (pc-gaming / pc-workstation), giá ≤ 20.000.000 | 3 | Cửa hàng không có PC văn phòng riêng |
| T18 | VGA có "RTX" trong tên | 12 | |
| T19 | Chuột hãng Razer | 6 | |
| T20 | Danh mục `ban` | 7 | |
| H08, H09, H10 | `ky_vong` = `TU_CHOI` | | |
| H07 | Câu hỏi: `Card ASUS Dual Radeon RX 6500 XT V2 OC Edition 4GB GDDR6 dài bao nhiêu mm, có vừa vỏ máy không?` | | Đã bỏ chữ "Card màn hình" thừa |

**Card chọn cho H07.** Quy tắc: VGA ACTIVE, gpuLengthMm khác NULL, sắp theo Product.name tăng dần, lấy dòng đầu.
- Tên: `Card màn hình ASUS Dual Radeon RX 6500 XT V2 OC Edition 4GB GDDR6`
- Slug: `card-man-hinh-asus-dual-radeon-rx-6500-xt-v2-oc-edition-4gb-gddr6`
- **gpuLengthMm = 201**

```sql
SELECT p.name, p.slug, s.gpuLengthMm FROM Product p JOIN Category c ON c.id=p.categoryId JOIN ProductSpec s ON s.productId=p.id
WHERE p.status='ACTIVE' AND c.componentType='VGA' AND s.gpuLengthMm IS NOT NULL ORDER BY p.name ASC LIMIT 1;
```

Kiểm tra cho T13 (câu SQL và kết quả nguyên văn):

```
SELECT p.name, s.socket, p.status FROM Product p JOIN Category c ON c.id=p.categoryId LEFT JOIN ProductSpec s ON s.productId=p.id WHERE c.componentType='CPU' AND p.name LIKE '%Ryzen 7%' ORDER BY s.socket, p.name;
+------------------------------------------+--------+--------+
| name                                     | socket | status |
+------------------------------------------+--------+--------+
| CPU AMD Ryzen 7 7800X3D Box Chính Hãng   | AM5    | ACTIVE |
| CPU AMD Ryzen 7 9700X AM5 Zen 5          | AM5    | ACTIVE |
| CPU AMD Ryzen 7 9800X3D                  | AM5    | ACTIVE |
+------------------------------------------+--------+--------+
```

### 5.3 SQL lập danh sách ky_vong (chỉ đọc, theo luật đã chốt)

`ky_vong` của mỗi câu search là danh sách **slug đầy đủ** lấy từ kết quả truy vấn dưới đây, nối với nhau bằng `|`.

```sql
-- De xuat ky_vong T01-T20 (chi doc). Chay voi --default-character-set=utf8mb4.
-- Moi dong: ma, slug, ten, gia (sellingPrice), thong_so dung de quyet dinh.
WITH sp AS (
  SELECT p.id, jt.label, jt.value
  FROM Product p,
       JSON_TABLE(p.specifications, '$[*]' COLUMNS (label VARCHAR(200) PATH '$.label', value VARCHAR(1000) PATH '$.value')) jt
  WHERE p.status = 'ACTIVE' AND JSON_TYPE(p.specifications) = 'ARRAY'
),
base AS (
  SELECT p.id, p.slug, p.name, CAST(p.sellingPrice AS UNSIGNED) AS gia, c.slug AS cat, b.name AS brand,
         p.shortDescription AS sd, s.socket, s.ramType, s.ramCapacity, s.ramModules, s.storageCapacityGb, s.storageInterface,
         s.psuWattage, s.psuEfficiency, s.caseFormFactors,
         (SELECT value FROM sp WHERE sp.id = p.id AND sp.label COLLATE utf8mb4_bin = 'Kết nối' LIMIT 1)       AS ket_noi,
         (SELECT value FROM sp WHERE sp.id = p.id AND sp.label COLLATE utf8mb4_bin = 'Kích thước' LIMIT 1)    AS kich_thuoc,
         (SELECT value FROM sp WHERE sp.id = p.id AND sp.label COLLATE utf8mb4_bin = 'Tần số quét' LIMIT 1)   AS tan_so,
         (SELECT value FROM sp WHERE sp.id = p.id AND sp.label COLLATE utf8mb4_bin = 'Loại bàn phím' LIMIT 1) AS loai_bp,
         (SELECT value FROM sp WHERE sp.id = p.id AND sp.label COLLATE utf8mb4_bin = 'Switch' LIMIT 1)        AS switch_bp,
         (SELECT value FROM sp WHERE sp.id = p.id AND sp.label COLLATE utf8mb4_bin = 'Micro' LIMIT 1)         AS micro
  FROM Product p
  JOIN Category c ON c.id = p.categoryId
  LEFT JOIN Brand b ON b.id = p.brandId
  LEFT JOIN ProductSpec s ON s.productId = p.id
  WHERE p.status = 'ACTIVE'
)
SELECT * FROM (
  -- T01: danh muc Laptop Van phong
  SELECT 'T01' AS ma, slug, name AS ten, gia, CONVERT(CONCAT('danh muc=', cat) USING utf8mb4) COLLATE utf8mb4_bin AS thong_so FROM base WHERE cat = 'laptop-van-phong'
  -- T02: Laptop Gaming, gia <= 25.000.000
  UNION ALL SELECT 'T02', slug, name, gia, CONVERT(CONCAT('danh muc=', cat) USING utf8mb4) COLLATE utf8mb4_bin FROM base WHERE cat = 'laptop-gaming' AND gia <= 25000000
  -- T03: Chuot, gia <= 2.000.000, ket noi khong day (Wireless / Khong day / Bluetooth / 2.4 GHz / Da ket noi)
  UNION ALL SELECT 'T03', slug, name, gia, CONVERT(CONCAT('Ket noi=', ket_noi) USING utf8mb4) COLLATE utf8mb4_bin FROM base
    WHERE cat = 'chuot' AND gia <= 2000000
      AND LOWER(ket_noi) COLLATE utf8mb4_bin REGEXP 'wireless|không dây|bluetooth|2\\.4|đa kết nối'
  -- T04: VGA, 12.000.000 <= gia <= 18.000.000
  UNION ALL SELECT 'T04', slug, name, gia, CONVERT('' USING utf8mb4) COLLATE utf8mb4_bin FROM base WHERE cat = 'vga' AND gia BETWEEN 12000000 AND 18000000
  -- T05: Man hinh 27 inch, so dau tien trong "Tan so quet" >= 144
  UNION ALL SELECT 'T05', slug, name, gia, CONVERT(CONCAT('Kich thuoc=', kich_thuoc, '; Tan so quet=', tan_so) USING utf8mb4) COLLATE utf8mb4_bin FROM base
    WHERE cat = 'man-hinh' AND kich_thuoc LIKE '27%' AND CAST(REGEXP_SUBSTR(tan_so, '[0-9]+') AS UNSIGNED) >= 144
  -- T06: Ban phim co: "Loai ban phim" chua "co" (khong tinh "gia co"); neu thieu "Loai ban phim" thi xet switch co hoc
  UNION ALL SELECT 'T06', slug, name, gia, CONVERT(CONCAT('Loai=', IFNULL(loai_bp, '(khong co)'), '; Switch=', IFNULL(switch_bp, '-')) USING utf8mb4) COLLATE utf8mb4_bin FROM base
    WHERE cat = 'ban-phim' AND (
      (LOWER(loai_bp) COLLATE utf8mb4_bin LIKE '%cơ%' AND LOWER(loai_bp) COLLATE utf8mb4_bin NOT LIKE '%giả cơ%')
      OR (loai_bp IS NULL AND LOWER(CONCAT(name, ' ', IFNULL(switch_bp, ''))) COLLATE utf8mb4_bin REGEXP 'blue switch|brown switch|cherry mx|clicky')
    )
  -- T07: Tai nghe co truong "Micro" (khac rong / "-")
  UNION ALL SELECT 'T07', slug, name, gia, CONVERT(CONCAT('Micro=', micro) USING utf8mb4) COLLATE utf8mb4_bin FROM base
    WHERE cat = 'tai-nghe' AND micro IS NOT NULL AND TRIM(micro) NOT IN ('', '-')
  -- T08: Ghe, ten hoac mo ta ngan co "cong thai hoc"
  UNION ALL SELECT 'T08', slug, name, gia, CONVERT(CONCAT('mo ta=', sd) USING utf8mb4) COLLATE utf8mb4_bin FROM base
    WHERE cat = 'ghe' AND LOWER(CONCAT(name, ' ', IFNULL(sd, ''))) COLLATE utf8mb4_bin LIKE '%công thái học%'
  -- T09: SSD NVMe dung luong 1000 GB
  UNION ALL SELECT 'T09', slug, name, gia, CONVERT(CONCAT(storageCapacityGb, 'GB; ', storageInterface) USING utf8mb4) COLLATE utf8mb4_bin FROM base
    WHERE cat = 'ssd' AND storageCapacityGb = 1000 AND storageInterface LIKE 'NVMe%'
  -- T10: PSU >= 750W, co chuan 80 Plus (bat ky cap)
  UNION ALL SELECT 'T10', slug, name, gia, CONVERT(CONCAT(psuWattage, 'W; ', psuEfficiency) USING utf8mb4) COLLATE utf8mb4_bin FROM base
    WHERE cat = 'psu' AND psuWattage >= 750 AND psuEfficiency LIKE '80 Plus%'
  -- T11 (da chot): Vo case nhan ITX va KHONG nhan ATX / E-ATX
  UNION ALL SELECT 'T11', slug, name, gia, CONVERT(CONCAT('caseFormFactors=', CAST(caseFormFactors AS CHAR)) USING utf8mb4) COLLATE utf8mb4_bin FROM base
    WHERE cat = 'case' AND JSON_CONTAINS(caseFormFactors, '"ITX"')
      AND NOT JSON_CONTAINS(caseFormFactors, '"ATX"') AND NOT JSON_CONTAINS(caseFormFactors, '"E-ATX"')
  -- T12: RAM DDR5, kit 32GB
  UNION ALL SELECT 'T12', slug, name, gia, CONVERT(CONCAT(ramType, '; ', ramCapacity, 'GB x', ramModules, ' thanh (kit)') USING utf8mb4) COLLATE utf8mb4_bin FROM base
    WHERE cat = 'ram' AND ramType = 'DDR5' AND ramCapacity = 32
  -- T13 (da chot): Mainboard co socket trung socket cua CPU Ryzen 7 trong CSDL (tat ca deu AM5, khong co Ryzen 7 AM4)
  UNION ALL SELECT 'T13', slug, name, gia, CONVERT(CONCAT('socket=', socket) USING utf8mb4) COLLATE utf8mb4_bin FROM base
    WHERE cat = 'mainboard' AND socket IN (SELECT socket FROM base WHERE cat = 'cpu' AND name LIKE '%Ryzen 7%')
  -- T14: CPU hang Intel
  UNION ALL SELECT 'T14', slug, name, gia, CONVERT(CONCAT('hang=', brand, '; socket=', socket) USING utf8mb4) COLLATE utf8mb4_bin FROM base WHERE cat = 'cpu' AND brand = 'Intel'
  -- T16: Loa
  UNION ALL SELECT 'T16', slug, name, gia, CONVERT(CONCAT('mo ta=', sd) USING utf8mb4) COLLATE utf8mb4_bin FROM base WHERE cat = 'loa'
  -- T17 (phuong an B): PC de ban (PC Gaming / PC Workstation) gia <= 20.000.000
  UNION ALL SELECT 'T17', slug, name, gia, CONVERT(CONCAT('danh muc=', cat) USING utf8mb4) COLLATE utf8mb4_bin FROM base
    WHERE cat IN ('pc-gaming', 'pc-workstation') AND gia <= 20000000
  -- T18: VGA co "RTX" trong ten
  UNION ALL SELECT 'T18', slug, name, gia, CONVERT('' USING utf8mb4) COLLATE utf8mb4_bin FROM base WHERE cat = 'vga' AND name LIKE '%RTX%'
  -- T19: Chuot hang Razer
  UNION ALL SELECT 'T19', slug, name, gia, CONVERT(CONCAT('hang=', brand) USING utf8mb4) COLLATE utf8mb4_bin FROM base WHERE cat = 'chuot' AND brand = 'Razer'
  -- T20: Ban
  UNION ALL SELECT 'T20', slug, name, gia, CONVERT(CONCAT('mo ta=', sd) USING utf8mb4) COLLATE utf8mb4_bin FROM base WHERE cat = 'ban'
) x
ORDER BY ma, gia, slug;
```

Kết quả nguyên văn (mỗi dòng là một sản phẩm được tính là đúng):

```
+-----+-------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------------+----------+--------------------------------------------------------------------------------------------------------------------------------------------------+
| ma  | slug                                                                                      | ten                                                                                           | gia      | thong_so                                                                                                                                         |
+-----+-------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------------+----------+--------------------------------------------------------------------------------------------------------------------------------------------------+
| T01 | laptop-asus-vivobook-16-x1605va-mb1826w                                                   | Laptop ASUS Vivobook 16 X1605VA-MB1826W                                                       | 15390000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-expertbook-p1-p1403cva-c3u08-50w                                              | Laptop ASUS ExpertBook P1 P1403CVA-C3U08-50W                                                  | 15490000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-lite-14-al14-45p-r7z3                                                  | Laptop Acer Aspire Lite 14 AL14-45P-R7Z3                                                      | 15990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-lite-15-al15-46p-r73c                                                  | Laptop Acer Aspire Lite 15 AL15-46P-R73C                                                      | 15990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-dell-15-pro-essential-pv15250-vkvkd                                                | Laptop Dell 15 Pro Essential PV15250 VKVKD                                                    | 15990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-vivobook-14-x1404v                                                            | Laptop ASUS Vivobook 14 X1404V                                                                | 16590000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-lite-15-al15-36p-30tn                                                  | Laptop Acer Aspire Lite 15 AL15-36P-30TN                                                      | 16990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-dell-dc15250-5434blk-m4cfy                                                         | Laptop Dell DC15250-5434BLK M4CFY                                                             | 17190000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-vivobook-14-x1404vap-v14c58256                                                | Laptop ASUS Vivobook 14 X1404VAP-V14.C58256                                                   | 17890000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-lite-14-al14-47p-r0tr                                                  | Laptop Acer Aspire Lite 14 AL14-47P-R0TR                                                      | 17990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-lite-15-al15-21p-r87w                                                  | Laptop Acer Aspire Lite 15 AL15-21P-R87W                                                      | 17990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-lite-15-al15-410p-r1w8                                                 | Laptop Acer Aspire Lite 15 AL15-410P-R1W8                                                     | 17990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-dell-16-dc16251                                                                    | Laptop Dell 16 DC16251                                                                        | 18390000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-lite-15-al15-49p-r6xx                                                  | Laptop Acer Aspire Lite 15 AL15-49P-R6XX                                                      | 18590000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-expertbook-b1-bm1403cda-s61611w                                               | Laptop ASUS ExpertBook B1 BM1403CDA-S61611W                                                   | 18800000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-lite-15-al15-53p-56qh                                                  | Laptop Acer Aspire Lite 15 AL15-53P-56QH                                                      | 18890000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-lite-15-al15-48p-r86q                                                  | Laptop Acer Aspire Lite 15 AL15-48P-R86Q                                                      | 18990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-dell-vostro-3530-2h1tpi7                                                           | Laptop Dell Vostro 3530 2H1TPI7                                                               | 18990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-go-15-ag15-72p-54gy                                                    | Laptop Acer Aspire Go 15 AG15 72P 54GY                                                        | 19490000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-expertbook-p1403cva-c5h08-50w                                                 | Laptop ASUS ExpertBook P1403CVA-C5H08-50W                                                     | 19490000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-lite-15-al15-21p-r91w                                                  | Laptop Acer Aspire Lite 15 AL15-21P-R91W                                                      | 19590000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-lite-14-al14-44p-r0sp                                                  | Laptop Acer Aspire Lite 14 AL14-44P-R0SP                                                      | 20990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-lite-15-al15-53p-56ec                                                  | Laptop Acer Aspire Lite 15 AL15-53P-56EC                                                      | 21990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-msi-modern-15-f1mg-1225vn                                                          | Laptop MSI Modern 15 F1MG-1225VN                                                              | 22190000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-14-ai-a14-11m-x8fp                                                     | Laptop Acer Aspire 14 AI A14-11M-X8FP                                                         | 22990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-go-15-ag15-72p-776j                                                    | Laptop Acer Aspire Go 15 AG15-72P-776J                                                        | 22990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-lite-14-al14-53m-53e8                                                  | Laptop Acer Aspire Lite 14 AL14-53M-53E8                                                      | 22990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-dell-dc15250-7982blk-h5yxj                                                         | Laptop Dell DC15250-7982BLK H5YXJ                                                             | 22990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-expertbook-p1403cva-c5h16-50w                                                 | Laptop ASUS ExpertBook P1403CVA-C5H16-50W                                                     | 23390000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-hp-250-g10-a06fdpt                                                                 | Laptop HP 250 G10 A06FDPT                                                                     | 23490000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-go-14-ai-ag14-i71m-50al                                                | Laptop Acer Aspire Go 14 AI AG14-I71M-50AL                                                    | 23990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-hp-probook-450-g10-b73tpat                                                         | Laptop HP ProBook 450 G10 B73TPAT                                                             | 23990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-lg-grambook-15u50u-gav55a5                                                         | Laptop LG Grambook 15U50U-G.AV55A5                                                            | 23990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-lite-14-ai-al14-57p-59hb                                               | Laptop Acer Aspire Lite 14 AI AL14-57P-59HB                                                   | 24990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-aspire-lite-16-ai-al16-71p-582q                                               | Laptop Acer Aspire Lite 16 AI AL16-71P-582Q                                                   | 24990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-swift-air-14-sfa14-i31-52bv                                                   | Laptop Acer Swift Air 14 SFA14-I31-52BV                                                       | 24990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-hp-15-fd1289tu-c2cv8pa                                                             | Laptop HP 15-fd1289TU C2CV8PA                                                                 | 24990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-lenovo-ideapad-slim-3-14iwc11-83rq00dbvn                                           | Laptop Lenovo IdeaPad Slim 3 14IWC11 83RQ00DBVN                                               | 24990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-msi-modern-14-h1m-014vn                                                            | Laptop MSI Modern 14 H1M-014VN                                                                | 25490000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-lenovo-ideapad-slim-3-16ahp10-83kb005yvn                                           | Laptop Lenovo IdeaPad Slim 3 16AHP10 83KB005YVN                                               | 25990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-expertbook-p3-g1-p3406ccap-u516s8w                                            | Laptop ASUS ExpertBook P3 G1 P3406CCAP-U516S8W                                                | 26390000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-expertbook-p3-p3406ccap-u516w                                                 | Laptop ASUS ExpertBook P3 P3406CCAP-U516W                                                     | 26390000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-dell-16-dc16251-ldc16251-7537cld-pus                                               | Laptop Dell 16 DC16251 LDC16251-7537CLD-PUS                                                   | 26990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-vivobook-s14-s3407ca-sf913w                                                   | Laptop ASUS VivoBook S14 S3407CA-SF913W                                                       | 27890000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-lenovo-ideapad-slim-3-16ahp10-83kb0060vn                                           | Laptop Lenovo IdeaPad Slim 3 16AHP10 83KB0060VN                                               | 27990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-swift-14-ai-sf14-51-53p9                                                      | Laptop Acer Swift 14 AI SF14-51-53P9                                                          | 28990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-expertbook-p1-p1403cva-c7h16-50w                                              | Laptop ASUS ExpertBook P1 P1403CVA-C7H16-50W                                                  | 28990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-swift-go-14-ai-sfg14-75-5264                                                  | Laptop Acer Swift Go 14 AI SFG14-75-5264                                                      | 29990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-expertbook-p3-g1-p3406ccap-u716s8w                                            | Laptop ASUS ExpertBook P3 G1 P3406CCAP-U716S8W                                                | 30590000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-expertbook-p3-p3406ccap-u716w                                                 | Laptop ASUS ExpertBook P3 P3406CCAP-U716W                                                     | 30690000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-lenovo-ideapad-slim-5-14akp10-oled-83hx00abvn                                      | Laptop Lenovo IdeaPad Slim 5 14AKP10 OLED 83HX00ABVN                                          | 30990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-swift-go-sfg14-74t-55hd                                                       | Laptop Acer Swift Go SFG14-74T-55HD                                                           | 31490000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-zenbook-14-ux3405ca-st1713w                                                   | Laptop ASUS Zenbook 14 UX3405CA-ST1713W                                                       | 31990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-lenovo-ideapad-slim-5-14agp11-oled-83s1006rvn                                      | Laptop Lenovo IdeaPad Slim 5 14AGP11 OLED 83S1006RVN                                          | 32990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-swift-go-sfg14-74-58fj                                                        | Laptop Acer Swift Go SFG14-74-58FJ                                                            | 32999000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-lg-gram-14z90u-gan55a5                                                             | Laptop LG Gram 14Z90U-G.AN55A5                                                                | 33900000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-msi-modern-16s-g3mg-016vn                                                          | Laptop MSI Modern 16S G3MG-016VN                                                              | 33990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-lenovo-ideapad-slim-5-14akp10-oled-83hx00f5vn                                      | Laptop Lenovo IdeaPad Slim 5 14AKP10 OLED 83HX00F5VN                                          | 34990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-swift-x-sfx14-71g-78sy                                                        | Laptop Acer Swift X SFX14-71G-78SY                                                            | 35990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-msi-modern-14s-ai-g3mg-050vn                                                       | Laptop MSI Modern 14S AI+ G3MG-050VN                                                          | 36490000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-lg-gram-pro-16z90u-gan55a5                                                         | Laptop LG Gram Pro 16Z90U-G.AN55A5                                                            | 36900000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-msi-prestige-13-ai-evo-a2vmg-040vn                                                 | Laptop MSI Prestige 13 AI+ Evo A2VMG 040VN                                                    | 37990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-swift-go-ai-oled-sfg14-75-765m                                                | Laptop Acer Swift Go AI OLED SFG14-75-765M                                                    | 39990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-zenbook-14-ux3405ca-st1531w                                                   | Laptop ASUS Zenbook 14 UX3405CA-ST1531W                                                       | 42990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-swift-x14-sfx14-72g-708x                                                      | Laptop Acer Swift X14 SFX14 72G 708X                                                          | 43990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-msi-modern-16s-ai-g3mg-058vn                                                       | Laptop MSI Modern 16S AI+ G3MG-058VN                                                          | 43990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-lg-gram-pro-16z90u-gav85a5                                                         | Laptop LG Gram Pro 16Z90U-G.AV85A5                                                            | 44900000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-lenovo-yoga-slim-7-14iph11-oled-83qm0075vn                                         | Laptop Lenovo Yoga Slim 7 14IPH11 OLED 83QM0075VN                                             | 46990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-lenovo-yoga-slim-7-14iph11-oled-83qm0076vn                                         | Laptop Lenovo Yoga Slim 7 14IPH11 OLED 83QM0076VN                                             | 46990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-msi-prestige-14-ai-d3mg-022vn                                                      | Laptop MSI Prestige 14 AI+ D3MG-022VN                                                         | 46990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-zenbook-14-ux3407na-qd132ws                                                   | Laptop ASUS Zenbook 14 UX3407NA-QD132WS                                                       | 48990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-zenbook-s-15-um5606ga-ss441w                                                  | Laptop ASUS Zenbook S 15 UM5606GA-SS441W                                                      | 49490000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-acer-swift-go-14-ai-sfg14-i71-70rp                                                 | Laptop Acer Swift Go 14 AI SFG14-I71-70RP                                                     | 49990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-zenbook-s-14-ux5406aa-su348w                                                  | Laptop ASUS Zenbook S 14 UX5406AA-SU348W                                                      | 50990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-gigabyte-aero-x16-4whn3vnc93ah                                                     | Laptop GIGABYTE AERO X16 4WHN3VNC93AH                                                         | 54990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-lenovo-yoga-slim-7-14iph11-oled-83qm002evn                                         | Laptop Lenovo Yoga Slim 7 14IPH11 OLED 83QM002EVN                                             | 55990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-lenovo-yoga-slim-7-14iph11-oled-83qm002fvn                                         | Laptop Lenovo Yoga Slim 7 14IPH11 OLED 83QM002FVN                                             | 55990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-asus-zenbook-a16-ux3607oa-sq137ws                                                  | Laptop ASUS Zenbook A16 UX3607OA-SQ137WS                                                      | 58990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-msi-prestige-14-flip-ai-vincent-van-gogh-edition-starry-night-over-the-rhone-260vn | Laptop MSI Prestige 14 Flip AI+ Vincent van Gogh Edition - Starry Night Over the Rhône-260VN  | 59990000 | danh muc=laptop-van-phong                                                                                                                        |
| T01 | laptop-msi-prestige-14-flip-ai-vincent-van-gogh-edition-the-starry-night-259vn            | Laptop MSI Prestige 14 Flip AI+ Vincent van Gogh Edition - The Starry Night-259VN             | 59990000 | danh muc=laptop-van-phong                                                                                                                        |
| T02 | laptop-asus-tuf-gaming-a15-fa507nv                                                        | Laptop ASUS TUF Gaming A15 FA507NV                                                            | 24490000 | danh muc=laptop-gaming                                                                                                                           |
| T03 | chuot-khong-day-rapoo-m21-silent                                                          | Chuột Không Dây Rapoo M21 Silent                                                              |   150000 | Ket noi=Wireless                                                                                                                                 |
| T03 | chuot-khong-day-logitech-m331-silent-red                                                  | Chuột không dây Logitech M331 Silent Red                                                      |   360000 | Ket noi=Wireless                                                                                                                                 |
| T03 | chuot-dareu-khong-day-em911t-rgb-den                                                      | Chuột DareU Không dây EM911T RGB Đen                                                          |   400000 | Ket noi=Không dây 2.4 GHz, Bluetooth, USB-C to USB-A                                                                                             |
| T03 | chuot-logitech-pebble-mouse-2-m350s-graphite                                              | Chuột Logitech Pebble Mouse 2 M350S Graphite                                                  |   490000 | Ket noi=Đa kết nối                                                                                                                               |
| T03 | chuot-logitech-pebble-mouse-2-m350s-rose                                                  | Chuột Logitech Pebble Mouse 2 M350S Rose                                                      |   490000 | Ket noi=Bluetooth                                                                                                                                |
| T03 | chuot-logitech-pebble-mouse-2-m350s-white                                                 | Chuột Logitech Pebble Mouse 2 M350S White                                                     |   490000 | Ket noi=Đa kết nối                                                                                                                               |
| T03 | chuot-khong-day-hyperwork-macro-ms02-den                                                  | Chuột không dây HyperWork Macro MS02 Đen                                                      |   650000 | Ket noi=Không dây 2.4 GHz, Bluetooth, USB-C to USB-A                                                                                             |
| T03 | chuot-akko-ag-one-8k-joy-of-life                                                          | Chuột AKKO AG ONE 8K Joy of Life                                                              |   790000 | Ket noi=Không dây 2.4 GHz, Bluetooth, USB-C                                                                                                      |
| T03 | chuot-corsair-katar-pro-wireless                                                          | Chuột Corsair Katar Pro Wireless                                                              |   790000 | Ket noi=Bluetooth, Không dây 2.4 GHz                                                                                                             |
| T03 | chuot-gaming-asus-tuf-m4-wireless                                                         | Chuột Gaming ASUS TUF M4 Wireless                                                             |   790000 | Ket noi=Đa kết nối                                                                                                                               |
| T03 | chuot-khong-day-logitech-signature-comfort-m840-l-white                                   | Chuột không dây Logitech Signature Comfort M840 L White                                       |   990000 | Ket noi=Bluetooth                                                                                                                                |
| T03 | chuot-asus-rog-strix-impact-iii-wireless-white                                            | Chuột ASUS ROG Strix Impact III Wireless White                                                |  1090000 | Ket noi=Đa kết nối                                                                                                                               |
| T03 | chuot-atk-x1-tri-mode-wireless-white                                                      | Chuột ATK X1 Tri-mode Wireless White                                                          |  1090000 | Ket noi=Không dây 2.4 GHz, Bluetooth, USB-C to USB-A                                                                                             |
| T03 | chuot-khong-day-akko-dash-v9-max-black                                                    | Chuột không dây AKKO Dash V9 Max Black                                                        |  1090000 | Ket noi=Không dây 2.4 GHz, Bluetooth, USB-C to USB-A                                                                                             |
| T03 | chuot-khong-day-akko-nest-black                                                           | Chuột không dây AKKO Nest Black                                                               |  1590000 | Ket noi=Không dây 2.4 GHz, Bluetooth, USB-C to USB-A                                                                                             |
| T03 | chuot-gaming-khong-day-logitech-g304-x-superlight-black                                   | Chuột gaming không dây Logitech G304 X Superlight Black                                       |  1790000 | Ket noi=Không dây 2.4 GHz, Bluetooth, USB-C to USB-A                                                                                             |
| T04 | card-man-hinh-msi-geforce-rtx-5060-shadow-2x-oc-8gb                                       | Card màn hình MSI GeForce RTX 5060 Shadow 2X OC 8GB                                           | 13490000 |                                                                                                                                                  |
| T04 | card-man-hinh-gigabyte-geforce-rtx-5060-windforce-v2-oc-8gb                               | Card màn hình GIGABYTE GeForce RTX 5060 Windforce V2 OC 8GB                                   | 13990000 |                                                                                                                                                  |
| T04 | card-man-hinh-gigabyte-geforce-rtx-5060-ti-windforce-v2-max-oc-8gb                        | Card màn hình GIGABYTE GeForce RTX 5060 Ti Windforce V2 Max OC 8GB                            | 14890000 |                                                                                                                                                  |
| T05 | man-hinh-e-dra-egm27f180pvs-27-ips-180hz-chuyen-game                                      | Màn hình E-DRA EGM27F180PVS 27" IPS 180Hz chuyên game                                         |  2390000 | Kich thuoc=27 inch; Tan so quet=180 Hz                                                                                                           |
| T05 | man-hinh-aoc-q27g40he-27-fast-ips-2k-210hz-chuyen-game                                    | Màn hình AOC Q27G40HE 27" Fast IPS 2K 210Hz chuyên game                                       |  4190000 | Kich thuoc=27 inch; Tan so quet=OC 210 Hz                                                                                                        |
| T05 | man-hinh-gigabyte-g27q20-27-ips-2k-210hz-chuyen-game                                      | Màn hình GIGABYTE G27Q20 27" IPS 2K 210Hz chuyên game                                         |  4390000 | Kich thuoc=27 inch; Tan so quet=210 Hz                                                                                                           |
| T05 | man-hinh-msi-mag-275qf-e21-27-rapid-ips-2k-210hz-chuyen-game                              | Màn hình MSI MAG 275QF E21 27" Rapid IPS 2K 210Hz chuyên game                                 |  4590000 | Kich thuoc=27 inch; Tan so quet=210 Hz                                                                                                           |
| T05 | man-hinh-viewsonic-xg2735-2k-27-ips-2k-210hz-chuyen-game                                  | Màn hình ViewSonic XG2735-2K 27" IPS 2K 210Hz chuyên game                                     |  4790000 | Kich thuoc=27 inch; Tan so quet=210 Hz                                                                                                           |
| T05 | man-hinh-asus-tuf-gaming-vg27aqme5f-27-fast-ips-2k-255hz-chuyen-game                      | Màn hình ASUS TUF GAMING VG27AQME5F 27" Fast IPS 2K 255Hz chuyên game                         |  5190000 | Kich thuoc=27 inch; Tan so quet=255 Hz                                                                                                           |
| T05 | man-hinh-asus-tuf-gaming-vg27aqm5f-27-fast-ips-2k-320hz-chuyen-game                       | Màn hình ASUS TUF GAMING VG27AQM5F 27" Fast IPS 2K 320Hz chuyên game                          |  6490000 | Kich thuoc=27 inch; Tan so quet=320 Hz                                                                                                           |
| T05 | man-hinh-gigabyte-go27q24-27-qd-oled-2k-240hz-chuyen-game                                 | Màn hình GIGABYTE GO27Q24 27" QD-OLED 2K 240Hz chuyên game                                    | 12590000 | Kich thuoc=27 inch; Tan so quet=240 Hz                                                                                                           |
| T05 | man-hinh-samsung-odyssey-g6-ls27hg612sexxv-qd-oled-27-2k-240hz-chuyen-game                | Màn hình Samsung Odyssey G6 LS27HG612SEXXV QD-OLED 27" 2K 240Hz chuyên game                   | 12890000 | Kich thuoc=27 inch; Tan so quet=240 Hz                                                                                                           |
| T05 | man-hinh-acer-predator-x27u-w2-27-qd-oled-2k-240hz-chuyen-game                            | Màn hình Acer Predator X27U W2 27" QD-OLED 2K 240Hz chuyên game                               | 15990000 | Kich thuoc=27 inch; Tan so quet=240 Hz                                                                                                           |
| T05 | man-hinh-philips-evnia-27m2n8500-27-qd-oled-2k-360hz-chuyen-game                          | Màn hình Philips Evnia 27M2N8500 27" QD-OLED 2K 360Hz chuyên game                             | 16990000 | Kich thuoc=27 inch; Tan so quet=360Hz                                                                                                            |
| T05 | man-hinh-acer-predator-x27u-z2-27-qd-oled-2k-280hz-chuyen-game                            | Màn hình Acer Predator X27U Z2 27" QD-OLED 2K 280Hz chuyên game                               | 17990000 | Kich thuoc=27 inch; Tan so quet=280 Hz                                                                                                           |
| T06 | ban-phim-co-day-veekos-k75-wined-red                                                      | Bàn phím có dây Veekos K75 Wined Red                                                          |   590000 | Loai=Bàn phím cơ; Switch=Akko Frost Pink (Linear)                                                                                                |
| T06 | ban-phim-co-e-dra-khong-day-ek375s-red-switch                                             | Bàn phím cơ E-Dra không dây EK375S Red Switch                                                 |   690000 | Loai=Bàn phím cơ; Switch=EDRA red switch (Linear)                                                                                                |
| T06 | ban-phim-co-gaming-khong-day-dareu-flex-75-white-black-3-mode-pegasus-switch              | Bàn phím cơ gaming không dây DareU Flex 75 White Black 3 Mode Pegasus switch                  |   690000 | Loai=Cơ; Switch=Pegasus                                                                                                                          |
| T06 | ban-phim-co-gaming-khong-day-dareu-ek75-pro-cloudy-aqua-dream-switch                      | Bàn phím cơ gaming không dây DareU EK75 PRO Cloudy Aqua Dream switch                          |   750000 | Loai=Bàn phím cơ; Switch=Dream (Linear)                                                                                                          |
| T06 | ban-phim-co-e-dra-khong-day-ek398s-red-switch                                             | Bàn phím cơ E-Dra không dây EK398S Red Switch                                                 |   790000 | Loai=Bàn phím cơ; Switch=EDRA red switch (Linear)                                                                                                |
| T06 | ban-phim-rapoo-v500l-rainbow-blue-switch                                                  | Bàn phím Rapoo V500L Rainbow Blue Switch                                                      |   790000 | Loai=(khong co); Switch=Clicky                                                                                                                   |
| T06 | ban-phim-khong-day-akko-3108rf-v3-blackandgold                                            | Bàn phím không dây AKKO 3108RF V3 Black&Gold                                                  |   850000 | Loai=Bàn phím cơ; Switch=Akko Frost Pink (Linear)                                                                                                |
| T06 | ban-phim-khong-day-akko-3108rf-v3-glacier                                                 | Bàn phím không dây AKKO 3108RF V3 Glacier                                                     |   850000 | Loai=Bàn phím cơ; Switch=Akko Frost Pink (Linear)                                                                                                |
| T06 | ban-phim-khong-day-akko-3108rf-v3-prunus-lannesiana                                       | Bàn phím không dây AKKO 3108RF V3 Prunus Lannesiana                                           |   850000 | Loai=Bàn phím cơ; Switch=Akko Frost Pink (Linear)                                                                                                |
| T06 | ban-phim-rapoo-v500-pro-multimode-tkl-blue-switch                                         | Bàn phím Rapoo V500 Pro Multimode TKL Blue Switch                                             |   890000 | Loai=(khong co); Switch=Clicky                                                                                                                   |
| T06 | ban-phim-khong-day-akko-5087-v3-blackandgray-gradient-botany                              | Bàn phím không dây AKKO 5087 V3 Black&Gray Gradient Botany                                    |  1390000 | Loai=Cơ; Switch=Akko Botany (Linear)                                                                                                             |
| T06 | ban-phim-khong-day-akko-5087-v3-prunus-lannesiana-akko-piano-pro                          | Bàn phím không dây AKKO 5087 V3 Prunus Lannesiana AKKO Piano Pro                              |  1390000 | Loai=Cơ; Switch=Akko V3 Piano Pro (Linear)                                                                                                       |
| T06 | ban-phim-aula-f108-pro-f10801                                                             | Bàn phím AULA F108 Pro F10801                                                                 |  1650000 | Loai=Bàn phím cơ; Switch=Nimbus V3 switch                                                                                                        |
| T06 | ban-phim-aula-f108-pro-f10806                                                             | Bàn phím AULA F108 Pro F10806                                                                 |  1650000 | Loai=Bàn phím cơ; Switch=Reaper switch                                                                                                           |
| T06 | ban-phim-gaming-asus-xa14-rog-strix-scope-ii-x-nx-storm                                   | Bàn phím gaming ASUS XA14 ROG STRIX SCOPE II X NX Storm                                       |  3390000 | Loai=Cơ; Switch=ROG NX Storm (Clicky)                                                                                                            |
| T06 | ban-phim-co-corsair-k100-rgb-cherry-mx-speed                                              | Bàn phím cơ Corsair K100 RGB Cherry MX Speed                                                  |  3590000 | Loai=Bàn phím cơ; Switch=Cherry MX Speed RGB (Linear)                                                                                            |
| T06 | ban-phim-leopold-fc900rbt-bluetooth-coral-blue-limited-edition-brown-switch               | Bàn phím Leopold FC900RBT Bluetooth Coral Blue Limited Edition Brown Switch                   |  3600000 | Loai=(khong co); Switch=Cherry MX Brown (Tactile)                                                                                                |
| T06 | ban-phim-leopold-fc900rbt-bluetooth-milk-turquoise-limited-edition-brown-switch           | Bàn phím Leopold FC900RBT Bluetooth Milk Turquoise Limited Edition Brown Switch               |  3600000 | Loai=(khong co); Switch=Cherry MX (Tactile)                                                                                                      |
| T06 | ban-phim-razer-blackwidow-v4-tenkeyless-hyperspeed                                        | Bàn phím Razer BlackWidow V4 Tenkeyless HyperSpeed                                            |  3760000 | Loai=Bàn phím cơ; Switch=Razer Orange Switches Gen-3 (Tactile)                                                                                   |
| T06 | ban-phim-gaming-logitech-g512-x-98-tmr-8k-white                                           | Bàn phím gaming Logitech G512 X 98 TMR 8K White                                               |  5390000 | Loai=Bàn phím cơ Rapid Trigger, Bàn phím cơ; Switch=81 Switch cơ học + 9 Switch Analog từ tính tuyến tính                                        |
| T06 | ban-phim-keychron-q6m-m1-carbon-black-red-switch                                          | Bàn phím Keychron Q6M-M1 Carbon Black Red Switch                                              |  5490000 | Loai=Bàn phím cơ; Switch=Gateron Jupiter Red Switch (Linear)                                                                                     |
| T06 | ban-phim-co-asus-rog-falchion-ace-75-he-v2x-white                                         | Bàn phím cơ ASUS ROG Falchion Ace 75 HE V2X White                                             |  5890000 | Loai=Cơ; Switch=ROG HFX V2X Magnetic Switch (Switch quang học và từ tính)                                                                        |
| T06 | ban-phim-co-razer-huntsman-v3-pro-8khz                                                    | Bàn phím cơ Razer Huntsman V3 Pro 8KHz                                                        |  6300000 | Loai=Bàn phím cơ, Bàn phím cơ Rapid Trigger; Switch=Razer Analog Optical Switches Gen-2                                                          |
| T06 | ban-phim-gaming-keychron-black-myth-wukong-deluxe-gold-pink-switch                        | Bàn phím gaming Keychron Black Myth Wukong Deluxe Gold Pink Switch                            |  6490000 | Loai=Bàn phím cơ; Switch=TTC Golden Pink (Linear) (Linear)                                                                                       |
| T06 | ban-phim-asus-m704-rog-azoth-x-nx-snow-v2-switch                                          | Bàn phím ASUS M704 ROG AZOTH X NX Snow V2 Switch                                              |  6590000 | Loai=Bàn phím cơ; Switch=NX Snow V2 Switch (Linear)                                                                                              |
| T06 | ban-phim-gaming-razer-huntsman-v3-pro-tenkeyless-8khz-niko-edition                        | Bàn phím gaming Razer Huntsman V3 Pro Tenkeyless 8KHz - NiKo Edition                          |  6790000 | Loai=Bàn phím cơ Rapid Trigger; Switch=Razer Analog Optical Switches Gen-2 (Switch quang học và từ tính)                                         |
| T07 | tai-nghe-dareu-eh416-rgb                                                                  | Tai nghe DareU EH416 RGB                                                                      |   390000 | Micro=Khử ồn ENC                                                                                                                                 |
| T07 | tai-nghe-rapoo-gaming-vh520                                                               | Tai nghe Rapoo Gaming VH520                                                                   |   400000 | Micro=Khử ồn ENC                                                                                                                                 |
| T07 | tai-nghe-gaming-rapoo-vh160                                                               | Tai nghe Gaming Rapoo VH160                                                                   |   690000 | Micro=Khử ồn ENC                                                                                                                                 |
| T07 | tai-nghe-asus-rog-cetra-ii-core                                                           | Tai nghe ASUS ROG Cetra II Core                                                               |   790000 | Micro=Tháo rời, Đa hướng                                                                                                                         |
| T07 | tai-nghe-khong-day-akko-gh300-white                                                       | Tai nghe không dây AKKO GH300 White                                                           |   890000 | Micro=Thu âm đa hướng, Micro thiết kế có thể tháo rời                                                                                            |
| T07 | tai-nghe-logitech-g333-black                                                              | Tai nghe Logitech G333 Black                                                                  |   890000 | Micro=Tích hợp, Tháo rời                                                                                                                         |
| T07 | tai-nghe-hyperx-cloud-earbuds-iii-red                                                     | Tai nghe HyperX Cloud Earbuds III Red                                                         |   990000 | Micro=Có mic đàm thoại                                                                                                                           |
| T07 | tai-nghe-razer-hammerhead-v3-wired-earbuds-white                                          | Tai nghe Razer Hammerhead V3 Wired Earbuds White                                              |  1260000 | Micro=Có                                                                                                                                         |
| T07 | tai-nghe-gaming-khong-day-akko-verge-s9-ultra-white                                       | Tai nghe gaming không dây AKKO Verge S9 Ultra White                                           |  1290000 | Micro=ENC                                                                                                                                        |
| T07 | tai-nghe-khong-day-logitech-g321-lightspeed-black                                         | Tai nghe không dây Logitech G321 LIGHTSPEED Black                                             |  1350000 | Micro=Gập để tắt                                                                                                                                 |
| T07 | tai-nghe-msi-h991                                                                         | Tai nghe MSI H991                                                                             |  1400000 | Micro=Khử ồn ENC                                                                                                                                 |
| T07 | tai-nghe-bluetooth-soundpeats-air-3-pro                                                   | Tai nghe Bluetooth SoundPeats Air 3 Pro                                                       |  1590000 | Micro=Khử ồn ENC                                                                                                                                 |
| T07 | tai-nghe-hyperx-cloud-earbuds-iii-s-black                                                 | Tai nghe HyperX Cloud Earbuds III S Black                                                     |  1590000 | Micro=Micro MEMS đa hướng, Khử ồn, Thu giọng rõ trong môi trường ồn                                                                              |
| T07 | tai-nghe-hyperx-cloud-jet-blue-wireless                                                   | Tai nghe HyperX Cloud JET Blue Wireless                                                       |  1690000 | Micro=Tháo rời, Khử ồn ENC                                                                                                                       |
| T07 | tai-nghe-co-day-tuf-gaming-h1-gen-ii-hatsune-miku                                         | Tai nghe có dây TUF Gaming H1 Gen II Hatsune Miku                                             |  2090000 | Micro=Đơn hướng, Tháo rời, Khử ồn ENC                                                                                                            |
| T07 | tai-nghe-logitech-g-pro-x-se                                                              | Tai nghe Logitech G Pro X SE                                                                  |  2190000 | Micro=Blue VO!CE, Cardioid, Electret Condenser                                                                                                   |
| T07 | tai-nghe-hyperx-cloud-iii-red                                                             | Tai nghe HyperX Cloud III Red                                                                 |  2290000 | Micro=Tháo rời, Khử ồn ENC                                                                                                                       |
| T07 | tai-nghe-logitech-g733-lightspeed-wireless-black                                          | Tai nghe Logitech G733 LIGHTSPEED Wireless Black                                              |  2290000 | Micro=Cardioid (đơn hướng), có thể tháo rời                                                                                                      |
| T07 | tai-nghe-khong-day-logitech-g325-lightspeed-white                                         | Tai nghe không dây Logitech G325 LIGHTSPEED White                                             |  2390000 | Micro=Mic định hướng tín hiệu tích hợp                                                                                                           |
| T07 | tai-nghe-razer-hammerhead-v3-x-hyperspeed                                                 | Tai nghe Razer Hammerhead V3 X HyperSpeed                                                     |  2690000 | Micro=Cardioid, Mic mute cảm ứng                                                                                                                 |
| T07 | tai-nghe-asus-rog-pelta-wl-rgb-black                                                      | Tai nghe ASUS ROG Pelta WL RGB Black                                                          |  3190000 | Micro=Khử ồn ENC, Khử ồn ANC                                                                                                                     |
| T07 | tai-nghe-khong-day-hyperx-cloud-flight-2-wl-black                                         | Tai nghe không dây HyperX Cloud Flight 2 WL Black                                             |  3190000 | Micro=Khử ồn ENC, Tháo rời                                                                                                                       |
| T07 | tai-nghe-gaming-khong-day-logitech-astro-a20-x                                            | Tai nghe gaming không dây Logitech Astro A20 X                                                |  3590000 | Micro=Kiểu thu Omni                                                                                                                              |
| T07 | tai-nghe-razer-hammerhead-v3-hyperspeed-black                                             | Tai nghe Razer Hammerhead V3 HyperSpeed Black                                                 |  3890000 | Micro=Noise Cancellation, Cardioid                                                                                                               |
| T07 | tai-nghe-hyperx-cloud-iii-s-wireless-black                                                | Tai nghe HyperX Cloud III S Wireless Black                                                    |  4190000 | Micro=Tháo rời, Khử ồn ENC                                                                                                                       |
| T07 | tai-nghe-razer-blackshark-v3-white                                                        | Tai nghe Razer BlackShark V3 White                                                            |  4420000 | Micro=Micrô Razer HyperClear Cardioid 9,9 mm có thể tháo rời                                                                                     |
| T07 | tai-nghe-logitech-g-pro-x-2-lightspeed-pink                                               | Tai nghe Logitech G PRO X 2 LIGHTSPEED Pink                                                   |  4790000 | Micro=Công nghệ độc quyền                                                                                                                        |
| T07 | tai-nghe-razer-blackshark-v3-pro-niko-edition                                             | Tai nghe Razer BlackShark V3 Pro - NiKo Edition                                               |  7490000 | Micro=Micrô Razer HyperClear Cardioid 12 mm có thể tháo rời                                                                                      |
| T07 | tai-nghe-khong-day-razer-blackshark-v3-pro-counter-strike-2-edition                       | Tai nghe không dây Razer Blackshark V3 Pro Counter-Strike 2 Edition                           |  7780000 | Micro=Khử ồn ENC, Chất lượng thu âm                                                                                                              |
| T07 | tai-nghe-hyperx-cloud-alpha-2-wireless-black                                              | Tai nghe HyperX Cloud Alpha 2 Wireless Black                                                  |  8190000 | Micro=Tháo rời, Khử ồn ENC                                                                                                                       |
| T07 | tai-nghe-khong-day-razer-kraken-v4-pro                                                    | Tai nghe không dây Razer Kraken V4 Pro                                                        | 10060000 | Micro=Retractable Razer HyperClear Super Wideband Mic                                                                                            |
| T08 | ghe-cong-thai-hoc-hyperwork-cloud-chair-oc03-xam-bac                                      | Ghế công thái học HyperWork Cloud Chair OC03 Xám Bạc                                          |  2390000 | mo ta=Lưng lưới • Lưng lưới Aero Mesh • Tải trọng 120 kg • Ngả lưng 125°                                                                         |
| T08 | ghe-cong-thai-hoc-sihoo-m77c-xam                                                          | Ghế công thái học Sihoo M77C Xám                                                              |  2490000 | mo ta=Công thái học • Lưng vải lưới • Tải trọng 150 kg • Ngả lưng 116–126°                                                                       |
| T08 | ghe-warrior-raider-series-wgc206-whitepink                                                | Ghế Warrior Raider Series WGC206 White/Pink                                                   |  2590000 | mo ta=Ghế Gaming Công thái học • Lưng da PU                                                                                                      |
| T08 | ghe-cong-thai-hoc-hyperwork-airy-oc02-den                                                 | Ghế công thái học HyperWork Airy OC02 Đen                                                     |  2990000 | mo ta=Lưng lưới • Lưng lưới AeroMesh • Tải trọng 120 kg • Ngả lưng 135°                                                                          |
| T08 | ghe-cong-thai-hoc-sihoo-m18                                                               | Ghế công thái học Sihoo M18                                                                   |  3190000 | mo ta=Ghế Công thái học • Lưng lưới Mesh • Tải trọng 120 kg • Ngả lưng 126°                                                                      |
| T08 | ghe-choi-game-warrior-immortal-series-wgc225-xanh-navy                                    | Ghế chơi game Warrior Immortal Series WGC225 Xanh Navy                                        |  3290000 | mo ta=Ghế Gaming Công thái học • Lưng da PU • Ngả lưng 155°                                                                                      |
| T08 | ghe-cong-thai-hoc-sihoo-m105c                                                             | Ghế công thái học Sihoo M105C                                                                 |  3690000 | mo ta=Công thái học • Lưng lưới mesh cao cấp (PA+Fiber) • Tải trọng 100 kg • Ngả lưng 115–135°                                                   |
| T08 | ghe-cong-thai-hoc-sihoo-m57-gray                                                          | Ghế công thái học Sihoo M57-GRAY                                                              |  4590000 | mo ta=Ghế Công thái học • Lưng vải lưới • Ngả lưng 135°                                                                                          |
| T08 | ghe-cong-thai-hoc-warrior-ergonomic-marshal-wec620                                        | Ghế công thái học Warrior Ergonomic Marshal WEC620                                            |  4790000 | mo ta=Ghế Công thái học • Lưng lưới HD Elastomesh • Tải trọng 135 kg • Ngả lưng 135°                                                             |
| T08 | ghe-cong-thai-hoc-warrior-ergonomic-marshal-wec630-black                                  | Ghế công thái học Warrior Ergonomic Marshal WEC630 Black                                      |  4790000 | mo ta=Ghế Công thái học • Lưng vải lưới • Tải trọng 135 kg • Ngả lưng 135°                                                                       |
| T08 | ghe-gaming-razer-enki-black-green                                                         | Ghế Gaming Razer Enki Black - Green                                                           | 12500000 | mo ta=Ghế Gaming Công thái học • Lưng da PU • Ngả lưng 152°                                                                                      |
| T08 | ghe-gaming-razer-enki-full-black                                                          | Ghế Gaming Razer Enki Full Black                                                              | 12500000 | mo ta=Ghế Gaming Công thái học • Lưng da PU cao cấp (Bên hông) và vải (ơ giữa) • Tải trọng 136 kg • Ngả lưng 152°                                |
| T09 | o-cung-ssd-corsair-mp600-core-xt-1tb-pcie-40-gen4                                         | Ổ cứng SSD Corsair MP600 CORE XT 1TB PCIe 4.0 Gen4                                            |  2990000 | 1000GB; NVMe PCIe 4.0 x4                                                                                                                         |
| T09 | o-cung-ssd-kingston-nv3-1tb-m2-pcie-nvme-gen4                                             | Ổ cứng SSD Kingston NV3 1TB M.2 PCIe NVMe Gen4                                                |  4990000 | 1000GB; NVMe PCIe 4.0 x4                                                                                                                         |
| T09 | o-cung-ssd-msi-spatium-m480-pro-pcie-40-nvme-m2-1tb                                       | Ổ cứng SSD MSI SPATIUM M480 PRO PCIe 4.0 NVMe M.2 1TB                                         |  4990000 | 1000GB; NVMe PCIe 4.0 x4                                                                                                                         |
| T09 | o-cung-ssd-samsung-9100-pro-nvme-m2-1tb-gen5                                              | Ổ cứng SSD Samsung 9100 PRO NVMe M.2 1TB Gen5                                                 |  6990000 | 1000GB; NVMe PCIe 5.0 x4                                                                                                                         |
| T09 | o-cung-ssd-samsung-990-evo-plus-1tb-m2-pcie-gen4-nvme                                     | Ổ cứng SSD Samsung 990 EVO Plus 1TB M.2 PCIe Gen4 NVMe                                        |  7190000 | 1000GB; NVMe PCIe 4.0 x4                                                                                                                         |
| T10 | nguon-may-tinh-nzxt-c750w-80-plus-bronze-non-modular-750w                                 | Nguồn máy tính NZXT C750W - 80 Plus Bronze - Non Modular (750W)                               |  1390000 | 750W; 80 Plus Bronze                                                                                                                             |
| T10 | nguon-may-tinh-fsp-vic-bd-750w-80-plus-bronze                                             | Nguồn máy tính FSP VIC BD 750W - 80 Plus Bronze                                               |  1590000 | 750W; 80 Plus Bronze                                                                                                                             |
| T10 | nguon-may-tinh-msi-mag-a750bn-pcie5-80-plus-bronze-750w                                   | Nguồn máy tính MSI MAG A750BN PCIE5 - 80 Plus Bronze (750W)                                   |  1690000 | 750W; 80 Plus Bronze                                                                                                                             |
| T10 | nguon-may-tinh-cooler-master-mwe-gold-1250w-v2-atx31-80-plus-gold-full-modular            | Nguồn máy tính Cooler Master MWE GOLD 1250W V2 ATX3.1 - 80 Plus Gold - Full Modular           |  5490000 | 1250W; 80 Plus Gold                                                                                                                              |
| T10 | nguon-may-tinh-lian-li-edge-1300w-black-l-shape-80-plus-platinum-full-modular             | Nguồn máy tính Lian Li EDGE 1300W Black L-Shape - 80 Plus Platinum - Full Modular             |  5490000 | 1300W; 80 Plus Platinum                                                                                                                          |
| T10 | nguon-may-tinh-msi-mag-a1250gl-pcie5-80-plus-gold-full-modular-1250w                      | Nguồn máy tính MSI MAG A1250GL PCIE5 - 80 Plus Gold - Full Modular (1250W)                    |  5490000 | 1250W; 80 Plus Gold                                                                                                                              |
| T10 | nguon-may-tinh-lian-li-edge-1300w-white-l-shape-80-plus-platinum-full-modular             | Nguồn máy tính Lian Li EDGE 1300W White L-Shape - 80 Plus Platinum - Full Modular             |  5990000 | 1300W; 80 Plus Gold                                                                                                                              |
| T10 | nguon-may-tinh-corsair-rm1200x-shift-white-atx-31-80-plus-gold-full-modular-1200w         | Nguồn máy tính Corsair RM1200x SHIFT White ATX 3.1 - 80 Plus Gold - Full Modular (1200W)      |  6150000 | 1200W; 80 Plus Gold                                                                                                                              |
| T10 | nguon-may-tinh-cooler-master-v-platinum-1600-v2-1600w-80-plus-platinum-full-modular       | Nguồn máy tính Cooler Master V Platinum 1600 V2 - 1600W - 80 Plus Platinum - Full Modular     |  7890000 | 1600W; 80 Plus Platinum                                                                                                                          |
| T11 | vo-case-asus-a21-white                                                                    | Vỏ case ASUS A21 WHITE                                                                        |  1690000 | caseFormFactors=["mATX", "ITX"]                                                                                                                  |
| T11 | vo-case-lian-li-a3-matx-black-mat-go-truoc                                                | Vỏ case Lian Li A3 mATX Black (Mặt gỗ trước)                                                  |  2290000 | caseFormFactors=["mATX", "ITX"]                                                                                                                  |
| T11 | vo-case-msi-mag-pano-m100r-pz-white                                                       | Vỏ case MSI MAG PANO M100R PZ WHITE                                                           |  2990000 | caseFormFactors=["mATX", "ITX"]                                                                                                                  |
| T12 | ram-corsair-vengeance-rgb-ddr5-32gb                                                       | RAM Corsair Vengeance RGB DDR5 32GB 6000MHz                                                   |  2890000 | DDR5; 32GB x2 thanh (kit)                                                                                                                        |
| T12 | ram-corsair-vengeance-rgb-32gb-2x16gb-5600-ddr5                                           | RAM Corsair Vengeance RGB 32GB (2x16GB) 5600 DDR5                                             | 13890000 | DDR5; 32GB x2 thanh (kit)                                                                                                                        |
| T12 | ram-corsair-dominator-titanium-black-32gb-2x16gb-rgb-6000-ddr5                            | RAM Corsair Dominator Titanium Black 32GB (2x16GB) RGB 6000 DDR5                              | 14990000 | DDR5; 32GB x2 thanh (kit)                                                                                                                        |
| T13 | bo-mach-chu-asus-tuf-gaming-b650m-e-wifi-ddr5                                             | Bo mạch chủ ASUS TUF GAMING B650M-E WIFI (DDR5)                                               |  4390000 | socket=AM5                                                                                                                                       |
| T13 | bo-mach-chu-gigabyte-x870-eagle-wifi7-ddr5                                                | Bo mạch chủ GIGABYTE X870 EAGLE WIFI7 (DDR5)                                                  |  6490000 | socket=AM5                                                                                                                                       |
| T13 | bo-mach-chu-asus-tuf-gaming-x870-plus-wifi-ddr5                                           | Bo mạch chủ ASUS TUF GAMING X870-PLUS WIFI (DDR5)                                             |  9990000 | socket=AM5                                                                                                                                       |
| T13 | bo-mach-chu-gigabyte-x870-aorus-elite-wifi7-ice-ddr5                                      | Bo mạch chủ GIGABYTE X870 AORUS ELITE WIFI7 ICE (DDR5)                                        |  9990000 | socket=AM5                                                                                                                                       |
| T13 | bo-mach-chu-msi-mag-x870-tomahawk-wifi-ddr5                                               | Bo mạch chủ MSI MAG X870 TOMAHAWK WIFI (DDR5)                                                 | 10890000 | socket=AM5                                                                                                                                       |
| T14 | cpu-intel-core-ultra-5-245kf                                                              | CPU Intel Core Ultra 5 245KF                                                                  |  6290000 | hang=Intel; socket=LGA1851                                                                                                                       |
| T14 | cpu-intel-core-ultra-5-245k                                                               | CPU Intel Core Ultra 5 245K                                                                   |  6690000 | hang=Intel; socket=LGA1851                                                                                                                       |
| T14 | cpu-intel-core-ultra-7-265kf                                                              | CPU Intel Core Ultra 7 265KF                                                                  |  9690000 | hang=Intel; socket=LGA1851                                                                                                                       |
| T14 | cpu-intel-core-ultra-7-265k                                                               | CPU Intel Core Ultra 7 265K                                                                   | 10490000 | hang=Intel; socket=LGA1851                                                                                                                       |
| T14 | cpu-intel-core-ultra-9-285k                                                               | CPU Intel Core Ultra 9 285K                                                                   | 17990000 | hang=Intel; socket=LGA1851                                                                                                                       |
| T16 | loa-microlab-b26                                                                          | Loa Microlab B26                                                                              |   280000 | mo ta=Loa vi tính • 2 kênh • Bluetooth                                                                                                           |
| T16 | loa-thonet-vander-frei-bt-grey                                                            | Loa Thonet - Vander FREI BT Grey                                                              |   730000 | mo ta=Loa Bluetooth • 2 kênh • Bluetooth 4.0                                                                                                     |
| T16 | loa-di-dong-khang-nuoc-ipx6-sounarc-r1-portable-speaker-purple-red                        | Loa di động kháng nước IPX6 SOUNARC R1 Portable Speaker - Purple Red                          |   990000 | mo ta=Loa Bluetooth • 2 kênh • Bluetooth 5.3                                                                                                     |
| T16 | loa-microlab-m300bt                                                                       | Loa Microlab M300BT                                                                           |  1190000 | mo ta=Loa vi tính • 2.1 kênh • Bluetooth 4.0                                                                                                     |
| T16 | loa-di-dong-khang-nuoc-ipx6-sounarc-r2-portable-speaker-purple-red                        | Loa di động kháng nước IPX6 SOUNARC R2 Portable Speaker - Purple Red                          |  1300000 | mo ta=Loa di động • 2.1 kênh • Bluetooth 5.3                                                                                                     |
| T16 | loa-may-tinh-edifier-mr4                                                                  | Loa máy tính Edifier MR4                                                                      |  1790000 | mo ta=Loa kiểm âm • 2 kênh                                                                                                                       |
| T16 | loa-razer-leviathan-v2-x                                                                  | Loa Razer Leviathan V2 X                                                                      |  2590000 | mo ta=Loa Soundbar • 2 kênh • Bluetooth 5.0                                                                                                      |
| T16 | loa-soundbar-sony-ht-s100f                                                                | Loa Soundbar Sony HT-S100F                                                                    |  3490000 | mo ta=Loa Soundbar • 2 kênh • Bluetooth 4.2                                                                                                      |
| T16 | loa-razer-nommo-v2-x                                                                      | Loa Razer Nommo V2 X                                                                          |  3580000 | mo ta=Loa vi tính • 2 kênh • Bluetooth 5.3                                                                                                       |
| T16 | loa-logitech-g560                                                                         | Loa Logitech G560                                                                             |  3990000 | mo ta=Loa vi tính • 2.1 kênh • 240 W • Bluetooth 4.1                                                                                             |
| T16 | loa-may-tinh-edifier-mr5-white                                                            | Loa máy tính Edifier MR5 White                                                                |  3990000 | mo ta=Loa kiểm âm • 2 kênh • Bluetooth 6.0                                                                                                       |
| T16 | loa-khong-day-lg-xboom-go-pl7-blue                                                        | Loa Không dây LG XBOOM Go PL7 Blue                                                            |  4490000 | mo ta=Loa Bluetooth • 2 kênh • Bluetooth 5.0                                                                                                     |
| T16 | loa-razer-leviathan-v2                                                                    | Loa Razer Leviathan V2                                                                        |  5190000 | mo ta=Loa Soundbar • 2.1 kênh • Bluetooth 5.2                                                                                                    |
| T16 | loa-razer-nommo-v2                                                                        | Loa Razer Nommo V2                                                                            |  6100000 | mo ta=Loa vi tính • 2.1 kênh • Bluetooth 5.3                                                                                                     |
| T16 | loa-acoustic-energy-aego-bt2                                                              | Loa Acoustic Energy Aego BT2                                                                  |  7900000 | mo ta=Loa Bluetooth • 2 kênh • Bluetooth 4.0                                                                                                     |
| T16 | loa-active-mitchell-acoustic-ustream-one-black-piano                                      | Loa Active Mitchell Acoustic - uStream One Black Piano                                        | 17970000 | mo ta=Loa Bookshelf • 2 kênh • Bluetooth 5.0                                                                                                     |
| T17 | pc-gaming-pczone-i3-12100f-rx-6500-xt                                                     | PC Gaming PCZone i3-12100F RX 6500 XT                                                         | 15990000 | danh muc=pc-gaming                                                                                                                               |
| T17 | pc-gaming-pczone-i5-12400f-rx-6500-xt                                                     | PC Gaming PCZone i5-12400F RX 6500 XT                                                         | 16990000 | danh muc=pc-gaming                                                                                                                               |
| T17 | pc-gaming-pczone-i5-12400f-rtx-3050                                                       | PC Gaming PCZone i5-12400F RTX 3050                                                           | 17490000 | danh muc=pc-gaming                                                                                                                               |
| T18 | card-man-hinh-msi-geforce-rtx-5060-shadow-2x-oc-8gb                                       | Card màn hình MSI GeForce RTX 5060 Shadow 2X OC 8GB                                           | 13490000 |                                                                                                                                                  |
| T18 | card-man-hinh-gigabyte-geforce-rtx-5060-windforce-v2-oc-8gb                               | Card màn hình GIGABYTE GeForce RTX 5060 Windforce V2 OC 8GB                                   | 13990000 |                                                                                                                                                  |
| T18 | card-man-hinh-gigabyte-geforce-rtx-5060-ti-windforce-v2-max-oc-8gb                        | Card màn hình GIGABYTE GeForce RTX 5060 Ti Windforce V2 Max OC 8GB                            | 14890000 |                                                                                                                                                  |
| T18 | card-man-hinh-zotac-geforce-rtx-5060-ti-16gb-twin-edge-oc                                 | Card màn hình ZOTAC GeForce RTX 5060 Ti 16GB Twin Edge OC                                     | 19990000 |                                                                                                                                                  |
| T18 | card-man-hinh-asus-tuf-rtx-4070-ti-super                                                  | Card màn hình ASUS TUF RTX 4070 Ti SUPER                                                      | 23490000 |                                                                                                                                                  |
| T18 | gigabyte-rtx-4080-super-gaming-oc-16gb                                                    | GIGABYTE RTX 4080 SUPER Gaming OC 16GB                                                        | 29890000 |                                                                                                                                                  |
| T18 | card-man-hinh-gigabyte-geforce-rtx-5070-ti-eagle-oc-ice-sff-16g                           | Card màn hình GIGABYTE GeForce RTX 5070 Ti EAGLE OC ICE SFF 16G                               | 32490000 |                                                                                                                                                  |
| T18 | card-man-hinh-gigabyte-geforce-rtx-5070-ti-windforce-oc-sff-16g                           | Card màn hình GIGABYTE GeForce RTX 5070 Ti WINDFORCE OC SFF 16G                               | 36890000 |                                                                                                                                                  |
| T18 | card-man-hinh-zotac-geforce-rtx-5070-ti-solid-core-oc-16gb                                | Card màn hình ZOTAC GeForce RTX 5070 Ti Solid Core OC 16GB                                    | 36990000 |                                                                                                                                                  |
| T18 | card-man-hinh-gigabyte-geforce-rtx-5080-windforce-oc-sff-16g                              | Card màn hình GIGABYTE GeForce RTX 5080 WINDFORCE OC SFF 16G                                  | 46490000 |                                                                                                                                                  |
| T18 | card-man-hinh-zotac-geforce-rtx-5080-solid-core-oc-16gb                                   | Card màn hình ZOTAC GeForce RTX 5080 Solid Core OC 16GB                                       | 48790000 |                                                                                                                                                  |
| T18 | card-man-hinh-asus-rog-astral-geforce-rtx-5080-16gb-gddr7-oc-edition                      | Card màn hình ASUS ROG Astral GeForce RTX 5080 16GB GDDR7 OC Edition                          | 58990000 |                                                                                                                                                  |
| T19 | chuot-razer-pro-click-v2                                                                  | Chuột Razer Pro Click V2                                                                      |  2490000 | hang=Razer                                                                                                                                       |
| T19 | chuot-razer-pro-click-v2-vertical                                                         | Chuột Razer Pro Click V2 Vertical                                                             |  3040000 | hang=Razer                                                                                                                                       |
| T19 | chuot-razer-deathadder-v4-pro-black                                                       | Chuột Razer DeathAdder V4 Pro Black                                                           |  3690000 | hang=Razer                                                                                                                                       |
| T19 | chuot-razer-khong-day-viper-v4-pro-trang                                                  | Chuột Razer Không dây Viper V4 Pro Trắng                                                      |  3790000 | hang=Razer                                                                                                                                       |
| T19 | chuot-razer-basilisk-v3-pro-35k-phantom-green-edition                                     | Chuột Razer Basilisk V3 Pro 35K Phantom Green Edition                                         |  3940000 | hang=Razer                                                                                                                                       |
| T19 | chuot-razer-viper-v3-pro-counter-strike-2-edition                                         | Chuột Razer Viper V3 Pro Counter-Strike 2 Edition                                             |  4680000 | hang=Razer                                                                                                                                       |
| T20 | ban-nang-ha-warrior-duke-series-wwt801-grove-brown                                        | Bàn nâng hạ Warrior Duke Series WWT801 Grove Brown                                            |  1790000 | mo ta=Bàn nâng hạ (Thủy lực) • 68×36 cm • Cao 76 - 110 cm • Tải 30 kg                                                                            |
| T20 | ban-nang-ha-warrior-paladin-wgt604-black-version-2025                                     | Bàn nâng hạ Warrior Paladin WGT604 Black (version 2025)                                       |  2990000 | mo ta=Bàn nâng hạ (Có motor) • 140×60 cm • Cao 71 - 119 cm • Tải 60 kg                                                                           |
| T20 | ban-nang-ha-warrior-paladin-wgt604-white-version-2025                                     | Bàn nâng hạ Warrior Paladin WGT604 White (version 2025)                                       |  2990000 | mo ta=Bàn nâng hạ (Có motor) • 140×60 cm • Cao 71 - 119 cm • Tải 60 kg                                                                           |
| T20 | ban-nang-ha-warrior-paladin-series-wgt605-black                                           | Bàn nâng hạ Warrior Paladin Series WGT605 Black                                               |  3990000 | mo ta=Bàn nâng hạ (Có motor) • 140×60 cm • Cao 72 - 117 cm • Tải 90 kg                                                                           |
| T20 | ban-nang-ha-warrior-wgt606-pro-black                                                      | Bàn nâng hạ Warrior WGT606 Pro Black                                                          |  3990000 | mo ta=Bàn nâng hạ (Có motor) • 140×60 cm • Cao 73 - 118 cm • Tải 80 kg                                                                           |
| T20 | ban-cooler-master-gd120-argb                                                              | Bàn Cooler Master GD120 ARGB                                                                  |  7490000 | mo ta=Bàn Gaming / Văn phòng                                                                                                                     |
| T20 | ban-gaming-cooler-master-gd160-argb-e1                                                    | Bàn Gaming Cooler Master GD160 ARGB E1                                                        | 17890000 | mo ta=Bàn Gaming / Văn phòng                                                                                                                     |
+-----+-------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------------+----------+--------------------------------------------------------------------------------------------------------------------------------------------------+
```

Truy vấn chứng minh T15 không có sản phẩm nào và T17 không có PC văn phòng:

```sql
-- T15: co san pham tan nhiet nao dang ban khong (theo danh muc COOLER, hoac ten co "tan nhiet"/"AIO"/"liquid"/"water")?
SELECT 'T15' AS ma, COUNT(*) AS so_san_pham_tan_nhiet
FROM Product p JOIN Category c ON c.id = p.categoryId
WHERE p.status = 'ACTIVE'
  AND (c.componentType = 'COOLER' OR LOWER(p.name) COLLATE utf8mb4_bin REGEXP 'tản nhiệt|\baio\b|liquid|water');
-- San pham ACTIVE co chu "AIO" o bat ky dau (ten/mo ta ngan), de thay day la PC chu khong phai tan nhiet
SELECT p.slug, p.name, c.slug AS danh_muc, p.shortDescription
FROM Product p JOIN Category c ON c.id = p.categoryId
WHERE p.status = 'ACTIVE' AND CONCAT(p.name, ' ', IFNULL(p.shortDescription, '')) COLLATE utf8mb4_bin REGEXP 'AIO|tản nhiệt nước';
-- T17: PC de ban dang ban theo danh muc, va so PC co chu "van phong"/"office" trong ten hoac mo ta
SELECT c.slug AS danh_muc, COUNT(*) AS so_pc,
       SUM(LOWER(CONCAT(p.name, ' ', IFNULL(p.shortDescription, ''))) COLLATE utf8mb4_bin REGEXP 'văn phòng|office') AS co_chu_van_phong,
       MIN(CAST(p.sellingPrice AS UNSIGNED)) AS gia_thap_nhat
FROM Product p JOIN Category c ON c.id = p.categoryId
WHERE p.status = 'ACTIVE' AND c.slug IN ('pc', 'pc-gaming', 'pc-workstation')
GROUP BY c.slug;
```

```
+-----+-----------------------+
| ma  | so_san_pham_tan_nhiet |
+-----+-----------------------+
| T15 |                     0 |
+-----+-----------------------+
+----------------------------------+----------------------------------+-----------+---------------------------------------------------+
| slug                             | name                             | danh_muc  | shortDescription                                  |
+----------------------------------+----------------------------------+-----------+---------------------------------------------------+
| pc-gaming-pczone-dragon-knight   | PC Gaming PCZone Dragon Knight   | pc-gaming | 32GB DDR5 • AIO 360 ARGB • Nguồn 850W Gold        |
| pc-gaming-pczone-ultra-master-g7 | PC Gaming PCZone Ultra Master G7 | pc-gaming | 32GB DDR5 • AIO 360 ARGB • Nguồn 1000W Gold       |
+----------------------------------+----------------------------------+-----------+---------------------------------------------------+
+----------------+-------+------------------+---------------+
| danh_muc       | so_pc | co_chu_van_phong | gia_thap_nhat |
+----------------+-------+------------------+---------------+
| pc-gaming      |    10 |                0 |      15990000 |
| pc-workstation |     4 |                0 |      72990000 |
+----------------+-------+------------------+---------------+
```

## 6. Đánh giá AI (bước 5)

- **Thời gian chạy:** 2026-10-13, từ 05:05:17 đến 05:10:12 (giờ máy, +07).
- **Số lần chạy: 1.** Không có câu nào phải thử lại (`Tong so lan phai thu lai … : 0`) và không gặp lỗi hạn mức, nên không phải chạy lại với `--delay=15000`. Mỗi câu gợi ý cấu hình chạy đúng 1 lần.
- **Chỉ mục AI lúc chạy:** `gemini-embedding-2-preview | 3072 | INDEXED | 436`. Kiểm 2 lần cách nhau 10 giây, số không đổi và bằng 436 sản phẩm ACTIVE. Log khởi động API cũng ghi "Chỉ mục AI (embedding): 436 sản phẩm".
- **Kiểm tra AI đang bật:** `GET /api/ai/search?q=laptop%20cho%20sinh%20vien` trả `usedAi = true`, 20 kết quả.
- **API:** `npm run dev:api` chạy nền suốt lượt đánh giá, log ghi ra file. Log không có dòng lỗi, cảnh báo, 429 hay 503 nào.
- **Câu search có usedAi = 0: chỉ T02** ("laptop gaming dưới 25 triệu"). Log API lúc đó không có lỗi gọi AI. AiSearchLog có ghi câu này với `parsedFilters = {"maxPrice": 25000000}` và `resultCount = 0`, tức embedding đã chạy và đã tách được mức giá. Kết luận: **AI thật sự không trả kết quả, không phải lỗi hạ tầng.** Tìm từ khoá vẫn ra đúng sản phẩm duy nhất thoả tiêu chí (ASUS TUF A15 FA507NV).

Bảng AiSearchLog của lượt chạy (nguyên văn):

```
+-------------------------------------------------+-------------+----------------------------------------------+-------------------------+
| query                                           | resultCount | parsedFilters                                | createdAt               |
+-------------------------------------------------+-------------+----------------------------------------------+-------------------------+
| laptop cho sinh vien                            |          20 | NULL                                         | 2026-10-12 22:05:07.645 |
| laptop mỏng nhẹ cho sinh viên pin lâu           |          20 | NULL                                         | 2026-10-12 22:05:18.214 |
| laptop gaming dưới 25 triệu                     |           0 | {"maxPrice": 25000000}                       | 2026-10-12 22:05:23.939 |
| chuot khong day duoi 2 trieu                    |           9 | {"maxPrice": 2000000}                        | 2026-10-12 22:05:30.671 |
| card màn hình chơi game 2K tầm 15 triệu         |           7 | {"maxPrice": 18000000, "minPrice": 12000000} | 2026-10-12 22:05:36.369 |
| màn hình 27 inch 144Hz chơi FPS                 |          20 | NULL                                         | 2026-10-12 22:05:41.940 |
| bàn phím cơ gõ êm cho văn phòng                 |          20 | NULL                                         | 2026-10-12 22:05:48.128 |
| tai nghe chụp tai có mic để họp online          |          20 | NULL                                         | 2026-10-12 22:05:53.819 |
| ghế ngồi làm việc lâu đỡ mỏi lưng               |          20 | NULL                                         | 2026-10-12 22:06:00.773 |
| ssd nvme 1tb cho laptop                         |          20 | NULL                                         | 2026-10-12 22:06:06.913 |
| nguồn máy tính 750w 80 plus gold                |          20 | NULL                                         | 2026-10-12 22:06:12.893 |
| vỏ case nhỏ gọn lắp mini itx                    |          20 | NULL                                         | 2026-10-12 22:06:19.212 |
| ram ddr5 32gb                                   |          20 | NULL                                         | 2026-10-12 22:06:25.650 |
| mainboard cho ryzen 7                           |          20 | NULL                                         | 2026-10-12 22:06:31.345 |
| cpu intel đời mới chơi game                     |          20 | NULL                                         | 2026-10-12 22:06:37.336 |
| tản nhiệt nước cho cpu                          |          20 | NULL                                         | 2026-10-12 22:06:43.125 |
| loa máy tính nghe nhạc                          |          20 | NULL                                         | 2026-10-12 22:06:49.090 |
| may tinh de ban van phong re                    |          20 | NULL                                         | 2026-10-12 22:06:55.458 |
| vga rtx                                         |          20 | NULL                                         | 2026-10-12 22:07:01.652 |
| chuột gaming razr                               |          20 | NULL                                         | 2026-10-12 22:07:07.929 |
| bàn chơi game có giá đỡ                         |          20 | NULL                                         | 2026-10-12 22:07:13.677 |
+-------------------------------------------------+-------------+----------------------------------------------+-------------------------+
```

(createdAt lưu theo giờ UTC; 22:05 UTC tương ứng 05:05 giờ Việt Nam.)

### 6.1 Toàn văn tong-ket-CHINHTHUC.txt

```
Chay tu 05:05:17 13/10/2026 den 05:10:12 13/10/2026 (gio may), API http://localhost:4000
So cau co loi (xem cot "loi"): 1. Tong so lan phai thu lai do han muc/dich vu AI ban: 0
p95 tinh theo hang gan nhat; voi n nho (10-20), p95 gan bang hoac bang gia tri lon nhat.

TIM KIEM: 20 cau, 19 cau co ky_vong va khong loi
  Hit@5       AI 16/19   | tu khoa 11/19
  Precision@5 AI 0.66   | tu khoa 0.41   (trung binh, P@5 = so ket qua dung trong 5 dau / 5)
  Do tre AI     : TB 1044 ms, p95 1717 ms (n = 20, max 1923 ms)
  Do tre tu khoa: TB 15 ms, p95 28 ms (n = 20, max 29 ms)
  AI khong tra ket qua (usedAi = 0): 1 — T02 (xem log API luc do: loi goi AI hay that su khong co ket qua)
  - nhom "nhu-cau" (7 cau): Hit@5 AI 6/7, tu khoa 3/7; P@5 AI 0.71, tu khoa 0.14
  - nhom "rang-buoc" (7 cau): Hit@5 AI 5/7, tu khoa 5/7; P@5 AI 0.46, tu khoa 0.54
  - nhom "ten-goi" (5 cau): Hit@5 AI 5/5, tu khoa 3/5; P@5 AI 0.88, tu khoa 0.60

TRO LY: 12 cau, 12 cau tra loi tron ven
  Toi khung SSE dau tien (meta, chua co chu): TB 973 ms, p95 1573 ms (n = 12, max 1573 ms)
  Toi doan chu dau tien cua cau tra loi   : TB 1794 ms, p95 2386 ms (n = 12, max 2386 ms)
  Toi khi tra loi xong                    : TB 2505 ms, p95 3137 ms (n = 12, max 3137 ms)
  Co trich dan san pham: 8/12; tong so san pham duoc trich dan: 34
  - nhom "tu-van": 9 cau
  - nhom "bay": 3 cau
  Phan dung/sai gia - thong so, va cau bay tu choi dung hay khong: cham tay o cot cham_tay_dung

GOI Y CAU HINH - tat ca: 10 cau, 9 cau tra ve cau hinh
    Ma HTTP: 200 x9, 400 x1
    Khong co van de ngay lan dau (repair = NOT_NEEDED): 1/9
    Phai sua 1 lan: REPAIRED 7 (it van de hon, CHUA chac het loi), FAILED 1
    Hop le o ket qua cuoi (isValidAtSave, sau ca buoc sua va buoc dieu chinh ngan sach): 8/9
    Trong ngan sach o ket qua cuoi: 8/8 (chi tinh cau AI hieu duoc ngan sach)
    Buoc dieu chinh ngan sach: FITTED 4, NOT_POSSIBLE 0
    So ma AI dua ra bi bo (khong co trong kho/sai loai): trung binh 0.00 moi lan
    Du 7 loai linh kien: 7/9
    Thoi gian xu ly (cau tra ve cau hinh): TB 4279 ms, p95 5265 ms (n = 9, max 5265 ms)
    B07: HTTP 400 sau 50 ms — HTTP 400: Ngân sách khoảng 3 triệu chưa đủ để ráp một bộ PC đủ linh kiện tại PCZone — bộ rẻ nhất hiện khoảng 8,8 triệu (chưa tính card đồ họa rời). Bạn thử tăng ngân sách nhé.
  - nhom "thuong": 8 cau, 8 cau tra ve cau hinh
    Ma HTTP: 200 x8
    Khong co van de ngay lan dau (repair = NOT_NEEDED): 0/8
    Phai sua 1 lan: REPAIRED 7 (it van de hon, CHUA chac het loi), FAILED 1
    Hop le o ket qua cuoi (isValidAtSave, sau ca buoc sua va buoc dieu chinh ngan sach): 7/8
    Trong ngan sach o ket qua cuoi: 8/8 (chi tinh cau AI hieu duoc ngan sach)
    Buoc dieu chinh ngan sach: FITTED 4, NOT_POSSIBLE 0
    So ma AI dua ra bi bo (khong co trong kho/sai loai): trung binh 0.00 moi lan
    Du 7 loai linh kien: 6/8
    Thoi gian xu ly (cau tra ve cau hinh): TB 4526 ms, p95 5265 ms (n = 8, max 5265 ms)
  - nhom "bien": 2 cau, 1 cau tra ve cau hinh
    Ma HTTP: 400 x1, 200 x1
    Khong co van de ngay lan dau (repair = NOT_NEEDED): 1/1
    Phai sua 1 lan: REPAIRED 0 (it van de hon, CHUA chac het loi), FAILED 0
    Hop le o ket qua cuoi (isValidAtSave, sau ca buoc sua va buoc dieu chinh ngan sach): 1/1
    Trong ngan sach o ket qua cuoi: 0/0 (chi tinh cau AI hieu duoc ngan sach)
    Buoc dieu chinh ngan sach: FITTED 0, NOT_POSSIBLE 0
    So ma AI dua ra bi bo (khong co trong kho/sai loai): trung binh 0.00 moi lan
    Du 7 loai linh kien: 1/1
    Thoi gian xu ly (cau tra ve cau hinh): TB 2308 ms, p95 2308 ms (n = 1, max 2308 ms)
    B07: HTTP 400 sau 50 ms — HTTP 400: Ngân sách khoảng 3 triệu chưa đủ để ráp một bộ PC đủ linh kiện tại PCZone — bộ rẻ nhất hiện khoảng 8,8 triệu (chưa tính card đồ họa rời). Bạn thử tăng ngân sách nhé.
```

### 6.2 SELECT model, COUNT(*) FROM AiMessage WHERE role = 'ASSISTANT' GROUP BY model;

```
+-----------------------+----------+
| model                 | COUNT(*) |
+-----------------------+----------+
| gemini-3.1-flash-lite |       12 |
+-----------------------+----------+
```

Có 12 câu trả lời của trợ lý, khớp với 12 câu chat của lượt chạy. Tất cả dùng model `gemini-3.1-flash-lite`.

### 6.3 Cách danh-gia-ai.mjs chấm và đo

- **So ky_vong:** chỉ áp dụng cho câu search. `ky_vong` gồm các mục cách nhau bằng `|`; cả hai bên được bỏ dấu, đổi `đ` thành `d`, viết thường, gộp khoảng trắng. Một kết quả là đúng khi `slug === mục` hoặc tên chứa `mục`. Trong lượt này mọi mục đều là slug. Tìm AI và tìm từ khoá chấm theo cùng một luật.
- **Hit@5** = 1 khi có ít nhất 1 kết quả đúng trong 5 kết quả đầu. **Precision@5** = số kết quả đúng trong 5 kết quả đầu / 5; mẫu số luôn là 5, kể cả khi trả về ít hơn 5 kết quả (T02 phía AI trả 0 kết quả nên P@5 = 0).
- Câu có ky_vong rỗng (T15) không được chấm. Câu có cột `loi` cũng bị loại khỏi mẫu số Hit@5/P@5. Mẫu số lượt này là 19.
- **Độ trễ:** đo ở máy chạy script, tính bằng mili giây, chỉ tính lượt thành công cuối cùng. Search: `ai_ms` gọi `GET /api/ai/search`, `tk_ms` gọi `GET /api/search?pageSize=5`. Độ trễ AI chỉ tính câu có HTTP 200. Chat có 3 mốc: tới khung SSE đầu tiên ("meta"), tới đoạn chữ đầu tiên, tới khi trả lời xong. Build: tổng thời gian một yêu cầu.
- **p95** tính theo hạng gần nhất: giá trị thứ ceil(0,95 × n) sau khi sắp tăng dần. Với n = 20 thì p95 là giá trị lớn thứ 2; với n = 12 và n = 9 thì p95 chính là giá trị lớn nhất.

### 6.4 Đối chiếu với các chỉ số báo cáo cần

**Bảng 5.5 (tìm kiếm)**

| Chỉ số | Dòng tương ứng trong tong-ket-CHINHTHUC.txt |
|---|---|
| Hit@5 | `Hit@5       AI 16/19   \| tu khoa 11/19` |
| Precision@5 | `Precision@5 AI 0.66   \| tu khoa 0.41   (trung binh, P@5 = so ket qua dung trong 5 dau / 5)` |
| Độ trễ TB / p95, tìm AI | `Do tre AI     : TB 1044 ms, p95 1717 ms (n = 20, max 1923 ms)` |
| Độ trễ TB / p95, tìm từ khoá | `Do tre tu khoa: TB 15 ms, p95 28 ms (n = 20, max 29 ms)` |
| Theo nhóm nhu-cau | `- nhom "nhu-cau" (7 cau): Hit@5 AI 6/7, tu khoa 3/7; P@5 AI 0.71, tu khoa 0.14` |
| Theo nhóm rang-buoc | `- nhom "rang-buoc" (7 cau): Hit@5 AI 5/7, tu khoa 5/7; P@5 AI 0.46, tu khoa 0.54` |
| Theo nhóm ten-goi | `- nhom "ten-goi" (5 cau): Hit@5 AI 5/5, tu khoa 3/5; P@5 AI 0.88, tu khoa 0.60` |

Ghi chú: nhóm nhu-cau có 8 câu nhưng chỉ 7 câu được chấm vì T15 không chấm. Độ trễ tính trên cả 20 câu, gồm cả T15.

**Bảng 5.6 (trợ lý), cả 3 mốc**

| Mốc | Dòng tương ứng |
|---|---|
| Tới khung SSE đầu tiên ("meta", chưa có chữ) | `Toi khung SSE dau tien (meta, chua co chu): TB 973 ms, p95 1573 ms (n = 12, max 1573 ms)` |
| Tới đoạn chữ đầu tiên | `Toi doan chu dau tien cua cau tra loi   : TB 1794 ms, p95 2386 ms (n = 12, max 2386 ms)` |
| Tổng thời gian trả lời | `Toi khi tra loi xong                    : TB 2505 ms, p95 3137 ms (n = 12, max 3137 ms)` |
| (thêm) Trích dẫn | `Co trich dan san pham: 8/12; tong so san pham duoc trich dan: 34` |

**Bảng 5.7 (gợi ý cấu hình)**

| Chỉ số | Dòng tương ứng (dòng "tat ca", 10 câu) |
|---|---|
| Không có vấn đề ngay lần đầu (NOT_NEEDED) | `Khong co van de ngay lan dau (repair = NOT_NEEDED): 1/9` |
| Phải sửa 1 lần | `Phai sua 1 lan: REPAIRED 7 (it van de hon, CHUA chac het loi), FAILED 1` |
| Hợp lệ ở kết quả cuối (isValidAtSave) | `Hop le o ket qua cuoi (isValidAtSave, sau ca buoc sua va buoc dieu chinh ngan sach): 8/9` |
| Trong ngân sách ở kết quả cuối | `Trong ngan sach o ket qua cuoi: 8/8 (chi tinh cau AI hieu duoc ngan sach)` |
| FITTED / NOT_POSSIBLE | `Buoc dieu chinh ngan sach: FITTED 4, NOT_POSSIBLE 0` |
| Số mã bị loại trung bình | `So ma AI dua ra bi bo (khong co trong kho/sai loai): trung binh 0.00 moi lan` |
| Đủ 7 loại linh kiện | `Du 7 loai linh kien: 7/9` |
| Thời gian xử lý TB / p95 | `Thoi gian xu ly (cau tra ve cau hinh): TB 4279 ms, p95 5265 ms (n = 9, max 5265 ms)` |
| Mã HTTP | `Ma HTTP: 200 x9, 400 x1` |
| B07: mã HTTP và thời gian | `B07: HTTP 400 sau 50 ms — HTTP 400: Ngân sách khoảng 3 triệu chưa đủ để ráp một bộ PC đủ linh kiện tại PCZone — bộ rẻ nhất hiện khoảng 8,8 triệu (chưa tính card đồ họa rời). Bạn thử tăng ngân sách nhé.` |
| B08: mã HTTP và thời gian | tong-ket không in riêng dòng B08. Trong nhóm "bien", B08 là câu duy nhất trả về cấu hình, ứng với các dòng `Ma HTTP: 400 x1, 200 x1` và `Thoi gian xu ly (cau tra ve cau hinh): TB 2308 ms, p95 2308 ms (n = 1, max 2308 ms)`. Trong CSV chính thức, B08 có http_status = 200, thoi_gian_ms = 2308. B08 không có ngân sách (ngan_sach_ai_hieu rỗng), AI chọn cấu hình 130.630.000đ, repair = NOT_NEEDED, hợp lệ. |

Ghi chú cho Bảng 5.7: mẫu số "trong ngân sách" là 8 vì B08 không có ngân sách. 2 cấu hình thiếu loại linh kiện thứ 7 là B02 (văn phòng) và B04 (lập trình); cả hai đều không có VGA và dùng CPU có đồ hoạ tích hợp.

**Chỉ số báo cáo cần mà script không đo**
- Bảng 5.6, tỷ lệ phát biểu giá/thông số đúng: **script không đo.** Lấy từ chấm sơ bộ ở mục 7, hai thành viên sẽ chấm lại.
- Bảng 5.6, số câu bẫy từ chối đúng: **script không đo.** Lấy từ chấm sơ bộ ở mục 7.
- Bảng 5.7, số lỗi ERROR/WARNING của từng cấu hình: **script không đo.** Script chỉ có cờ hợp lệ cuối `hop_le_cuoi` (isValidAtSave).
- Độ trễ chia theo nhóm câu: **script không đo.** Script chỉ chia Hit@5/P@5 theo nhóm.

## 7. Chấm sơ bộ (bước 6)

Mọi điểm dưới đây là **AI chấm sơ bộ**, không thay cho việc hai thành viên chấm độc lập như mục 5.6.1 mô tả. Điểm và bằng chứng đã ghi vào 2 cột `cham_tay_dung` và `ghi_chu` của `ket-qua-danh-gia-CHINHTHUC.csv`. Các cột khác giữ nguyên; script ghi điểm có tự kiểm điều này. Câu search không sửa ai_hit5/tk_hit5 và không có ghi chú, vì không thấy ky_vong nào rõ ràng sai so với luật đã chốt.

| Chỉ số | Kết quả |
|---|---|
| Số câu chat cham_tay_dung = 1 | **11/12** (chỉ H07 = 0) |
| Tổng M/N của 12 câu (sản phẩm nêu tên có trong trích dẫn / sản phẩm nêu tên) | **24/24** |
| Phát biểu giá/thông số đúng / đã kiểm | **81/82** |
| Câu bẫy từ chối đúng | **3/3** (H08, H09, H10) |

Chi tiết từng câu chat:

| Mã | cham_tay_dung | Phát biểu đúng/kiểm | M/N |
|---|---|---|---|
| H01 | 1 | 10/10 | 3/3 |
| H02 | 1 | 12/12 | 4/4 |
| H03 | 1 | 9/9 | 2/2 |
| H04 | 1 | 19/19 | 4/4 |
| H05 | 1 | 8/8 | 3/3 |
| H06 | 1 | 9/9 | 3/3 |
| H07 | **0** | 1/2 | 1/1 |
| H08 | 1 (từ chối đúng) | 0/0 | 0/0 |
| H09 | 1 (từ chối đúng) | 0/0 | 0/0 |
| H10 | 1 (từ chối đúng) | 0/0 | 0/0 |
| H11 | 1 | 13/13 | 4/4 |
| H12 | 1 | 0/0 | 0/0 |

**Phát biểu sai, kèm giá trị đúng trong CSDL**
1. H07: trợ lý nói "không có thông tin chi tiết về độ dài (mm)" của card ASUS Dual RX 6500 XT V2 OC 4GB. CSDL có `ProductSpec.gpuLengthMm = 201`, và `Product.specifications` ghi "Kích thước card: 201 x 128 x 40 mm". Đúng ra phải trả lời 201 mm. Đây có thể là dấu hiệu ngữ cảnh RAG của trợ lý chưa đưa chiều dài card vào; cần xem lại mã nếu muốn sửa.

**Điểm nghi vấn, không tính là sai, người chấm nên xem lại**
- H02: "cảm biến Focus Pro 45K mạnh mẽ nhất" (DeathAdder V4 Pro). Trong kho có Razer Viper V4 Pro dùng Focus Pro 50K, nên câu này sai nếu hiểu là "mạnh nhất cửa hàng", và đúng nếu chỉ so trong 4 con chuột trợ lý đang đưa ra.
- H05: "Logitech G512 X 98 dùng switch Hall Effect". Câu này khớp shortSpecs ("Hall Effect"), nhưng specifications ghi "81 Switch cơ học + 9 Switch Analog từ tính tuyến tính", nên chỉ đúng một phần.
- H11: trợ lý ghi MSI MAG A1250GL là 1250W, khớp tên sản phẩm và ProductSpec. Tuy vậy specifications và shortDescription của sản phẩm này lại ghi 1300 W; CSDL không nhất quán.
- H01: mẫu gợi ý đầu tiên có giá 32.990.000đ, vượt ngân sách 30 triệu. Tiêu chí "ít nhất 1 laptop ≤ 30 triệu" vẫn đạt nhờ 2 mẫu 26.990.000đ và 26.490.000đ.

**Nhận xét chủ quan cho câu build** (đã ghi vào ghi_chu)
- B01: summary của AI nói "Ryzen 5 8400F … nền tảng AM5 và RAM DDR5", nhưng cấu hình cuối, sau bước điều chỉnh ngân sách FITTED, là Ryzen 5 5500GT + B450M (AM4) + 2× RAM DDR4 8GB. Phần mô tả không khớp linh kiện thật.
- B04: cấu hình cuối không hợp lệ (FAILED, hop_le_cuoi = 0) vì RAM Corsair Vengeance DDR5 32GB được lắp với bo MSI B450M-A PRO MAX II (DDR4). Summary của AI lại ghi "32GB RAM DDR4".

## 8. Sự cố và các điểm làm khác hướng dẫn

1. Lúc bắt đầu, **5 file hỗ trợ không có trong thư mục gốc**. Anh/chị gửi nội dung qua chat, Claude lưu nguyên văn vào thư mục gốc. danh-gia-ai.mjs có chữ "ban 2" ở dòng đầu. Không biết bản gốc của `cau-hoi-mau.csv` có BOM hay không; bản lưu không có BOM, và file này chỉ dùng làm mẫu.
2. Dòng đường dẫn báo cáo Word trong bản lời nhắc đầu tiên còn để trống. Sau đó anh/chị gửi bản có đường dẫn `C:\PCZone-baocao\bao-cao.docx`.
3. **Bảng 4.7:** không chạy `sync.ts`. Số liệu phản ánh **trạng thái CSDL hiện tại** lúc 04:4x ngày 13/10/2026, không phải trạng thái "sau khi chạy sync.ts" như báo cáo ghi.
4. **thong-ke-productspec.sql** ghi mục đích "Bảng 5.9" và chỉ đếm 6 loại, không có SSD; tôi đã chạy câu bổ sung SSD/COOLER. Hàng "Tản nhiệt" của Bảng 5.8 không có dữ liệu vì cửa hàng không có danh mục và sản phẩm tản nhiệt.
5. Các file .sql được chạy thêm tuỳ chọn `--default-character-set=utf8mb4` (lệnh mẫu không có) để tên tiếng Việt không bị lỗi ký tự. Lần chạy đầu không có tuỳ chọn này cho ra đúng các con số như lần sau.
6. Lập danh sách ky_vong: lần đầu truy vấn bị lỗi `ERROR 1271 (HY000) at line 3: Illegal mix of collations for operation 'UNION'`. Tôi đã sửa bằng cách ép collation cho cột thong_so. Một lệnh shell sửa luật T11 bị lỗi cú pháp và không thay đổi gì; tôi đã làm lại bằng công cụ sửa file. File nháp `de-xuat-ky-vong.md` (bản trước khi duyệt) đã được xoá; nội dung đã chốt nằm ở mục 5.
7. API được bật bằng `npm run dev:api` chạy nền trong phiên làm việc, không phải terminal riêng, và log ghi ra file để theo dõi. Chạy xong tôi đã tắt API và giải phóng cổng 4000.
8. Trước khi ghi điểm chấm sơ bộ, CSV chính thức đã được sao lưu (bản trước khi chấm) trong thư mục nháp của phiên.
9. **Dữ liệu CSDL không nhất quán** phát hiện trong lúc làm (chỉ ghi nhận, không sửa):
   - PSU Lian Li EDGE 1300W White: tên ghi "80 Plus Platinum", ProductSpec.psuEfficiency ghi "80 Plus Gold".
   - PSU Deepcool PF550: tên ghi "80 Plus", ProductSpec ghi "80 Plus Gold".
   - PSU MSI MAG A1250GL: tên và ProductSpec ghi 1250W, specifications và shortDescription ghi 1300 W.
   - Có 4 mainboard LGA1700 nhưng không có CPU LGA1700 nào (mục 5 của thong-ke-productspec).
   - Vỏ Corsair 5000D CORE AIRFLOW có caseFormFactors chỉ là ["E-ATX"], thiếu ATX/mATX/ITX.
   - Logitech G512 X 98: shortSpecs ghi "Hall Effect", specifications ghi 81 switch cơ + 9 switch từ tính.
   - ROG Kithara (tai nghe) không có trường Micro.
10. **Bước 7:** `gen-diagrams.mjs` bản mới chỉ khác bản cũ ở 2 dòng (cách đọc `@@unique`; bảng Product hiện 15 thuộc tính). Script ghi lại cả 13 file .mmd và manifest.json. 11 file .mmd và manifest.json chỉ khác ký tự xuống dòng (LF/CRLF), nội dung giống hệt, nên tôi đã khôi phục về bản trong git cho diff gọn. Chỉ `erd-san-pham.mmd` và `erd-tong-quat.mmd` thay đổi nội dung thật: `Product ||--o| ProductImage` thành `Product ||--o{ ProductImage`, và ERD sản phẩm thêm 6 thuộc tính Product. Bản sao lưu: `docs/bao-ve/cong-cu/gen-diagrams.mjs.bak-20261013`.
11. Chưa commit gì vào git.

## 9. Sơ đồ ERD (bước 7)

- `node docs/bao-ve/cong-cu/gen-diagrams.mjs` → `Đã ghi 13 sơ đồ vào C:\Users\QUANG\Documents\Do_An\pczone\docs\bao-ve\so-do; 31 bảng, 13 enum`
- `node docs/bao-ve/cong-cu/render-diagrams.cjs erd-san-pham erd-tong-quat` → `Mermaid 11.17.2`, `✓ erd-tong-quat (4084×869px)`, `✓ erd-san-pham (2078×1657px)`
- Xác nhận: dòng 92 của `docs/bao-ve/so-do/erd-san-pham.mmd` là `  Product ||--o{ ProductImage : "productId"` → **có**.
- Ảnh PNG:
  - `C:\Users\QUANG\Documents\Do_An\pczone\docs\bao-ve\so-do\erd-san-pham.png`
  - `C:\Users\QUANG\Documents\Do_An\pczone\docs\bao-ve\so-do\erd-tong-quat.png`
  - (Bản SVG cùng tên nằm cùng thư mục.)

## Các file cần gửi đi

Tất cả nằm chung trong thư mục `C:\Users\QUANG\Documents\Do_An\pczone\ket-qua-gui-di\`:

- `ket-qua-cho-claude.md` (file này)
- `tong-ket-CHINHTHUC.txt`
- `ket-qua-danh-gia-CHINHTHUC.csv` (đã có cột chấm sơ bộ)
- `ket-qua-danh-gia-CHINHTHUC.json`
- `cau-hoi.csv`
- `erd-san-pham.png` (bản sao; bản gốc vẫn ở `docs\bao-ve\so-do\`)
- `erd-tong-quat.png` (bản sao; bản gốc vẫn ở `docs\bao-ve\so-do\`)
