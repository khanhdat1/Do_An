import type { UserRole } from "@/types";

/** Nhãn tiếng Việt cho mọi vai trò — gồm cả ADMIN/STAFF (giá trị cũ, chỉ còn 1 tài khoản seed dùng, không gán lại được) */
export const ROLE_LABEL: Record<UserRole, string> = {
  CUSTOMER: "Khách hàng",
  ADMIN: "Quản trị viên",
  STAFF: "Nhân viên",
  OWNER: "Chủ website",
  MANAGER: "Quản lý",
  ORDER_STAFF: "Nhân viên đơn hàng",
  PRODUCT_STAFF: "Nhân viên sản phẩm",
};
