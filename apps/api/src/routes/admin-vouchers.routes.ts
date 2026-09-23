import { Router } from "express";
import { z } from "zod";
import { authenticateAdmin, requireAuth } from "../middleware/auth.js";
import { adminWriteLimiter, noStore } from "../middleware/security.js";
import { requirePermission } from "../middleware/permissions.js";
import { boolQuery } from "../utils/query.js";
import { createVoucher, deleteVoucher, getVoucherForAdmin, listVouchersForAdmin, updateVoucher } from "../services/admin-voucher.service.js";

/** Quản trị mã giảm giá — backend áp dụng mã (`services/voucher.service.ts`) đã có từ trước, đây chỉ là lớp CRUD cho admin. */
export const adminVouchersRouter = Router();

adminVouchersRouter.use(noStore, authenticateAdmin, requireAuth);

const listQuery = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  active: boolQuery,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(20),
});

const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Ngày không hợp lệ");

const voucherInputBody = z.object({
  code: z.string().trim().min(3).max(50),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  discountType: z.enum(["PERCENT", "FIXED"]),
  discountValue: z.coerce.number().positive(),
  minOrderAmount: z.coerce.number().nonnegative().optional(),
  maxDiscount: z.coerce.number().nonnegative().optional(),
  usageLimit: z.coerce.number().int().positive().optional(),
  perUserLimit: z.coerce.number().int().positive().default(1),
  startsAt: isoDate,
  endsAt: isoDate,
  isActive: z.boolean().default(true),
});

const idParam = z.object({ id: z.string().trim().min(1) });

/** GET /api/admin/vouchers?search=&active=&page=&pageSize= */
adminVouchersRouter.get("/", requirePermission("vouchers:read"), async (req, res, next) => {
  try {
    const { search, active, page, pageSize } = listQuery.parse(req.query);
    res.json(await listVouchersForAdmin({ search, active }, page, pageSize));
  } catch (error) {
    next(error);
  }
});

/** GET /api/admin/vouchers/:id */
adminVouchersRouter.get("/:id", requirePermission("vouchers:read"), async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    res.json(await getVoucherForAdmin(id));
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/vouchers */
adminVouchersRouter.post("/", requirePermission("vouchers:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const input = voucherInputBody.parse(req.body);
    res.status(201).json(await createVoucher(input, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/admin/vouchers/:id */
adminVouchersRouter.patch("/:id", requirePermission("vouchers:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    const input = voucherInputBody.parse(req.body);
    res.json(await updateVoucher(id, input, req.auth!));
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/admin/vouchers/:id — chỉ xoá được mã chưa từng dùng (usageCount=0) */
adminVouchersRouter.delete("/:id", requirePermission("vouchers:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    await deleteVoucher(id, req.auth!);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
