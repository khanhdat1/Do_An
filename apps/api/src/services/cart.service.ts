import { randomBytes } from "node:crypto";
import { Prisma, prisma, ProductStatus } from "@pczone/db";
import {
  availableQuantity,
  cartInclude,
  EMPTY_CART,
  toCartDto,
} from "../mappers/cart.mapper.js";
import { ConflictError, NotFoundError, UnauthorizedError } from "../middleware/errors.js";
import type { CartDto } from "../types/dto.js";
import { MAX_CART_LINES, MAX_QUANTITY_PER_LINE } from "../utils/limits.js";
import { isUniqueViolation } from "../utils/prisma-errors.js";

/**
 * Chủ của giỏ hàng: người đã đăng nhập (theo userId) hoặc khách vãng lai
 * (theo sessionId lấy từ cookie). Khớp hai cột nullable + unique trên bảng Cart.
 */
export type CartOwner = { userId: string } | { sessionId: string };

const GUEST_SESSION_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

export function generateGuestSessionId(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Giá trị cookie do client gửi lên nên phải kiểm tra hình dạng trước khi dùng
 * làm khoá tra cứu / tạo giỏ mới.
 */
export function isValidGuestSessionId(value: string): boolean {
  return GUEST_SESSION_PATTERN.test(value);
}

function ownerWhere(owner: CartOwner): Prisma.CartWhereUniqueInput {
  return "userId" in owner ? { userId: owner.userId } : { sessionId: owner.sessionId };
}

async function findOrCreateCart(owner: CartOwner) {
  const existing = await prisma.cart.findUnique({ where: ownerWhere(owner) });
  if (existing) return existing;

  try {
    return await prisma.cart.create({ data: { ...owner } });
  } catch (error) {
    // Hai request đầu tiên của cùng một khách chạy song song: bên thua đọc lại giỏ bên thắng vừa tạo
    if (isUniqueViolation(error)) {
      const winner = await prisma.cart.findUnique({ where: ownerWhere(owner) });
      if (winner) return winner;
    }

    // Access token còn hạn nhưng người dùng không còn trong DB (xoá tài khoản, reset DB lúc dev):
    // trả 401 để frontend refresh, thấy phiên đã chết rồi tự về chế độ khách
    if (
      "userId" in owner &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      throw new UnauthorizedError("Phiên đăng nhập không còn hiệu lực");
    }

    throw error;
  }
}

/** Đánh dấu giỏ vừa có thay đổi — để sau này dọn giỏ vãng lai bỏ quên theo updatedAt */
async function touchCart(owner: CartOwner) {
  await prisma.cart.updateMany({ where: ownerWhere(owner), data: { updatedAt: new Date() } });
}

/** Giỏ của owner; chưa có thì trả giỏ rỗng (đọc không tạo bản ghi nào) */
export async function getCart(owner: CartOwner | null): Promise<CartDto> {
  if (!owner) return EMPTY_CART;

  const cart = await prisma.cart.findUnique({
    where: ownerWhere(owner),
    include: cartInclude,
  });
  return cart ? toCartDto(cart) : EMPTY_CART;
}

/** Trần số lượng của một sản phẩm: không quá tồn kho và không quá trần mỗi dòng */
function quantityLimit(available: number): { limit: number; reason: string } {
  if (available < MAX_QUANTITY_PER_LINE) {
    return { limit: available, reason: `kho chỉ còn ${available} sản phẩm` };
  }
  return {
    limit: MAX_QUANTITY_PER_LINE,
    reason: `mỗi sản phẩm chỉ được mua tối đa ${MAX_QUANTITY_PER_LINE} cái`,
  };
}

export async function addItem(
  owner: CartOwner,
  productId: string,
  quantity: number,
): Promise<CartDto> {
  const product = await prisma.product.findFirst({
    where: { id: productId, status: ProductStatus.ACTIVE },
    select: {
      id: true,
      sellingPrice: true,
      inventoryQuantity: true,
      reservedQuantity: true,
    },
  });
  if (!product) throw new NotFoundError("Sản phẩm không tồn tại hoặc đã ngừng kinh doanh");

  const available = availableQuantity(product);
  if (available === 0) throw new ConflictError("Sản phẩm đã hết hàng");

  const { limit, reason } = quantityLimit(available);
  const cart = await findOrCreateCart(owner);

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });
  const inCart = existing?.quantity ?? 0;

  if (inCart + quantity > limit) {
    throw new ConflictError(
      inCart > 0
        ? `Không thể thêm: ${reason} (bạn đã có ${inCart} trong giỏ)`
        : `Không thể thêm: ${reason}`,
    );
  }

  if (existing) {
    // Điều kiện quantity <= limit - quantity nằm ngay trong câu UPDATE: hai request
    // cộng dồn cùng lúc cũng không thể đẩy số lượng vượt trần.
    const updated = await prisma.cartItem.updateMany({
      where: { id: existing.id, quantity: { lte: limit - quantity } },
      data: { quantity: { increment: quantity }, priceAtAdd: product.sellingPrice },
    });
    if (updated.count === 0) {
      throw new ConflictError("Giỏ hàng vừa thay đổi, vui lòng thử lại");
    }
  } else {
    const lines = await prisma.cartItem.count({ where: { cartId: cart.id } });
    if (lines >= MAX_CART_LINES) {
      throw new ConflictError(`Giỏ hàng chỉ chứa tối đa ${MAX_CART_LINES} sản phẩm khác nhau`);
    }

    try {
      await prisma.cartItem.create({
        data: { cartId: cart.id, productId, quantity, priceAtAdd: product.sellingPrice },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("Giỏ hàng vừa thay đổi, vui lòng thử lại");
      }
      throw error;
    }
  }

  await touchCart(owner);
  return getCart(owner);
}

export async function setItemQuantity(
  owner: CartOwner,
  itemId: string,
  quantity: number,
): Promise<CartDto> {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: ownerWhere(owner) },
    include: { product: true },
  });
  if (!item) throw new NotFoundError("Không tìm thấy sản phẩm trong giỏ hàng");

  if (item.product.status !== ProductStatus.ACTIVE) {
    throw new ConflictError("Sản phẩm đã ngừng kinh doanh, vui lòng xoá khỏi giỏ hàng");
  }

  const available = availableQuantity(item.product);
  if (available === 0) throw new ConflictError("Sản phẩm đã hết hàng, vui lòng xoá khỏi giỏ hàng");

  const { limit, reason } = quantityLimit(available);
  if (quantity > limit) {
    throw new ConflictError(`Không thể đặt ${quantity} sản phẩm: ${reason}`);
  }

  await prisma.cartItem.update({
    where: { id: item.id },
    // Khách vừa chủ động sửa dòng này, tức đã nhìn thấy giá hiện tại — cập nhật mốc để tắt cảnh báo đổi giá
    data: { quantity, priceAtAdd: item.product.sellingPrice },
  });

  await touchCart(owner);
  return getCart(owner);
}

/** Xoá không lỗi nếu dòng đã biến mất (thao tác lặp lại từ tab khác) */
export async function removeItem(owner: CartOwner, itemId: string): Promise<CartDto> {
  await prisma.cartItem.deleteMany({ where: { id: itemId, cart: ownerWhere(owner) } });
  await touchCart(owner);
  return getCart(owner);
}

export async function clearCart(owner: CartOwner): Promise<CartDto> {
  await prisma.cartItem.deleteMany({ where: { cart: ownerWhere(owner) } });
  await touchCart(owner);
  return EMPTY_CART;
}

/**
 * Gộp giỏ khách vãng lai vào giỏ tài khoản ngay sau khi đăng nhập / đăng ký.
 * Cùng một sản phẩm thì cộng số lượng (tới trần mỗi dòng); xong thì xoá giỏ khách.
 */
export async function mergeGuestCartIntoUser(userId: string, sessionId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const guest = await tx.cart.findUnique({
      where: { sessionId },
      include: { items: true },
    });
    if (!guest || guest.userId) return;

    const target =
      (await tx.cart.findUnique({ where: { userId } })) ??
      (await tx.cart.create({ data: { userId } }));

    const targetItems = await tx.cartItem.findMany({ where: { cartId: target.id } });
    const inTarget = new Map(targetItems.map((item) => [item.productId, item]));
    let lines = targetItems.length;

    for (const item of guest.items) {
      const existing = inTarget.get(item.productId);

      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: Math.min(MAX_QUANTITY_PER_LINE, existing.quantity + item.quantity) },
        });
      } else if (lines < MAX_CART_LINES) {
        await tx.cartItem.create({
          data: {
            cartId: target.id,
            productId: item.productId,
            quantity: Math.min(MAX_QUANTITY_PER_LINE, item.quantity),
            priceAtAdd: item.priceAtAdd,
            buildId: item.buildId,
          },
        });
        lines += 1;
      }
    }

    await tx.cart.update({ where: { id: target.id }, data: { updatedAt: new Date() } });
    await tx.cart.delete({ where: { id: guest.id } });
  });
}
