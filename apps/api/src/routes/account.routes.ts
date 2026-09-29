import { Router } from "express";
import { authenticate, requireAuth } from "../middleware/auth.js";
import { noStore } from "../middleware/security.js";
import { getAccountSummary } from "../services/account.service.js";

/** Số liệu cho trang Tài khoản — chỉ của CHÍNH tài khoản đang đăng nhập */
export const accountRouter = Router();

accountRouter.use(noStore, authenticate, requireAuth);

/** GET /api/account/summary — số đơn theo nhóm trạng thái, tổng chi tiêu, số yêu thích, số cấu hình đã lưu, 3 đơn mới nhất */
accountRouter.get("/summary", async (req, res, next) => {
  try {
    res.json(await getAccountSummary(req.auth!.userId));
  } catch (error) {
    next(error);
  }
});
