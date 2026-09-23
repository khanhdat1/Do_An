import { Router } from "express";
import { z } from "zod";
import { authenticateAdmin, requireAuth } from "../middleware/auth.js";
import { adminWriteLimiter, noStore } from "../middleware/security.js";
import { requirePermission } from "../middleware/permissions.js";
import { approveReview, deleteReview, listReviewsForAdmin, replyToReview } from "../services/admin-review.service.js";
import { boolQuery } from "../utils/query.js";

/** Duyệt / xoá / trả lời đánh giá sản phẩm — thuộc mảng sản phẩm (products:*) */
export const adminReviewsRouter = Router();

adminReviewsRouter.use(noStore, authenticateAdmin, requireAuth);

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  isApproved: boolQuery,
});
const idParam = z.object({ id: z.string().min(1).max(40) });
const replyBody = z.object({ reply: z.string().trim().min(1).max(1000) });

/** GET /api/admin/reviews?isApproved=false&page=&pageSize= — mặc định không lọc */
adminReviewsRouter.get("/", requirePermission("products:read"), async (req, res, next) => {
  try {
    const { page, pageSize, isApproved } = listQuery.parse(req.query);
    res.json(await listReviewsForAdmin({ isApproved }, page, pageSize));
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/reviews/:id/approve — hiện công khai + tính vào rating trung bình sản phẩm */
adminReviewsRouter.post("/:id/approve", requirePermission("products:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    await approveReview(id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/admin/reviews/:id — spam / vi phạm */
adminReviewsRouter.delete("/:id", requirePermission("products:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    await deleteReview(id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/reviews/:id/reply — phản hồi công khai của cửa hàng */
adminReviewsRouter.post("/:id/reply", requirePermission("products:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    const { reply } = replyBody.parse(req.body);
    await replyToReview(id, reply);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
