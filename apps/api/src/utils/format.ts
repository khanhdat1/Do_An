/** 41990000 -> "41.990.000đ" */
export function formatPrice(value: number): string {
  return `${value.toLocaleString("vi-VN")}đ`;
}
