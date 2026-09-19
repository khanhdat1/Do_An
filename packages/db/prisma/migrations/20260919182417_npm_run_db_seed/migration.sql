-- AlterTable
ALTER TABLE `Product` ADD COLUMN `flashSaleQuota` INTEGER NULL,
    ADD COLUMN `giftNote` VARCHAR(200) NULL,
    ADD COLUMN `promoTag` VARCHAR(100) NULL,
    ADD COLUMN `promoTone` VARCHAR(20) NULL;
