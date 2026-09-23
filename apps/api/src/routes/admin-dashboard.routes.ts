import { Router } from "express";
import { z } from "zod";
import { authenticateAdmin, requireAuth } from "../middleware/auth.js";
import { noStore } from "../middleware/security.js";
import { requirePermission } from "../middleware/permissions.js";
import { defaultRangeFor, getDashboardSummary } from "../services/admin-dashboard.service.js";
import { buildDashboardReportWorkbook } from "../services/admin-dashboard-export.service.js";

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

/** GET /api/admin/dashboard/export?granularity=&from=&to= — file .xlsx đúng số liệu của /summary cùng tham số, cùng quyền `reports:read` */
adminDashboardRouter.get("/export", requirePermission("reports:read"), async (req, res, next) => {
  try {
    const { granularity, from, to } = summaryQuery.parse(req.query);
    const range = from && to ? { from, to } : defaultRangeFor(granularity);
    const summary = await getDashboardSummary({ ...range, granularity });
    const buffer = await buildDashboardReportWorkbook(summary);

    const fileFrom = summary.range.from.slice(0, 10);
    const fileTo = summary.range.to.slice(0, 10);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="bao-cao-doanh-thu_${fileFrom}_${fileTo}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});
