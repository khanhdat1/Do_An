-- thong-ke-productspec.sql  (ban 2 - khop voi apps/api/src/pc-build/compatibility.ts)
-- PCZone - do do phu ProductSpec (muc 5.7.1, Bang 5.9).
--
-- CACH CHAY (PowerShell, trong thu muc chua file nay):
--   Get-Content thong-ke-productspec.sql -Raw | docker exec -i pczone-mysql mysql -uroot -proot pczone --table
--
-- NGUYEN TAC DEM: mau so la SAN PHAM dang ban trong danh muc (Product -> Category.componentType),
-- khong phai so dong trong ProductSpec. San pham chua co dong ProductSpec van bi tinh la "thieu".
--
-- TRUONG BAT BUOC = truong ma 7 luat kiem tra trong compatibility.ts can (luat thu 8, CPU_COOLER,
-- chi o muc INFO nen khong tinh):
--   CPU_SOCKET            CPU.socket, MAINBOARD.socket
--   RAM_TYPE              RAM.ramType, MAINBOARD.ramType
--   VGA_LENGTH            VGA.gpuLengthMm, CASE.caseMaxGpuMm
--   PSU_WATTAGE           PSU.psuWattage, CPU (extra.maxPowerW hoac tdpWatts), VGA.tdpWatts
--   MAINBOARD_FORM_FACTOR MAINBOARD.formFactor, CASE.caseFormFactors (mang khong rong)
--   RAM_SLOTS             RAM.ramModules, MAINBOARD.ramSlots
--   NO_DISPLAY_OUTPUT     CPU.hasIgpu
-- Gom theo loai:
--   CPU: socket, cong suat (maxPowerW/tdpWatts), hasIgpu
--   MAINBOARD: socket, ramType, formFactor, ramSlots
--   RAM: ramType, ramModules        VGA: gpuLengthMm, tdpWatts
--   CASE: caseMaxGpuMm, caseFormFactors                 PSU: psuWattage
--
-- File chi dung ASCII de PowerShell khong lam hong ky tu.


-- 1. Danh muc nao da gan componentType, va co bao nhieu san pham dang ban.
--    Ky vong: du 6 loai CPU, MAINBOARD, RAM, VGA, CASE, PSU, moi loai > 0.
SELECT '--- 1. danh muc -> componentType ---' AS muc;
SELECT c.componentType, c.name AS danh_muc, COUNT(p.id) AS san_pham_dang_ban
FROM Category c
LEFT JOIN Product p ON p.categoryId = c.id AND p.status = 'ACTIVE'
WHERE c.componentType IS NOT NULL
GROUP BY c.componentType, c.name
ORDER BY c.componentType, c.name;


-- Bang tam: moi san pham linh kien dang ban + cac co "co truong" (1/0)
DROP TEMPORARY TABLE IF EXISTS pcz_spec;
CREATE TEMPORARY TABLE pcz_spec AS
SELECT c.componentType AS loai,
       p.id, p.sku,
       (s.id IS NOT NULL)                                            AS co_spec,
       (s.socket IS NOT NULL)                                        AS c_socket,
       (s.ramType IS NOT NULL)                                       AS c_ramType,
       (s.formFactor IS NOT NULL)                                    AS c_formFactor,
       (s.ramSlots IS NOT NULL)                                      AS c_ramSlots,
       (s.ramModules IS NOT NULL)                                    AS c_ramModules,
       (s.gpuLengthMm IS NOT NULL)                                   AS c_gpuLengthMm,
       (s.caseMaxGpuMm IS NOT NULL)                                  AS c_caseMaxGpuMm,
       (IFNULL(JSON_TYPE(s.caseFormFactors), '') = 'ARRAY'
          AND JSON_LENGTH(s.caseFormFactors) > 0)                    AS c_caseFormFactors,
       (s.psuWattage IS NOT NULL)                                    AS c_psuWattage,
       (s.tdpWatts IS NOT NULL)                                      AS c_tdpWatts,
       (s.tdpWatts IS NOT NULL
          OR IFNULL(JSON_TYPE(JSON_EXTRACT(s.extra, '$.maxPowerW')), 'NULL') <> 'NULL') AS c_cpuPower,
       (s.hasIgpu IS NOT NULL)                                       AS c_hasIgpu
FROM Product p
JOIN Category c ON c.id = p.categoryId
LEFT JOIN ProductSpec s ON s.productId = p.id
WHERE p.status = 'ACTIVE'
  AND c.componentType IN ('CPU','MAINBOARD','RAM','VGA','CASE','PSU');


-- 2. BANG 5.9: do phu theo loai linh kien.
--    du_truong_bat_buoc = co du MOI truong bat buoc cua loai do (xem dau file).
--    Dong TONG chi cong 6 loai nay, nen KHONG bang tong so san pham dang ban.
SELECT '--- 2. BANG 5.9: do phu ProductSpec ---' AS muc;
SELECT * FROM (
  SELECT IF(GROUPING(loai), 'TONG', loai) AS loai,
         COUNT(*)     AS san_pham,
         SUM(co_spec) AS co_dong_spec,
         SUM(du)      AS du_truong_bat_buoc,
         ROUND(100 * SUM(du) / COUNT(*), 1) AS ty_le_pct
  FROM (
    SELECT loai, co_spec,
           (CASE loai
              WHEN 'CPU'       THEN c_socket AND c_cpuPower AND c_hasIgpu
              WHEN 'MAINBOARD' THEN c_socket AND c_ramType AND c_formFactor AND c_ramSlots
              WHEN 'RAM'       THEN c_ramType AND c_ramModules
              WHEN 'VGA'       THEN c_gpuLengthMm AND c_tdpWatts
              WHEN 'CASE'      THEN c_caseMaxGpuMm AND c_caseFormFactors
              WHEN 'PSU'       THEN c_psuWattage
            END) AS du
    FROM pcz_spec
  ) t
  GROUP BY loai WITH ROLLUP
) x
ORDER BY FIELD(loai, 'CPU','MAINBOARD','RAM','VGA','CASE','PSU','TONG');


-- 3. Thieu truong nao (de viet nguyen nhan). thieu = so san pham de trong truong do,
--    gom ca san pham chua co dong ProductSpec. congSuat = extra.maxPowerW hoac tdpWatts.
SELECT '--- 3. thieu truong nao ---' AS muc;
SELECT t.loai, f.truong, COUNT(*) AS san_pham,
       SUM(NOT (CASE f.truong
                  WHEN 'socket'          THEN c_socket
                  WHEN 'congSuat'        THEN c_cpuPower
                  WHEN 'hasIgpu'         THEN c_hasIgpu
                  WHEN 'ramType'         THEN c_ramType
                  WHEN 'formFactor'      THEN c_formFactor
                  WHEN 'ramSlots'        THEN c_ramSlots
                  WHEN 'ramModules'      THEN c_ramModules
                  WHEN 'gpuLengthMm'     THEN c_gpuLengthMm
                  WHEN 'tdpWatts'        THEN c_tdpWatts
                  WHEN 'caseMaxGpuMm'    THEN c_caseMaxGpuMm
                  WHEN 'caseFormFactors' THEN c_caseFormFactors
                  WHEN 'psuWattage'      THEN c_psuWattage
                END)) AS thieu
FROM pcz_spec t
JOIN (
            SELECT 'CPU' AS loai, 'socket' AS truong
  UNION ALL SELECT 'CPU', 'congSuat'
  UNION ALL SELECT 'CPU', 'hasIgpu'
  UNION ALL SELECT 'MAINBOARD', 'socket'
  UNION ALL SELECT 'MAINBOARD', 'ramType'
  UNION ALL SELECT 'MAINBOARD', 'formFactor'
  UNION ALL SELECT 'MAINBOARD', 'ramSlots'
  UNION ALL SELECT 'RAM', 'ramType'
  UNION ALL SELECT 'RAM', 'ramModules'
  UNION ALL SELECT 'VGA', 'gpuLengthMm'
  UNION ALL SELECT 'VGA', 'tdpWatts'
  UNION ALL SELECT 'CASE', 'caseMaxGpuMm'
  UNION ALL SELECT 'CASE', 'caseFormFactors'
  UNION ALL SELECT 'PSU', 'psuWattage'
) f ON f.loai = t.loai
GROUP BY t.loai, f.truong
ORDER BY FIELD(t.loai, 'CPU','MAINBOARD','RAM','VGA','CASE','PSU'), f.truong;


-- 4. ProductSpec gan sai loai so voi danh muc cua san pham. Ky vong: 0.
SELECT '--- 4. ProductSpec sai loai ---' AS muc;
SELECT COUNT(*) AS spec_sai_loai
FROM Product p
JOIN Category c ON c.id = p.categoryId
JOIN ProductSpec s ON s.productId = p.id
WHERE c.componentType IS NOT NULL AND s.componentType <> c.componentType;


-- 5. Gia tri socket / loai RAM khong co "doi tac" so sanh duoc bang dau =.
--    Ket qua rong = khong co gia tri le doi. VD "LGA1700" va "LGA 1700" se hien o day.
SELECT '--- 5. gia tri le doi ---' AS muc;
SELECT 'CPU.socket khong co mainboard khop' AS van_de, s.socket AS gia_tri, COUNT(*) AS n
FROM ProductSpec s
WHERE s.componentType = 'CPU' AND s.socket IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ProductSpec m WHERE m.componentType = 'MAINBOARD' AND m.socket = s.socket)
GROUP BY s.socket
UNION ALL
SELECT 'MAINBOARD.socket khong co CPU khop', s.socket, COUNT(*)
FROM ProductSpec s
WHERE s.componentType = 'MAINBOARD' AND s.socket IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ProductSpec c WHERE c.componentType = 'CPU' AND c.socket = s.socket)
GROUP BY s.socket
UNION ALL
SELECT 'RAM.ramType khong co mainboard khop', s.ramType, COUNT(*)
FROM ProductSpec s
WHERE s.componentType = 'RAM' AND s.ramType IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ProductSpec m WHERE m.componentType = 'MAINBOARD' AND m.ramType = s.ramType)
GROUP BY s.ramType
UNION ALL
SELECT 'MAINBOARD.ramType khong co RAM khop', s.ramType, COUNT(*)
FROM ProductSpec s
WHERE s.componentType = 'MAINBOARD' AND s.ramType IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ProductSpec r WHERE r.componentType = 'RAM' AND r.ramType = s.ramType)
GROUP BY s.ramType;


-- 6. Mau doi chieu tay: toi da 4 san pham moi loai, chon theo MD5 cua id nen chay lai ra
--    dung cac san pham do. Doi chieu voi trang nguon, ghi "k/tong gia tri dung" duoi Bang 5.9.
SELECT '--- 6. mau doi chieu tay ---' AS muc;
SELECT loai, sku, socket, ramType, formFactor, ramSlots, ramModules, hasIgpu,
       gpuLengthMm, caseMaxGpuMm, caseFormFactors, psuWattage, tdpWatts, maxPowerW
FROM (
  SELECT c.componentType AS loai, p.sku,
         s.socket, s.ramType, s.formFactor, s.ramSlots, s.ramModules, s.hasIgpu,
         s.gpuLengthMm, s.caseMaxGpuMm, s.caseFormFactors, s.psuWattage, s.tdpWatts,
         JSON_EXTRACT(s.extra, '$.maxPowerW') AS maxPowerW,
         ROW_NUMBER() OVER (PARTITION BY c.componentType ORDER BY MD5(p.id)) AS rn
  FROM Product p
  JOIN Category c ON c.id = p.categoryId
  JOIN ProductSpec s ON s.productId = p.id
  WHERE p.status = 'ACTIVE'
    AND c.componentType IN ('CPU','MAINBOARD','RAM','VGA','CASE','PSU')
) t
WHERE rn <= 4
ORDER BY FIELD(loai, 'CPU','MAINBOARD','RAM','VGA','CASE','PSU'), rn;

DROP TEMPORARY TABLE IF EXISTS pcz_spec;
