import type { BuildCheckResult, BuildSlot } from "@/types";

export const BUILD_SLOTS: readonly BuildSlot[] = ["CPU", "MAINBOARD", "RAM", "VGA", "SSD", "PSU", "CASE"];

export const SLOT_LABEL: Record<BuildSlot, string> = {
  CPU: "CPU",
  MAINBOARD: "Mainboard",
  RAM: "RAM",
  VGA: "Card đồ họa",
  SSD: "Ổ cứng SSD",
  PSU: "Nguồn",
  CASE: "Vỏ case",
};

/** Khớp MAX_RAM_QUANTITY phía API — chỉ RAM được chọn nhiều hơn 1 */
export const MAX_RAM_QUANTITY = 4;

export type BuildSelection = Partial<Record<BuildSlot, { productId: string; quantity: number }>>;

/** Khoá trên URL trang và query của API: `?cpu=…&mainboard=…&ram=…&ramQty=2` */
export function slotParam(slot: BuildSlot): string {
  return slot.toLowerCase();
}

const PRODUCT_ID = /^[A-Za-z0-9_-]{1,50}$/;

export function selectionFromParams(params: Record<string, string | string[] | undefined>): BuildSelection {
  const selection: BuildSelection = {};
  for (const slot of BUILD_SLOTS) {
    const productId = params[slotParam(slot)];
    if (typeof productId === "string" && PRODUCT_ID.test(productId)) selection[slot] = { productId, quantity: 1 };
  }

  const ramQuantity = Number(params.ramQty);
  if (selection.RAM && Number.isInteger(ramQuantity) && ramQuantity >= 1 && ramQuantity <= MAX_RAM_QUANTITY) {
    selection.RAM.quantity = ramQuantity;
  }
  return selection;
}

export function selectionToSearch(selection: BuildSelection): string {
  const params = new URLSearchParams();
  for (const slot of BUILD_SLOTS) {
    const item = selection[slot];
    if (!item) continue;
    params.set(slotParam(slot), item.productId);
    if (slot === "RAM" && item.quantity > 1) params.set("ramQty", String(item.quantity));
  }
  return params.toString();
}

export function selectionToItems(selection: BuildSelection): { productId: string; quantity: number }[] {
  return BUILD_SLOTS.flatMap((slot) => {
    const item = selection[slot];
    return item ? [{ productId: item.productId, quantity: item.quantity }] : [];
  });
}

/** Server quyết định sản phẩm thuộc ô nào (theo danh mục) và còn dùng được không — lựa chọn đi theo kết quả đó */
export function selectionFromResult(result: BuildCheckResult): BuildSelection {
  return Object.fromEntries(result.items.map((item) => [item.slot, { productId: item.product.id, quantity: item.quantity }]));
}
