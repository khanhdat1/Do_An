import { Router } from "express";
import { getPublicSettings } from "../services/settings.service.js";

export const settingsRouter = Router();

/**
 * GET /api/settings — cài đặt CÔNG KHAI cho trang bán hàng (hotline/email/địa chỉ, phí vận chuyển, phương thức
 * thanh toán và tính năng AI nào đang dùng được). Không có khoá/số tài khoản nào ở đây.
 *
 * Cố ý KHÔNG gắn limiter theo IP: server Next.js gọi hộ endpoint này mỗi lần dựng trang (TopBar/Footer/layout),
 * IP nhìn thấy là IP của web server — giới hạn theo IP sẽ chặn nhầm cả site (xem ghi chú ở `aiSearchLimiter`).
 * Chỉ đọc bộ nhớ đệm trong tiến trình, không tốn gì đáng kể — giống `GET /api/banners`, `GET /api/products`.
 */
settingsRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await getPublicSettings());
  } catch (error) {
    next(error);
  }
});
