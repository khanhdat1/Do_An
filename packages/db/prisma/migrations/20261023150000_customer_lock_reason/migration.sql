-- Khoá tài khoản khách hàng kèm lý do: lưu lý do và thời điểm khoá để trang quản trị hiển thị (trước đây lý do chỉ nằm
-- trong nhật ký quản trị). Mở khoá thì xoá cả hai cột.
ALTER TABLE `User` ADD COLUMN `lockReason` VARCHAR(300) NULL,
    ADD COLUMN `lockedAt` DATETIME(3) NULL;
