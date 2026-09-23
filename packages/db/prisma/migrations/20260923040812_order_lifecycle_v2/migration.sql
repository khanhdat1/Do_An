-- AlterTable
ALTER TABLE `Order` ADD COLUMN `packedAt` DATETIME(3) NULL,
    ADD COLUMN `returnReason` VARCHAR(300) NULL,
    ADD COLUMN `returnedAt` DATETIME(3) NULL,
    ADD COLUMN `trackingNumber` VARCHAR(100) NULL;

-- AddForeignKey
ALTER TABLE `OrderStatusHistory` ADD CONSTRAINT `OrderStatusHistory_changedBy_fkey` FOREIGN KEY (`changedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
