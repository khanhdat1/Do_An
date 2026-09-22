import { Router } from "express";
import { z } from "zod";
import { authenticate, requireAuth } from "../middleware/auth.js";
import { noStore, reviewWriteLimiter } from "../middleware/security.js";
import { createReview, getReviewEligibility, listApprovedReviews } from "../services/review.service.js";

/** Gắn ở `/api/products` (cùng tiền tố với products.routes.ts, giống auth+oauth cùng dùng `/api/auth`) */
export const reviewsRouter = Router();

const slugParam = z.object({ slug: z.string().trim().min(1).max(200) });
const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
const createBody = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).max(3000).optional(),
});

/** GET /api/products/:slug/reviews — công khai, chỉ đánh giá đã duyệt */
reviewsRouter.get("/:slug/reviews", async (req, res, next) => {
  try {
    const { slug } = slugParam.parse(req.params);
    const { page, pageSize } = listQuery.parse(req.query);
    res.json(await listApprovedReviews(slug, page, pageSize));
  } catch (error) {
    next(error);
  }
});

/** GET /api/products/:slug/reviews/eligibility — cần đăng nhập để biết đã mua/đã đánh giá chưa */
reviewsRouter.get("/:slug/reviews/eligibility", noStore, authenticate, requireAuth, async (req, res, next) => {
  try {
    const { slug } = slugParam.parse(req.params);
    res.json(await getReviewEligibility(req.auth!.userId, slug));
  } catch (error) {
    next(error);
  }
});

/** POST /api/products/:slug/reviews — chỉ khách đã mua và thanh toán xong mới gửi được */
reviewsRouter.post("/:slug/reviews", noStore, authenticate, requireAuth, reviewWriteLimiter, async (req, res, next) => {
  try {
    const { slug } = slugParam.parse(req.params);
    const body = createBody.parse(req.body);
    res.status(201).json(await createReview(req.auth!.userId, slug, body));
  } catch (error) {
    next(error);
  }
});
