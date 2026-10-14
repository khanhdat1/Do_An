-- thong-ke-anh.sql - PCZone, Bang 4.7 (muc 4.8.5): nguon anh cua san pham dang ban.
-- CACH CHAY (PowerShell, trong thu muc chua file nay):
--   Get-Content thong-ke-anh.sql -Raw | docker exec -i pczone-mysql mysql -uroot -proot pczone --table
-- File chi dung ASCII de PowerShell khong lam hong ky tu.

-- 1. Bang 4.7: nguon san pham x nguon anh chinh (anh isPrimary = 1)
SELECT '--- 1. BANG 4.7: nguon san pham x nguon anh chinh ---' AS muc;
SELECT p.source                            AS nguon_san_pham,
       COALESCE(i.source, '(chua co anh)') AS nguon_anh_chinh,
       COUNT(*)                            AS so_san_pham
FROM Product p
LEFT JOIN ProductImage i ON i.productId = p.id AND i.isPrimary = 1
WHERE p.status = 'ACTIVE'
GROUP BY p.source, i.source
ORDER BY p.source, so_san_pham DESC;

-- 2. Doi chieu: tong san pham dang ban theo nguon (ky vong 422 GEARVN + 14 SEED = 436)
SELECT '--- 2. san pham dang ban theo nguon ---' AS muc;
SELECT IF(GROUPING(source), 'TONG', source) AS nguon_san_pham, COUNT(*) AS so_san_pham
FROM Product WHERE status = 'ACTIVE'
GROUP BY source WITH ROLLUP;

-- 3. So anh moi san pham va so anh con danh dau can xem lai (needsReview = 1)
SELECT '--- 3. so anh / san pham, anh can xem lai ---' AS muc;
SELECT p.source AS nguon_san_pham,
       COUNT(DISTINCT p.id)                   AS so_san_pham,
       COUNT(i.id)                            AS tong_anh,
       ROUND(COUNT(i.id) / COUNT(DISTINCT p.id), 1) AS anh_tb_moi_sp,
       COALESCE(SUM(i.needsReview = 1), 0)   AS anh_can_xem_lai
FROM Product p
LEFT JOIN ProductImage i ON i.productId = p.id
WHERE p.status = 'ACTIVE'
GROUP BY p.source;
