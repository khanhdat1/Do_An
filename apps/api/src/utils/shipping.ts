import type { ShippingSettingsDto } from "../types/dto.js";

/**
 * Phí vận chuyển. Quy tắc đơn giản cho đồ án: miễn phí từ một mức tiền hàng trở lên, dưới mức đó thu phí cố định.
 * Hai con số (phí, ngưỡng) do chủ website chỉnh ở `/admin/settings` (mặc định 30.000đ / 500.000đ — xem
 * `settings/system-settings.ts`). Lúc tạo đơn, `order.service.ts` luôn đọc số HIỆN HÀNH rồi tính lại ở đây — không
 * cho phép trình duyệt tự gửi phí vận chuyển lên. Web xem trước bằng đúng công thức này (`apps/web/lib/shipping.ts`)
 * với số lấy từ `GET /api/settings`, không còn hằng số chép tay nào ở phía web.
 */
export function calcShippingFee(subtotal: number, config: ShippingSettingsDto): number {
  if (subtotal <= 0) return 0;
  // Ngưỡng 0 = mọi đơn đều miễn phí
  return subtotal >= config.freeThreshold ? 0 : config.flatFee;
}
