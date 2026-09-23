/** Chữ hiển thị và tông màu cho trạng thái sản phẩm / giao dịch kho — dùng ở khu quản trị */
import type { InventoryTxType, ProductStatus, Tone } from "@/types";

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: "Nháp — chờ duyệt",
  ACTIVE: "Đang bán",
  HIDDEN: "Đã ẩn",
  DISCONTINUED: "Ngừng kinh doanh",
};

export const PRODUCT_STATUS_TONE: Record<ProductStatus, Tone> = {
  DRAFT: "amber",
  ACTIVE: "green",
  HIDDEN: "slate",
  DISCONTINUED: "red",
};

export const INVENTORY_TX_LABEL: Record<InventoryTxType, string> = {
  IMPORT: "Nhập kho",
  EXPORT: "Xuất kho",
  ADJUST: "Điều chỉnh kiểm kê",
  RETURN: "Khách trả hàng",
};

export const INVENTORY_TX_TONE: Record<InventoryTxType, Tone> = {
  IMPORT: "green",
  EXPORT: "red",
  ADJUST: "blue",
  RETURN: "amber",
};
