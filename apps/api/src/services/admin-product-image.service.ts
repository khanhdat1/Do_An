import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { prisma, type Prisma } from "@pczone/db";
import { env } from "../env.js";
import { BadRequestError, ConflictError, NotFoundError } from "../middleware/errors.js";
import type { AdminProductDetailDto } from "../types/dto.js";
import { fileMatchesImageSignature } from "../utils/image-signature.js";
import { isUniqueViolation, retryOnTransactionConflict } from "../utils/prisma-errors.js";
import {
  checkImageCapacity,
  checkReorder,
  describeUploadedFile,
  filesOfLocalPath,
  findDuplicateUpload,
  moveToFront,
  normalizeImageOrder,
  PRODUCT_UPLOAD_PUBLIC_PREFIX,
  PRODUCT_UPLOAD_SUBDIR,
  resolveInsideDir,
  sortByStoredOrder,
} from "../utils/product-images.js";
import { getProductForAdmin, type AdminActor } from "./admin-product.service.js";
import { logAdminAction } from "./audit-log.service.js";

type Tx = Prisma.TransactionClient;

/** Một file multer đã ghi xuống đĩa (tên ngẫu nhiên trong `<IMAGE_STORAGE_DIR>/uploads/`) */
export interface UploadedImageFile {
  path: string;
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
}

const imageOrderSelect = {
  id: true,
  position: true,
  isPrimary: true,
  needsReview: true,
  createdAt: true,
  checksum: true,
  localPath: true,
  url: true,
  source: true,
} satisfies Prisma.ProductImageSelect;

type ImageRow = Prisma.ProductImageGetPayload<{ select: typeof imageOrderSelect }>;

function sha256File(path: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolvePromise(hash.digest("hex")));
  });
}

/** Xoá file, bỏ qua file đã không còn — dọn dẹp không được làm hỏng kết quả chính */
async function removeFiles(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map((path) =>
      unlink(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") console.error(`Không xoá được file ảnh ${path}:`, error);
      }),
    ),
  );
}

/**
 * Khoá dòng sản phẩm tới hết transaction (UPDATE giữ khoá dòng của InnoDB): hai quản trị viên cùng sửa bộ ảnh của MỘT
 * sản phẩm thì lần lượt từng người, không ai sắp lại thứ tự dựa trên bộ ảnh đã cũ. Đồng thời đẩy sản phẩm lên đầu danh
 * sách "mới sửa" — đổi ảnh cũng là sửa sản phẩm.
 */
async function lockProduct(tx: Tx, productId: string): Promise<void> {
  const { count } = await tx.product.updateMany({ where: { id: productId }, data: { updatedAt: new Date() } });
  if (count === 0) throw new NotFoundError("Không tìm thấy sản phẩm");
}

async function loadImages(tx: Tx, productId: string): Promise<ImageRow[]> {
  return sortByStoredOrder(await tx.productImage.findMany({ where: { productId }, select: imageOrderSelect }));
}

/** Ghi thứ tự mới (đã chuẩn hoá) — chỉ cập nhật ảnh thực sự đổi vị trí hoặc đổi vai trò ảnh chính */
async function saveOrder(tx: Tx, current: Pick<ImageRow, "id" | "position" | "isPrimary">[], ordered: Pick<ImageRow, "id" | "needsReview">[]) {
  const before = new Map(current.map((image) => [image.id, image]));
  for (const entry of normalizeImageOrder(ordered)) {
    const old = before.get(entry.id);
    if (old && old.position === entry.position && old.isPrimary === entry.isPrimary) continue;
    await tx.productImage.update({ where: { id: entry.id }, data: { position: entry.position, isPrimary: entry.isPrimary } });
  }
}

/**
 * Thêm ảnh quản trị viên tải lên (đã qua bộ lọc kiểu/dung lượng của multer) vào cuối bộ ảnh. Tất cả hoặc không gì cả:
 * một file sai chữ ký ảnh, trùng nội dung hay vượt số ảnh tối đa thì cả lượt bị từ chối và MỌI file vừa ghi bị xoá.
 */
export async function uploadProductImages(
  productId: string,
  files: UploadedImageFile[],
  admin: AdminActor,
): Promise<AdminProductDetailDto> {
  try {
    if (files.length === 0) throw new BadRequestError("Chưa chọn ảnh nào để tải lên");

    // Kiểu MIME do trình duyệt tự khai — đối chiếu nội dung thật trước khi file được phục vụ công khai
    for (const [index, file] of files.entries()) {
      if (!(await fileMatchesImageSignature(file.path, file.mimetype))) {
        throw new BadRequestError(`${describeUploadedFile(file.originalname, index)} không phải ảnh JPEG/PNG/WEBP hợp lệ`);
      }
    }
    const incoming = await Promise.all(
      files.map(async (file, index) => ({ file, checksum: await sha256File(file.path), label: describeUploadedFile(file.originalname, index) })),
    );

    await retryOnTransactionConflict(() =>
      prisma.$transaction(async (tx) => {
        await lockProduct(tx, productId);
        const existing = await loadImages(tx, productId);

        const capacityError = checkImageCapacity(existing.length, incoming.length);
        if (capacityError) throw new ConflictError(capacityError);
        const duplicateError = findDuplicateUpload(
          existing.map((image) => image.checksum),
          incoming,
        );
        if (duplicateError) throw new ConflictError(duplicateError);

        const created: ImageRow[] = [];
        for (const [index, { file, checksum }] of incoming.entries()) {
          created.push(
            await tx.productImage.create({
              data: {
                productId,
                url: `${PRODUCT_UPLOAD_PUBLIC_PREFIX}/${file.filename}`,
                localPath: `${PRODUCT_UPLOAD_SUBDIR}/${file.filename}`,
                position: existing.length + index,
                isPrimary: false,
                source: "MANUAL",
                needsReview: false,
                bytes: file.size,
                checksum,
              },
              select: imageOrderSelect,
            }),
          );
        }
        await saveOrder(tx, [...existing, ...created], [...existing, ...created]);

        await logAdminAction(tx, {
          actorId: admin.userId,
          actorRole: admin.role,
          action: "product.images_uploaded",
          targetType: "Product",
          targetId: productId,
          metadata: { count: created.length, imageIds: created.map((image) => image.id) },
        });
      }),
    );
  } catch (error) {
    await removeFiles(files.map((file) => file.path));
    // Ràng buộc unique (productId, checksum) bắt nốt trường hợp hai lượt tải cùng một ảnh chạy đồng thời
    if (isUniqueViolation(error)) throw new ConflictError("Ảnh này vừa được thêm vào sản phẩm (trùng nội dung) — tải lại trang để xem");
    throw error;
  }

  return getProductForAdmin(productId);
}

/**
 * Xoá một ảnh, rồi xoá file trên đĩa SAU khi transaction đã chốt (xoá file trước mà DB lỗi thì dòng DB còn trỏ vào file
 * đã mất). File chỉ bị xoá khi không còn dòng ảnh nào khác (kể cả của sản phẩm khác) trỏ tới. Xoá ảnh chính thì ảnh khách
 * thấy được kế tiếp tự lên làm ảnh chính.
 */
export async function deleteProductImage(productId: string, imageId: string, admin: AdminActor): Promise<AdminProductDetailDto> {
  const orphanedLocalPath = await retryOnTransactionConflict(() =>
    prisma.$transaction(async (tx) => {
      await lockProduct(tx, productId);
      const images = await loadImages(tx, productId);
      const target = images.find((image) => image.id === imageId);
      if (!target) throw new NotFoundError("Không tìm thấy ảnh này trong sản phẩm (có thể vừa bị xoá) — tải lại trang");

      await tx.productImage.delete({ where: { id: imageId } });
      const remaining = images.filter((image) => image.id !== imageId);
      await saveOrder(tx, remaining, remaining);

      await logAdminAction(tx, {
        actorId: admin.userId,
        actorRole: admin.role,
        action: "product.image_deleted",
        targetType: "Product",
        targetId: productId,
        metadata: { imageId, url: target.url, source: target.source, wasPrimary: target.isPrimary },
      });

      if (!target.localPath) return null;
      const stillUsed = await tx.productImage.count({ where: { localPath: target.localPath } });
      return stillUsed === 0 ? target.localPath : null;
    }),
  );

  if (orphanedLocalPath) {
    const paths = filesOfLocalPath(orphanedLocalPath)
      .map((relativePath) => resolveInsideDir(env.images.productDir, relativePath))
      .filter((path): path is string => path !== null);
    await removeFiles(paths);
  }

  return getProductForAdmin(productId);
}

/** Đặt ảnh chính = đưa ảnh lên đầu thứ tự. Ảnh chờ duyệt thì không: khách không nhìn thấy nó */
export async function setPrimaryProductImage(productId: string, imageId: string, admin: AdminActor): Promise<AdminProductDetailDto> {
  await retryOnTransactionConflict(() =>
    prisma.$transaction(async (tx) => {
      await lockProduct(tx, productId);
      const images = await loadImages(tx, productId);
      const target = images.find((image) => image.id === imageId);
      if (!target) throw new NotFoundError("Không tìm thấy ảnh này trong sản phẩm (có thể vừa bị xoá) — tải lại trang");
      if (target.needsReview) throw new ConflictError("Ảnh đang chờ duyệt (khách không nhìn thấy) nên không đặt làm ảnh chính được");

      const byId = new Map(images.map((image) => [image.id, image]));
      const ordered = moveToFront(
        images.map((image) => image.id),
        imageId,
      ).map((id) => byId.get(id)!);
      await saveOrder(tx, images, ordered);

      await logAdminAction(tx, {
        actorId: admin.userId,
        actorRole: admin.role,
        action: "product.image_primary_set",
        targetType: "Product",
        targetId: productId,
        metadata: { imageId, previousPrimaryId: images.find((image) => image.isPrimary)?.id ?? null },
      });
    }),
  );

  return getProductForAdmin(productId);
}

/** Sắp lại toàn bộ bộ ảnh theo `imageIds` (phải đủ và đúng các ảnh hiện có) — ảnh khách thấy được đầu tiên thành ảnh chính */
export async function reorderProductImages(productId: string, imageIds: string[], admin: AdminActor): Promise<AdminProductDetailDto> {
  await retryOnTransactionConflict(() =>
    prisma.$transaction(async (tx) => {
      await lockProduct(tx, productId);
      const images = await loadImages(tx, productId);
      const reorderError = checkReorder(
        images.map((image) => image.id),
        imageIds,
      );
      if (reorderError) throw new ConflictError(reorderError);

      const byId = new Map(images.map((image) => [image.id, image]));
      await saveOrder(
        tx,
        images,
        imageIds.map((id) => byId.get(id)!),
      );

      await logAdminAction(tx, {
        actorId: admin.userId,
        actorRole: admin.role,
        action: "product.images_reordered",
        targetType: "Product",
        targetId: productId,
        metadata: { imageIds },
      });
    }),
  );

  return getProductForAdmin(productId);
}
