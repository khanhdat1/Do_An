-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `imageUrl` VARCHAR(500) NULL,
    `icon` VARCHAR(191) NULL,
    `parentId` VARCHAR(191) NULL,
    `componentType` ENUM('CPU', 'MAINBOARD', 'RAM', 'VGA', 'SSD', 'HDD', 'PSU', 'CASE', 'COOLER', 'MONITOR', 'KEYBOARD', 'MOUSE', 'OTHER') NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_name_key`(`name`),
    UNIQUE INDEX `Category_slug_key`(`slug`),
    INDEX `Category_parentId_sortOrder_idx`(`parentId`, `sortOrder`),
    INDEX `Category_componentType_idx`(`componentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Brand` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `logoUrl` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `website` VARCHAR(500) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Brand_name_key`(`name`),
    UNIQUE INDEX `Brand_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `sourceUrl` VARCHAR(500) NULL,
    `costPrice` DECIMAL(14, 0) NULL,
    `sellingPrice` DECIMAL(14, 0) NOT NULL,
    `originalPrice` DECIMAL(14, 0) NULL,
    `refPrice` DECIMAL(14, 0) NULL,
    `inventoryQuantity` INTEGER NOT NULL DEFAULT 0,
    `reservedQuantity` INTEGER NOT NULL DEFAULT 0,
    `lowStockThreshold` INTEGER NOT NULL DEFAULT 5,
    `stockStatus` ENUM('IN_STOCK', 'OUT_OF_STOCK', 'PREORDER', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `shortDescription` VARCHAR(500) NULL,
    `description` LONGTEXT NULL,
    `shortSpecs` JSON NULL,
    `specifications` JSON NULL,
    `warrantyMonths` INTEGER NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'HIDDEN', 'DISCONTINUED') NOT NULL DEFAULT 'DRAFT',
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `isFlashSale` BOOLEAN NOT NULL DEFAULT false,
    `flashSaleEndsAt` DATETIME(3) NULL,
    `viewCount` INTEGER NOT NULL DEFAULT 0,
    `soldCount` INTEGER NOT NULL DEFAULT 0,
    `ratingAvg` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `ratingCount` INTEGER NOT NULL DEFAULT 0,
    `aiSearchText` LONGTEXT NULL,
    `metaTitle` VARCHAR(300) NULL,
    `metaDescription` VARCHAR(500) NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `brandId` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `scrapedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_slug_key`(`slug`),
    UNIQUE INDEX `Product_sku_key`(`sku`),
    UNIQUE INDEX `Product_sourceUrl_key`(`sourceUrl`),
    INDEX `Product_categoryId_status_sellingPrice_idx`(`categoryId`, `status`, `sellingPrice`),
    INDEX `Product_brandId_status_idx`(`brandId`, `status`),
    INDEX `Product_status_isFeatured_idx`(`status`, `isFeatured`),
    INDEX `Product_status_isFlashSale_flashSaleEndsAt_idx`(`status`, `isFlashSale`, `flashSaleEndsAt`),
    INDEX `Product_sellingPrice_idx`(`sellingPrice`),
    INDEX `Product_soldCount_idx`(`soldCount`),
    FULLTEXT INDEX `Product_name_shortDescription_idx`(`name`, `shortDescription`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductImage` (
    `id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `alt` VARCHAR(300) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `source` VARCHAR(50) NULL,
    `sourceUrl` VARCHAR(500) NULL,
    `productId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductImage_productId_position_idx`(`productId`, `position`),
    UNIQUE INDEX `ProductImage_productId_url_key`(`productId`, `url`(255)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductSpec` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `componentType` ENUM('CPU', 'MAINBOARD', 'RAM', 'VGA', 'SSD', 'HDD', 'PSU', 'CASE', 'COOLER', 'MONITOR', 'KEYBOARD', 'MOUSE', 'OTHER') NOT NULL,
    `socket` VARCHAR(50) NULL,
    `chipset` VARCHAR(50) NULL,
    `cpuCores` INTEGER NULL,
    `cpuThreads` INTEGER NULL,
    `baseClock` DECIMAL(5, 2) NULL,
    `boostClock` DECIMAL(5, 2) NULL,
    `hasIgpu` BOOLEAN NULL,
    `ramType` VARCHAR(20) NULL,
    `ramSpeed` INTEGER NULL,
    `ramCapacity` INTEGER NULL,
    `ramModules` INTEGER NULL,
    `ramSlots` INTEGER NULL,
    `maxRamGb` INTEGER NULL,
    `vramGb` INTEGER NULL,
    `gpuLengthMm` INTEGER NULL,
    `gpuSlotWidth` DECIMAL(3, 1) NULL,
    `gpuPowerPins` VARCHAR(50) NULL,
    `storageCapacityGb` INTEGER NULL,
    `storageInterface` VARCHAR(30) NULL,
    `storageFormFactor` VARCHAR(30) NULL,
    `psuWattage` INTEGER NULL,
    `psuEfficiency` VARCHAR(30) NULL,
    `psuModular` VARCHAR(20) NULL,
    `psuFormFactor` VARCHAR(20) NULL,
    `caseFormFactors` JSON NULL,
    `caseMaxGpuMm` INTEGER NULL,
    `caseMaxCoolerMm` INTEGER NULL,
    `caseMaxPsuMm` INTEGER NULL,
    `coolerHeightMm` INTEGER NULL,
    `coolerTdpWatts` INTEGER NULL,
    `tdpWatts` INTEGER NULL,
    `formFactor` VARCHAR(30) NULL,
    `extra` JSON NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductSpec_productId_key`(`productId`),
    INDEX `ProductSpec_componentType_socket_idx`(`componentType`, `socket`),
    INDEX `ProductSpec_componentType_ramType_idx`(`componentType`, `ramType`),
    INDEX `ProductSpec_componentType_psuWattage_idx`(`componentType`, `psuWattage`),
    INDEX `ProductSpec_componentType_formFactor_idx`(`componentType`, `formFactor`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `avatarUrl` VARCHAR(500) NULL,
    `role` ENUM('CUSTOMER', 'STAFF', 'ADMIN') NOT NULL DEFAULT 'CUSTOMER',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `emailVerifiedAt` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_role_isActive_idx`(`role`, `isActive`),
    INDEX `User_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Address` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `recipientName` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `province` VARCHAR(100) NOT NULL,
    `district` VARCHAR(100) NOT NULL,
    `ward` VARCHAR(100) NOT NULL,
    `streetAddress` VARCHAR(300) NOT NULL,
    `note` VARCHAR(500) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Address_userId_isDefault_idx`(`userId`, `isDefault`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `userAgent` VARCHAR(300) NULL,
    `ipAddress` VARCHAR(45) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RefreshToken_tokenHash_key`(`tokenHash`),
    INDEX `RefreshToken_userId_expiresAt_idx`(`userId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cart` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `sessionId` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Cart_userId_key`(`userId`),
    UNIQUE INDEX `Cart_sessionId_key`(`sessionId`),
    INDEX `Cart_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CartItem` (
    `id` VARCHAR(191) NOT NULL,
    `cartId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `priceAtAdd` DECIMAL(14, 0) NOT NULL,
    `buildId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CartItem_cartId_productId_key`(`cartId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `orderCode` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'PACKING', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'RETURNED') NOT NULL DEFAULT 'PENDING',
    `subtotal` DECIMAL(14, 0) NOT NULL,
    `discountAmount` DECIMAL(14, 0) NOT NULL DEFAULT 0,
    `shippingFee` DECIMAL(14, 0) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(14, 0) NOT NULL,
    `paymentMethod` ENUM('COD', 'VNPAY', 'BANK_TRANSFER') NOT NULL DEFAULT 'COD',
    `paymentStatus` ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `recipientName` VARCHAR(150) NOT NULL,
    `recipientPhone` VARCHAR(20) NOT NULL,
    `shippingProvince` VARCHAR(100) NOT NULL,
    `shippingDistrict` VARCHAR(100) NOT NULL,
    `shippingWard` VARCHAR(100) NOT NULL,
    `shippingAddress` VARCHAR(300) NOT NULL,
    `customerNote` VARCHAR(500) NULL,
    `internalNote` VARCHAR(500) NULL,
    `voucherId` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `shippedAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` VARCHAR(300) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_orderCode_key`(`orderCode`),
    INDEX `Order_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `Order_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Order_paymentStatus_idx`(`paymentStatus`),
    INDEX `Order_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `productName` VARCHAR(300) NOT NULL,
    `productSku` VARCHAR(100) NOT NULL,
    `productImage` VARCHAR(500) NULL,
    `unitPrice` DECIMAL(14, 0) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `lineTotal` DECIMAL(14, 0) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderStatusHistory` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM('PENDING', 'CONFIRMED', 'PACKING', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'RETURNED') NULL,
    `toStatus` ENUM('PENDING', 'CONFIRMED', 'PACKING', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'RETURNED') NOT NULL,
    `note` VARCHAR(300) NULL,
    `changedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderStatusHistory_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `method` ENUM('COD', 'VNPAY', 'BANK_TRANSFER') NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `amount` DECIMAL(14, 0) NOT NULL,
    `transactionNo` VARCHAR(100) NULL,
    `bankCode` VARCHAR(50) NULL,
    `responseCode` VARCHAR(10) NULL,
    `payUrl` VARCHAR(1000) NULL,
    `gatewayData` JSON NULL,
    `paidAt` DATETIME(3) NULL,
    `refundedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Payment_orderId_status_idx`(`orderId`, `status`),
    INDEX `Payment_transactionNo_idx`(`transactionNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `type` ENUM('IMPORT', 'EXPORT', 'ADJUST', 'RETURN') NOT NULL,
    `quantityChange` INTEGER NOT NULL,
    `quantityAfter` INTEGER NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `unitCost` DECIMAL(14, 0) NULL,
    `note` VARCHAR(300) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InventoryTransaction_productId_createdAt_idx`(`productId`, `createdAt`),
    INDEX `InventoryTransaction_type_createdAt_idx`(`type`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Voucher` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` VARCHAR(500) NULL,
    `discountType` ENUM('PERCENT', 'FIXED') NOT NULL,
    `discountValue` DECIMAL(14, 2) NOT NULL,
    `minOrderAmount` DECIMAL(14, 0) NULL,
    `maxDiscount` DECIMAL(14, 0) NULL,
    `usageLimit` INTEGER NULL,
    `usageCount` INTEGER NOT NULL DEFAULT 0,
    `perUserLimit` INTEGER NOT NULL DEFAULT 1,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Voucher_code_key`(`code`),
    INDEX `Voucher_isActive_startsAt_endsAt_idx`(`isActive`, `startsAt`, `endsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VoucherRedemption` (
    `id` VARCHAR(191) NOT NULL,
    `voucherId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(30) NOT NULL,
    `discountApplied` DECIMAL(14, 0) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VoucherRedemption_voucherId_userId_idx`(`voucherId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Review` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `rating` INTEGER NOT NULL,
    `title` VARCHAR(200) NULL,
    `content` TEXT NULL,
    `images` JSON NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `adminReply` TEXT NULL,
    `adminRepliedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Review_productId_isApproved_createdAt_idx`(`productId`, `isApproved`, `createdAt`),
    INDEX `Review_rating_idx`(`rating`),
    UNIQUE INDEX `Review_productId_userId_orderId_key`(`productId`, `userId`, `orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WishlistItem` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WishlistItem_userId_createdAt_idx`(`userId`, `createdAt`),
    UNIQUE INDEX `WishlistItem_userId_productId_key`(`userId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductEmbedding` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `vectorId` VARCHAR(100) NOT NULL,
    `collection` VARCHAR(100) NOT NULL DEFAULT 'pczone_products',
    `model` VARCHAR(100) NOT NULL,
    `dimensions` INTEGER NOT NULL,
    `contentHash` VARCHAR(64) NOT NULL,
    `chunkText` LONGTEXT NULL,
    `status` ENUM('PENDING', 'INDEXED', 'STALE', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `errorMessage` VARCHAR(500) NULL,
    `indexedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductEmbedding_productId_key`(`productId`),
    UNIQUE INDEX `ProductEmbedding_vectorId_key`(`vectorId`),
    INDEX `ProductEmbedding_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiConversation` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `sessionId` VARCHAR(100) NULL,
    `title` VARCHAR(300) NULL,
    `lastMessageAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AiConversation_userId_lastMessageAt_idx`(`userId`, `lastMessageAt`),
    INDEX `AiConversation_sessionId_idx`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiMessage` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'ASSISTANT', 'SYSTEM') NOT NULL,
    `content` LONGTEXT NOT NULL,
    `citedProductIds` JSON NULL,
    `retrievedChunks` JSON NULL,
    `tokensIn` INTEGER NULL,
    `tokensOut` INTEGER NULL,
    `latencyMs` INTEGER NULL,
    `model` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiMessage_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PcBuild` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `sessionId` VARCHAR(100) NULL,
    `name` VARCHAR(200) NOT NULL,
    `purpose` VARCHAR(100) NULL,
    `budget` DECIMAL(14, 0) NULL,
    `totalPrice` DECIMAL(14, 0) NOT NULL DEFAULT 0,
    `estimatedWattage` INTEGER NOT NULL DEFAULT 0,
    `recommendedPsuW` INTEGER NULL,
    `validationResult` JSON NULL,
    `isValid` BOOLEAN NOT NULL DEFAULT false,
    `isAiGenerated` BOOLEAN NOT NULL DEFAULT false,
    `aiPrompt` TEXT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `shareCode` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PcBuild_shareCode_key`(`shareCode`),
    INDEX `PcBuild_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `PcBuild_isPublic_createdAt_idx`(`isPublic`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PcBuildItem` (
    `id` VARCHAR(191) NOT NULL,
    `buildId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `componentType` ENUM('CPU', 'MAINBOARD', 'RAM', 'VGA', 'SSD', 'HDD', 'PSU', 'CASE', 'COOLER', 'MONITOR', 'KEYBOARD', 'MOUSE', 'OTHER') NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `priceAtAdd` DECIMAL(14, 0) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PcBuildItem_productId_idx`(`productId`),
    UNIQUE INDEX `PcBuildItem_buildId_componentType_key`(`buildId`, `componentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiSearchLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `sessionId` VARCHAR(100) NULL,
    `query` VARCHAR(500) NOT NULL,
    `parsedFilters` JSON NULL,
    `resultCount` INTEGER NOT NULL DEFAULT 0,
    `clickedProductId` VARCHAR(50) NULL,
    `tookMs` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiSearchLog_createdAt_idx`(`createdAt`),
    INDEX `AiSearchLog_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductImage` ADD CONSTRAINT `ProductImage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductSpec` ADD CONSTRAINT `ProductSpec_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Address` ADD CONSTRAINT `Address_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cart` ADD CONSTRAINT `Cart_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `Cart`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `Voucher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderStatusHistory` ADD CONSTRAINT `OrderStatusHistory_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryTransaction` ADD CONSTRAINT `InventoryTransaction_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryTransaction` ADD CONSTRAINT `InventoryTransaction_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryTransaction` ADD CONSTRAINT `InventoryTransaction_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoucherRedemption` ADD CONSTRAINT `VoucherRedemption_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `Voucher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoucherRedemption` ADD CONSTRAINT `VoucherRedemption_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WishlistItem` ADD CONSTRAINT `WishlistItem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WishlistItem` ADD CONSTRAINT `WishlistItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductEmbedding` ADD CONSTRAINT `ProductEmbedding_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiConversation` ADD CONSTRAINT `AiConversation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiMessage` ADD CONSTRAINT `AiMessage_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `AiConversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PcBuild` ADD CONSTRAINT `PcBuild_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PcBuildItem` ADD CONSTRAINT `PcBuildItem_buildId_fkey` FOREIGN KEY (`buildId`) REFERENCES `PcBuild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PcBuildItem` ADD CONSTRAINT `PcBuildItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiSearchLog` ADD CONSTRAINT `AiSearchLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
