/*
  Warnings:

  - A unique constraint covering the columns `[productId,checksum]` on the table `ProductImage` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `ProductImage` ADD COLUMN `bytes` INTEGER NULL,
    ADD COLUMN `checksum` VARCHAR(64) NULL,
    ADD COLUMN `height` INTEGER NULL,
    ADD COLUMN `localPath` VARCHAR(500) NULL,
    ADD COLUMN `needsReview` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `remoteUrl` VARCHAR(500) NULL,
    ADD COLUMN `width` INTEGER NULL;

-- CreateIndex
CREATE INDEX `ProductImage_source_needsReview_idx` ON `ProductImage`(`source`, `needsReview`);

-- CreateIndex
CREATE UNIQUE INDEX `ProductImage_productId_checksum_key` ON `ProductImage`(`productId`, `checksum`);
