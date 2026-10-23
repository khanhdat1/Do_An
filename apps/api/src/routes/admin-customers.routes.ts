import { Router } from "express";
import { z } from "zod";
import { authenticateAdmin, requireAuth } from "../middleware/auth.js";
import { adminWriteLimiter, noStore } from "../middleware/security.js";
import { requirePermission } from "../middleware/permissions.js";
import { boolQuery } from "../utils/query.js";
import {
  deleteCustomerForAdmin,
  getCustomerForAdmin,
  listAllCustomersForAdmin,
  listCustomersForAdmin,
  listOrdersForCustomer,
  resetCustomerPassword,
  setCustomerLock,
  updateCustomerForAdmin,
} from "../services/admin-customer.service.js";
import { buildCustomersReportWorkbook } from "../services/admin-customer-export.service.js";
import { emailSchema, newPasswordSchema, optionalPhoneSchema } from "../utils/validators.js";

/** Quản lý khách hàng — chỉ đọc/ghi tài khoản role CUSTOMER, không đụng tới tài khoản quản trị khác. */
export const adminCustomersRouter = Router();

adminCustomersRouter.use(noStore, authenticateAdmin, requireAuth);

const listQuery = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  locked: boolQuery,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(20),
});

const ordersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(10),
});

/** Khoá bắt buộc có lý do (lưu lại, hiện ở trang quản trị); mở khoá thì không cần */
const lockBody = z
  .object({ isActive: z.boolean(), reason: z.string().trim().max(300, "Lý do tối đa 300 ký tự").optional() })
  .refine((body) => body.isActive || (body.reason?.length ?? 0) >= 3, {
    message: "Vui lòng nhập lý do khoá tài khoản (tối thiểu 3 ký tự)",
    path: ["reason"],
  });

const addressBody = z.object({
  province: z.string({ error: "Vui lòng nhập tỉnh/thành phố" }).trim().min(1, "Vui lòng nhập tỉnh/thành phố").max(100),
  district: z.string({ error: "Vui lòng nhập quận/huyện" }).trim().min(1, "Vui lòng nhập quận/huyện").max(100),
  ward: z.string({ error: "Vui lòng nhập phường/xã" }).trim().min(1, "Vui lòng nhập phường/xã").max(100),
  streetAddress: z.string({ error: "Vui lòng nhập số nhà, tên đường" }).trim().min(3, "Địa chỉ quá ngắn").max(300, "Địa chỉ quá dài"),
});

const updateBody = z.object({
  fullName: z.string({ error: "Vui lòng nhập họ tên" }).trim().min(2, "Họ tên tối thiểu 2 ký tự").max(150, "Họ tên quá dài"),
  email: emailSchema,
  phone: optionalPhoneSchema,
  address: addressBody.optional(),
});

/** Không gửi `password` = hệ thống tự sinh mật khẩu tạm */
const resetPasswordBody = z.object({ password: newPasswordSchema.optional() });

const idParam = z.object({ id: z.string().trim().min(1) });

/** GET /api/admin/customers?search=&locked=&page=&pageSize= */
adminCustomersRouter.get("/", requirePermission("customers:read"), async (req, res, next) => {
  try {
    const { search, locked, page, pageSize } = listQuery.parse(req.query);
    res.json(await listCustomersForAdmin({ search, locked }, page, pageSize));
  } catch (error) {
    next(error);
  }
});

/** GET /api/admin/customers/export?search=&locked= — TẤT CẢ khách hàng khớp bộ lọc (không phân trang). Đặt TRƯỚC /:id để "export" không bị khớp nhầm thành id. */
adminCustomersRouter.get("/export", requirePermission("customers:read"), async (req, res, next) => {
  try {
    const { search, locked } = listQuery.omit({ page: true, pageSize: true }).parse(req.query);
    const customers = await listAllCustomersForAdmin({ search, locked });
    const buffer = await buildCustomersReportWorkbook(customers, { search, locked });

    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="khach-hang_${today}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});

/** GET /api/admin/customers/:id */
adminCustomersRouter.get("/:id", requirePermission("customers:read"), async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    res.json(await getCustomerForAdmin(id));
  } catch (error) {
    next(error);
  }
});

/** GET /api/admin/customers/:id/orders?page=&pageSize= — lịch sử mua hàng */
adminCustomersRouter.get("/:id/orders", requirePermission("customers:read"), async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    const { page, pageSize } = ordersQuery.parse(req.query);
    res.json(await listOrdersForCustomer(id, page, pageSize));
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/admin/customers/:id — sửa họ tên, email, số điện thoại, địa chỉ mặc định */
adminCustomersRouter.patch("/:id", requirePermission("customers:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    res.json(await updateCustomerForAdmin(id, updateBody.parse(req.body), req.auth!));
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/customers/:id/reset-password  { password? } — cấp lại mật khẩu, đăng xuất khách khỏi mọi thiết bị */
adminCustomersRouter.post("/:id/reset-password", requirePermission("customers:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    const { password } = resetPasswordBody.parse(req.body ?? {});
    res.json(await resetCustomerPassword(id, password, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/admin/customers/:id — xoá tài khoản (409 nếu khách còn đơn đang xử lý); đơn đã có được giữ lại */
adminCustomersRouter.delete("/:id", requirePermission("customers:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    await deleteCustomerForAdmin(id, req.auth!);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/admin/customers/:id/lock  { isActive, reason } — khoá (bắt buộc lý do, khách bị đăng xuất ngay) / mở khoá */
adminCustomersRouter.patch("/:id/lock", requirePermission("customers:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    const { isActive, reason } = lockBody.parse(req.body);
    res.json(await setCustomerLock(id, isActive, reason, req.auth!));
  } catch (error) {
    next(error);
  }
});
