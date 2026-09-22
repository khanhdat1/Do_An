/**
 * Chỉ để XEM TRƯỚC phí vận chuyển ở giỏ hàng / bước đặt hàng — con số THẬT luôn do API tính lại lúc tạo
 * đơn (`apps/api/src/utils/shipping.ts`), trình duyệt không tự quyết định được số tiền phải trả.
 * Đổi hai hằng số này thì sửa luôn bên API cho khớp.
 */
export const FREE_SHIPPING_THRESHOLD = 500_000;
export const STANDARD_SHIPPING_FEE = 30_000;

export function calcShippingFee(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
}
