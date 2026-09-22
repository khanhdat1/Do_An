import type { Voucher } from "@/types";

/**
 * Dữ liệu dự phòng khi API tắt — trùng với `packages/db/prisma/seed.ts` (hàm `seedVouchers`).
 * `endsAt` chỉ để hiển thị lúc API không trả lời được nên đặt cố định xa, không cần khớp tuyệt đối.
 */
export const activeVouchers: Voucher[] = [
  {
    code: "WELCOME10",
    name: "Giảm 10% cho đơn hàng",
    description: "Áp dụng cho mọi đơn hàng, giảm tối đa 300.000đ",
    discountType: "PERCENT",
    discountValue: 10,
    maxDiscount: 300_000,
    endsAt: "2027-03-01T00:00:00.000Z",
  },
  {
    code: "FREESHIP",
    name: "Miễn phí vận chuyển",
    description: "Giảm thẳng 30.000đ phí vận chuyển cho đơn từ 200.000đ",
    discountType: "FIXED",
    discountValue: 30_000,
    minOrderAmount: 200_000,
    endsAt: "2027-03-01T00:00:00.000Z",
  },
  {
    code: "SALE500K",
    name: "Giảm 500.000đ cho đơn laptop/PC",
    description: "Áp dụng cho đơn hàng từ 15.000.000đ — hợp cho laptop, PC nguyên bộ",
    discountType: "FIXED",
    discountValue: 500_000,
    minOrderAmount: 15_000_000,
    endsAt: "2027-03-01T00:00:00.000Z",
  },
];
