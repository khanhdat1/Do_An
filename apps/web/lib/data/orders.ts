/**
 * Chữ hiển thị và tông màu cho các trạng thái đơn hàng / thanh toán — dùng ở huy hiệu trạng thái,
 * dòng thời gian và danh sách đơn. Tách riêng để đổi câu chữ một chỗ.
 */
import type { OrderStatus, PaymentMethod, PaymentStatus, Tone } from "@/types";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  PACKING: "Đang đóng gói",
  SHIPPING: "Đang giao hàng",
  DELIVERED: "Đã giao hàng",
  CANCELLED: "Đã huỷ",
  RETURNED: "Đã hoàn trả",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  PENDING: "amber",
  CONFIRMED: "blue",
  PACKING: "blue",
  SHIPPING: "blue",
  DELIVERED: "green",
  CANCELLED: "slate",
  RETURNED: "slate",
};

/** Thứ tự các bước bình thường của một đơn (không tính hai nhánh rẽ CANCELLED / RETURNED) — dùng vẽ dòng thời gian */
export const ORDER_STEPS: OrderStatus[] = ["PENDING", "CONFIRMED", "PACKING", "SHIPPING", "DELIVERED"];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  FAILED: "Thanh toán thất bại",
  REFUNDED: "Đã hoàn tiền",
  CANCELLED: "Đã huỷ thanh toán",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = {
  PENDING: "amber",
  PAID: "green",
  FAILED: "red",
  REFUNDED: "slate",
  CANCELLED: "slate",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  COD: "Thanh toán khi nhận hàng (COD)",
  VNPAY: "Thanh toán qua VNPay",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
  MOMO: "Ví MoMo",
};

/** Vài mã lỗi VNPay phổ biến người dùng có thể gặp khi quay lại từ cổng thanh toán (`?reason=` trên URL) */
export const VNPAY_REASON_LABEL: Record<string, string> = {
  "24": "Bạn đã huỷ giao dịch trên trang VNPay.",
  "51": "Tài khoản không đủ số dư.",
  "65": "Tài khoản đã vượt hạn mức giao dịch trong ngày.",
  "75": "Ngân hàng thanh toán đang bảo trì.",
  "79": "Sai mật khẩu thanh toán quá số lần quy định.",
};
