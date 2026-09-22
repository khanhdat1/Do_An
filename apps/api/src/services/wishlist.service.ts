import { ProductStatus, prisma } from "@pczone/db";
import { productInclude, toProductDto } from "../mappers/product.mapper.js";
import { NotFoundError } from "../middleware/errors.js";
import type { ProductDto } from "../types/dto.js";
import { isUniqueViolation } from "../utils/prisma-errors.js";

/**
 * Danh sách sản phẩm yêu thích, mới lưu trước. Sản phẩm đã ẩn/ngừng kinh doanh vẫn có thể còn nằm
 * trong danh sách (không tự xoá khỏi `WishlistItem` khi đổi trạng thái) nhưng không hiện ra ngoài —
 * cùng cách giỏ hàng không tự xoá dòng của sản phẩm đã ngừng bán, chỉ ẩn khỏi tính tiền.
 */
export async function listWishlist(userId: string): Promise<ProductDto[]> {
  const rows = await prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { product: { include: productInclude } },
  });
  return rows.filter((row) => row.product.status === ProductStatus.ACTIVE).map((row) => toProductDto(row.product));
}

/** Chỉ id — dùng để tô trạng thái nút trái tim trên lưới sản phẩm mà không phải tải cả object sản phẩm */
export async function wishlistProductIds(userId: string): Promise<string[]> {
  const rows = await prisma.wishlistItem.findMany({ where: { userId }, select: { productId: true } });
  return rows.map((row) => row.productId);
}

export async function addToWishlist(userId: string, productId: string): Promise<void> {
  const product = await prisma.product.findFirst({
    where: { id: productId, status: ProductStatus.ACTIVE },
    select: { id: true },
  });
  if (!product) throw new NotFoundError("Sản phẩm không tồn tại hoặc đã ngừng kinh doanh");

  try {
    await prisma.wishlistItem.create({ data: { userId, productId } });
  } catch (error) {
    // Đã có sẵn trong danh sách (bấm hai lần, hai tab cùng lúc) thì coi như xong, không phải lỗi
    if (!isUniqueViolation(error)) throw error;
  }
}

/** Xoá không lỗi nếu dòng đã biến mất (thao tác lặp lại từ tab khác) — cùng cách giỏ hàng xử lý */
export async function removeFromWishlist(userId: string, productId: string): Promise<void> {
  await prisma.wishlistItem.deleteMany({ where: { userId, productId } });
}
