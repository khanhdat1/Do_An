import { Router } from "express";
import { z } from "zod";
import { authenticateAdmin, requireAuth } from "../middleware/auth.js";
import { adminWriteLimiter, noStore } from "../middleware/security.js";
import { requirePermission } from "../middleware/permissions.js";
import {
  createAdminAccount,
  forceDisableTwoFactor,
  getAdminAccount,
  listAdminAccounts,
  setAdminAccountLock,
  updateAdminAccount,
} from "../services/admin-account.service.js";

/** Quản lý tài khoản quản trị KHÁC (đơn hàng/sản phẩm/khách hàng có router riêng) — chỉ OWNER, quyền `admins:manage`. */
export const adminAccountsRouter = Router();

adminAccountsRouter.use(noStore, authenticateAdmin, requireAuth);

const ASSIGNABLE_ROLES = ["OWNER", "MANAGER", "ORDER_STAFF", "PRODUCT_STAFF"] as const;

/** `role`/`password` optional ở tầng zod — bắt buộc lúc TẠO được service tự kiểm (khớp cách xử lý password), để trống lúc SỬA = giữ nguyên */
const accountInputBody = z.object({
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().min(1).max(150),
  role: z.enum(ASSIGNABLE_ROLES).optional(),
  password: z.string().min(8).max(200).optional(),
});

const lockBody = z.object({ isActive: z.boolean() });
const idParam = z.object({ id: z.string().trim().min(1) });

/** GET /api/admin/accounts */
adminAccountsRouter.get("/", requirePermission("admins:manage"), async (_req, res, next) => {
  try {
    res.json({ items: await listAdminAccounts() });
  } catch (error) {
    next(error);
  }
});

/** GET /api/admin/accounts/:id */
adminAccountsRouter.get("/:id", requirePermission("admins:manage"), async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    res.json(await getAdminAccount(id));
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/accounts — password bắt buộc lúc tạo */
adminAccountsRouter.post("/", requirePermission("admins:manage"), adminWriteLimiter, async (req, res, next) => {
  try {
    const input = accountInputBody.parse(req.body);
    res.status(201).json(await createAdminAccount(input, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/admin/accounts/:id — role/password để trống = giữ nguyên */
adminAccountsRouter.patch("/:id", requirePermission("admins:manage"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    const input = accountInputBody.parse(req.body);
    res.json(await updateAdminAccount(id, input, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/admin/accounts/:id/lock — tự khoá chính mình bị chặn ở tầng service */
adminAccountsRouter.patch("/:id/lock", requirePermission("admins:manage"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    const { isActive } = lockBody.parse(req.body);
    res.json(await setAdminAccountLock(id, isActive, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/accounts/:id/disable-2fa — tắt 2FA hộ khi tài khoản đó mất thiết bị xác thực */
adminAccountsRouter.post("/:id/disable-2fa", requirePermission("admins:manage"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    res.json(await forceDisableTwoFactor(id, req.auth!));
  } catch (error) {
    next(error);
  }
});
