import type ExcelJS from "exceljs";

/** Nhãn tiếng Việt dùng chung cho mọi báo cáo Excel xuất từ khu quản trị (doanh thu, đơn hàng...) */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  PACKING: "Đang đóng gói",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã huỷ",
  RETURNED: "Đã hoàn trả",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  FAILED: "Thất bại",
  REFUNDED: "Đã hoàn tiền",
  CANCELLED: "Đã huỷ",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  COD: "Tiền mặt khi nhận hàng",
  VNPAY: "VNPay",
  BANK_TRANSFER: "Chuyển khoản",
  MOMO: "MoMo",
};

/** Khớp đúng chữ với `apps/web/lib/data/product-status.ts` để báo cáo và giao diện quản trị nói cùng một từ */
export const PRODUCT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp — chờ duyệt",
  ACTIVE: "Đang bán",
  HIDDEN: "Đã ẩn",
  DISCONTINUED: "Ngừng kinh doanh",
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
export const VND_FORMAT = "#,##0";

export function styleHeaderRow(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.border = { bottom: { style: "thin", color: { argb: "FFCBD5E1" } } };
  });
}
