import { Router } from "express";
import { z } from "zod";
import { authenticateAdmin, requireAuth } from "../middleware/auth.js";
import { adminWriteLimiter, noStore } from "../middleware/security.js";
import { requirePermission } from "../middleware/permissions.js";
import { boolQuery } from "../utils/query.js";
import { getCustomerForAdmin, listAllCustomersForAdmin, listCustomersForAdmin, listOrdersForCustomer, setCustomerLock } from "../services/admin-customer.service.js";
import { buildCustomersReportWorkbook } from "../services/admin-customer-export.service.js";

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

const lockBody = z.object({ isActive: z.boolean(), reason: z.string().trim().max(300).optional() });

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

/** PATCH /api/admin/customers/:id/lock — khoá/mở khoá tài khoản */
adminCustomersRouter.patch("/:id/lock", requirePermission("customers:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    const { isActive, reason } = lockBody.parse(req.body);
    res.json(await setCustomerLock(id, isActive, reason, req.auth!));
  } catch (error) {
    next(error);
  }
});
