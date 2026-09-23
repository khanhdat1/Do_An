import type { UserRole } from "@pczone/db";
import type { RequestHandler } from "express";
import { ForbiddenError, UnauthorizedError } from "./errors.js";

/**
 * Quyền theo TỪNG THAO TÁC (không chỉ theo trang) — kiểm ở phía máy chủ cho mọi route quản trị ghi
 * dữ liệu, đúng yêu cầu "kiểm tra quyền ở phía máy chủ cho từng thao tác".
 */
export type Permission =
  | "orders:read"
  | "orders:write"
  | "products:read"
  | "products:write"
  | "customers:read"
  | "customers:write"
  | "vouchers:read"
  | "vouchers:write"
  | "reports:read"
  | "settings:write"
  | "admins:manage"; // tạo/sửa/khoá tài khoản quản trị khác

const ALL_PERMISSIONS: Permission[] = [
  "orders:read",
  "orders:write",
  "products:read",
  "products:write",
  "customers:read",
  "customers:write",
  "vouchers:read",
  "vouchers:write",
  "reports:read",
  "settings:write",
  "admins:manage",
];

/**
 * Bảng quyền theo vai trò. OWNER/MANAGER thấy toàn bộ nghiệp vụ; khác nhau ở 2 quyền quản trị hệ
 * thống (admins:manage, settings:write) — chỉ OWNER được đụng vào chính bộ máy quản trị/cấu hình
 * cửa hàng. ORDER_STAFF/PRODUCT_STAFF bị giới hạn đúng mảng việc của mình, không thấy báo cáo/doanh
 * thu (reports:read) hay thông tin khách hàng ngoài phạm vi cần thiết.
 *
 * `ADMIN`/`STAFF` (giá trị cũ, không còn cấp cho tài khoản mới — xem UserRole trong schema) tạm giữ
 * quyền như OWNER để không khoá nhầm tài khoản cũ còn sót giá trị này trước khi được chuyển đổi.
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  CUSTOMER: [],
  OWNER: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS,
  STAFF: ALL_PERMISSIONS,
  MANAGER: ALL_PERMISSIONS.filter((perm) => perm !== "admins:manage" && perm !== "settings:write"),
  ORDER_STAFF: ["orders:read", "orders:write"],
  PRODUCT_STAFF: ["products:read", "products:write"],
};

export function permissionsOf(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

/** Đặt sau `requireAuth` (hoặc tương đương phía admin) trong chuỗi middleware */
export function requirePermission(...perms: Permission[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new UnauthorizedError("Bạn cần đăng nhập để thực hiện thao tác này"));
    const granted = permissionsOf(req.auth.role);
    const missing = perms.filter((perm) => !granted.includes(perm));
    if (missing.length > 0) return next(new ForbiddenError("Bạn không có quyền thực hiện thao tác này"));
    next();
  };
}
