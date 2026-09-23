import { Router } from "express";
import { z } from "zod";
import { authenticateAdmin, requireAuth } from "../middleware/auth.js";
import { noStore } from "../middleware/security.js";
import { requirePermission } from "../middleware/permissions.js";
import { defaultRangeFor, getDashboardSummary } from "../services/admin-dashboard.service.js";

/** Trang tổng quan doanh thu — chỉ OWNER/MANAGER xem được (quyền `reports:read`, không cấp cho ORDER_STAFF/PRODUCT_STAFF). */
export const adminDashboardRouter = Router();

adminDashboardRouter.use(noStore, authenticateAdmin, requireAuth);

const summaryQuery = z.object({
  granularity: z.enum(["day", "week", "month", "year"]).default("day"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/** GET /api/admin/dashboard/summary?granularity=&from=&to= — thiếu from/to thì dùng khoảng mặc định theo granularity */
adminDashboardRouter.get("/summary", requirePermission("reports:read"), async (req, res, next) => {
  try {
    const { granularity, from, to } = summaryQuery.parse(req.query);
    const range = from && to ? { from, to } : defaultRangeFor(granularity);
    res.json(await getDashboardSummary({ ...range, granularity }));
  } catch (error) {
    next(error);
  }
});
