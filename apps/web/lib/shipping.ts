import type { ShippingSettings } from "@/types";

/**
 * Chỉ để XEM TRƯỚC phí vận chuyển ở giỏ hàng / bước đặt hàng — con số THẬT luôn do API tính lại lúc tạo
 * đơn (`apps/api/src/utils/shipping.ts`, cùng công thức), trình duyệt không tự quyết định được số tiền phải trả.
 * Phí và ngưỡng miễn phí lấy từ cài đặt hệ thống (`useStoreSettings().shipping` ← `GET /api/settings`), không còn
 * hằng số chép tay ở phía web — chủ website đổi ở `/admin/settings` là hai bên cùng đổi.
 */
export function calcShippingFee(subtotal: number, config: ShippingSettings): number {
  if (subtotal <= 0) return 0;
  // Ngưỡng 0 = mọi đơn đều miễn phí
  return subtotal >= config.freeThreshold ? 0 : config.flatFee;
}
