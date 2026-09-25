import type { ComponentType } from "@pczone/db";

/**
 * Các ô linh kiện của Build PC — đúng 7 loại có luật tương thích. Màn hình/bàn phím/chuột cũng có
 * `componentType` trong DB nhưng không liên quan tương thích nên không nằm ở đây.
 */
export const BUILD_SLOTS = ["CPU", "MAINBOARD", "RAM", "VGA", "SSD", "PSU", "CASE"] as const satisfies readonly ComponentType[];

export type BuildSlot = (typeof BUILD_SLOTS)[number];

export function isBuildSlot(value: string): value is BuildSlot {
  return (BUILD_SLOTS as readonly string[]).includes(value);
}

/** Tên hiển thị trong thông báo kiểm tra tương thích */
export const SLOT_LABEL_VI: Record<BuildSlot, string> = {
  CPU: "CPU",
  MAINBOARD: "Mainboard",
  RAM: "RAM",
  VGA: "Card đồ họa",
  SSD: "Ổ cứng SSD",
  PSU: "Nguồn",
  CASE: "Vỏ case",
};

/** Chỉ RAM được chọn nhiều hơn 1 (mua 2 kit/2 thanh…); các ô còn lại luôn đúng 1 */
export const MAX_RAM_QUANTITY = 4;
