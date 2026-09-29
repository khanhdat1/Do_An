import type { PublicSettings } from "@/types";

/**
 * Cài đặt dự phòng khi API không trả lời được — trùng `DEFAULT_SETTINGS` trong
 * `apps/api/src/settings/system-settings.ts` (đúng các số trước đây viết cứng: hotline 1800 8888, phí 30.000đ, miễn
 * phí từ 500.000đ). Số THẬT luôn lấy từ `GET /api/settings`; đổi mặc định bên API thì sửa luôn ở đây cho khớp.
 *
 * Phương thức thanh toán dự phòng chỉ để COD: lúc mất kết nối API không biết được phương thức nào đã cấu hình, và
 * trang đặt hàng vẫn tự hỏi lại `/api/payments/methods` trước khi cho đặt. Tính năng AI để bật — nếu thật sự đang
 * tắt thì API trả 503 kèm câu báo rõ, giao diện hiện đúng câu đó.
 */
export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  store: {
    hotline: "1800 8888",
    supportEmail: "support@pczone.vn",
    showroomAddress: "",
  },
  shipping: {
    flatFee: 30_000,
    freeThreshold: 500_000,
  },
  payments: { cod: true, vnpay: false, bankTransfer: false, momo: false },
  ai: { search: true, chat: true, build: true },
};
