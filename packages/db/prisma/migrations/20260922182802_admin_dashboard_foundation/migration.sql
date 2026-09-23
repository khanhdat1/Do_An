-- AlterTable
ALTER TABLE `User` ADD COLUMN `totpEnabledAt` DATETIME(3) NULL,
    ADD COLUMN `totpSecret` VARCHAR(100) NULL,
    MODIFY `role` ENUM('CUSTOMER', 'STAFF', 'ADMIN', 'OWNER', 'MANAGER', 'ORDER_STAFF', 'PRODUCT_STAFF') NOT NULL DEFAULT 'CUSTOMER';

-- CreateTable
CREATE TABLE `AdminAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `actorRole` ENUM('CUSTOMER', 'STAFF', 'ADMIN', 'OWNER', 'MANAGER', 'ORDER_STAFF', 'PRODUCT_STAFF') NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `targetType` VARCHAR(50) NOT NULL,
    `targetId` VARCHAR(50) NULL,
    `metadata` JSON NULL,
    `ip` VARCHAR(50) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminAuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
    INDEX `AdminAuditLog_targetType_targetId_idx`(`targetType`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AdminAuditLog` ADD CONSTRAINT `AdminAuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
