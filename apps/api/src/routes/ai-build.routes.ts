import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { aiBuildLimiter } from "../middleware/security.js";
import { suggestBuild } from "../services/ai-build.service.js";

export const aiBuildRouter = Router();

/**
 * POST /api/ai/build { prompt } — AI chọn đủ bộ linh kiện từ hàng đang bán, bộ luật Build PC soát lại, lưu kèm link
 * ngắn. Không bắt buộc đăng nhập; đã đăng nhập thì cấu hình gắn vào tài khoản (trang "Cấu hình của tôi").
 */
aiBuildRouter.post("/build", authenticate, aiBuildLimiter, async (req, res, next) => {
  try {
    const { prompt } = z
      .object({
        prompt: z.string().trim().min(5, "Hãy mô tả nhu cầu và ngân sách của bạn, ví dụ \"20 triệu, chơi game\"").max(500, "Yêu cầu tối đa 500 ký tự"),
      })
      .parse(req.body);
    res.json(await suggestBuild(req.auth?.userId ?? null, prompt));
  } catch (error) {
    next(error);
  }
});
