/**
 * Phí vận chuyển. Quy tắc đơn giản cho đồ án: miễn phí từ một mức tiền hàng trở lên, dưới mức đó thu phí cố định.
 * Một nguồn tính duy nhất, dùng cả lúc xem trước ở giỏ hàng lẫn lúc tạo đơn thật — không cho phép trình duyệt tự
 * gửi phí vận chuyển lên.
 *
 * `apps/web/lib/shipping.ts` có bản sao hai hằng số này chỉ để xem trước ở giao diện; con số THẬT luôn tính lại
 * ở đây lúc tạo đơn. Đổi số ở đây thì sửa luôn bên web cho khớp.
 */
export const FREE_SHIPPING_THRESHOLD = 500_000;
export const STANDARD_SHIPPING_FEE = 30_000;

export function calcShippingFee(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
}
