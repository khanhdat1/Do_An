-- Cột reservedQuantity chưa từng được ghi (đặt hàng trừ thẳng inventoryQuantity trong transaction), mọi dòng đều 0.
-- Bỏ đi để "còn hàng" chỉ còn một nguồn: inventoryQuantity.
ALTER TABLE `Product` DROP COLUMN `reservedQuantity`;
