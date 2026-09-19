import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Gộp class Tailwind an toàn (class sau ghi đè class trước).
 * Dùng ở mọi component để nhận prop `className` từ bên ngoài.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
