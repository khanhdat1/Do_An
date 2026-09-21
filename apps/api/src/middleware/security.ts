import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { env } from "../env.js";
import { webUrl } from "../utils/redirect.js";
import { ForbiddenError } from "./errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Chống CSRF: với request thay đổi dữ liệu, nếu trình duyệt gửi header Origin
 * thì Origin đó phải nằm trong danh sách CORS_ORIGIN. Cookie SameSite=Lax đã
 * chặn phần lớn trường hợp, đây là lớp kiểm tra thứ hai. Request không có
 * Origin (curl, Postman, gọi server-to-server) vẫn đi qua vì không phải trình
 * duyệt nên không bị lợi dụng cookie.
 */
export const originGuard: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get("origin");
  if (origin && !env.corsOrigins.includes(origin)) {
    return next(new ForbiddenError("Nguồn gốc của yêu cầu không được phép"));
  }
  next();
};

/** Dữ liệu cá nhân (danh tính, giỏ hàng) không được lưu vào cache của trình duyệt / proxy */
export const noStore: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};

/** Ở dev nới lỏng gấp 10 lần để việc thử đi thử lại không tự khoá mình */
const devFactor = env.isDev ? 10 : 1;

function limiter(options: {
  windowMs: number;
  limit: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit * devFactor,
    skipSuccessfulRequests: options.skipSuccessfulRequests,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: "TOO_MANY_REQUESTS", message: options.message });
    },
  });
}

/** Chống dò mật khẩu: chỉ đếm các lần đăng nhập THẤT BẠI của mỗi IP */
export const loginLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.",
});

export const registerLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: "Bạn đã tạo tài khoản quá nhiều lần. Vui lòng thử lại sau.",
});

/**
 * Bắt đầu / hoàn tất đăng nhập Google, Facebook. Mỗi lượt gọi về (callback) kéo
 * theo request ra ngoài và ghi DB nên cần trần. Đây là điều hướng của trình duyệt,
 * bị chặn thì đưa về trang đăng nhập chứ không hiện JSON thô.
 */
export const oauthLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60 * devFactor,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.redirect(webUrl("/dang-nhap", { error: "oauth_failed" }));
  },
});

/** Thêm / sửa / xoá giỏ hàng. Khách vãng lai không cần đăng nhập nên phải có trần. */
export const cartWriteLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 200,
  message: "Bạn thao tác với giỏ hàng quá nhanh. Vui lòng thử lại sau ít phút.",
});

/** Ô tìm kiếm gọi gợi ý sau mỗi lần dừng gõ: cho phép nhiều, nhưng vẫn có trần theo IP */
export const searchLimiter = limiter({
  windowMs: 60 * 1000,
  limit: 120,
  message: "Bạn tìm kiếm quá nhanh. Vui lòng thử lại sau ít giây.",
});
