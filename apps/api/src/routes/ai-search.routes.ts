import { Router } from "express";
import { z } from "zod";
import { aiSearchLimiter } from "../middleware/security.js";
import { aiSearchProducts } from "../services/ai-search.service.js";

export const aiSearchRouter = Router();

/**
 * GET /api/ai/search?q=...
 * Tìm kiếm ngữ nghĩa bằng embedding — hiểu câu hỏi tự nhiên không trùng từ khoá chính xác
 * ("laptop mỏng nhẹ cho sinh viên IT khoảng 20 triệu"). `usedAi: false` khi chưa cấu hình OpenAI
 * hoặc không có kết quả đủ liên quan (không phải lỗi) — trang gọi tự lùi về `GET /api/search`.
 */
aiSearchRouter.get("/search", aiSearchLimiter, async (req, res, next) => {
  try {
    const { q } = z.object({ q: z.string().trim().min(1).max(300) }).parse(req.query);
    res.json(await aiSearchProducts(q));
  } catch (error) {
    next(error);
  }
});
