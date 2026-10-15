import { ProductStatus, type Prisma } from "@pczone/db";
import type { CartDto, CartItemDto, CartItemIssue } from "../types/dto.js";
import { MAX_QUANTITY_PER_LINE } from "../utils/limits.js";
import { buildCategoryPath, productInclude } from "./product.mapper.js";

export const cartInclude = {
  items: {
    // Theo thời điểm thêm: dòng không nhảy vị trí khi khách đổi số lượng
    orderBy: { createdAt: "asc" },
    include: { product: { include: productInclude } },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
type CartItemRow = CartWithItems["items"][number];

export const EMPTY_CART: CartDto = {
  items: [],
  itemCount: 0,
  subtotal: 0,
  hasBlockingIssues: false,
};

/** Số lượng còn có thể bán = tồn kho trừ phần đã giữ cho đơn chưa hoàn tất */
export function availableQuantity(product: {
  inventoryQuantity: number;
  reservedQuantity: number;
}): number {
  return Math.max(0, product.inventoryQuantity - product.reservedQuantity);
}

function toCartItemDto(item: CartItemRow): CartItemDto {
  const { product } = item;
  const available = availableQuantity(product);
  const isActive = product.status === ProductStatus.ACTIVE;
  const maxQuantity = isActive ? Math.min(available, MAX_QUANTITY_PER_LINE) : 0;

  let issue: CartItemIssue | undefined;
  if (!isActive) issue = "UNAVAILABLE";
  else if (available === 0) issue = "OUT_OF_STOCK";
  else if (item.quantity > maxQuantity) issue = "INSUFFICIENT_STOCK";

  const unitPrice = Number(product.sellingPrice);
  const priceAtAdd = Number(item.priceAtAdd);
  const originalPrice = product.originalPrice === null ? undefined : Number(product.originalPrice);

  return {
    id: item.id,
    productId: product.id,
    slug: product.slug,
    name: product.name,
    image: product.images[0]?.url ?? undefined,
    brand: product.brand?.name ?? undefined,
    categoryPath: buildCategoryPath(product.category),
    unitPrice,
    oldPrice: originalPrice && originalPrice > unitPrice ? originalPrice : undefined,
    priceAtAdd,
    priceChanged: unitPrice !== priceAtAdd,
    quantity: item.quantity,
    maxQuantity,
    lineTotal: unitPrice * item.quantity,
    issue,
  };
}

export function toCartDto(cart: CartWithItems): CartDto {
  const items = cart.items.map(toCartItemDto);

  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    // Dòng đã ngừng bán / hết hàng không được tính vào tiền phải trả
    subtotal: items
      .filter((item) => item.issue !== "UNAVAILABLE" && item.issue !== "OUT_OF_STOCK")
      .reduce((sum, item) => sum + item.lineTotal, 0),
    hasBlockingIssues: items.some((item) => item.issue !== undefined),
  };
}
