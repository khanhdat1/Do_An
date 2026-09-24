import type { RequestHandler } from "express";
import { ipKeyGenerator, rateLimit, type ValueDeterminingMiddleware } from "express-rate-limit";
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
  /** Mặc định giới hạn theo IP khách. Đặt hàm này để giới hạn theo một khoá khác — vd một khoá cố
   * định để giới hạn CHUNG toàn site, dùng cho endpoint do server của WEB gọi hộ (IP luôn là IP của
   * web server chứ không phải khách thật, giới hạn theo IP lúc đó vô nghĩa — xem aiSearchLimiter). */
  keyGenerator?: ValueDeterminingMiddleware<string>;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit * devFactor,
    skipSuccessfulRequests: options.skipSuccessfulRequests,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...(options.keyGenerator ? { keyGenerator: options.keyGenerator } : {}),
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

/** Đăng nhập quản trị: tài khoản có quyền lực hơn khách hàng nên trần thấp hơn hẳn loginLimiter */
export const adminLoginLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  message: "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.",
});

export const registerLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: "Bạn đã tạo tài khoản quá nhiều lần. Vui lòng thử lại sau.",
});

/**
 * Yêu cầu link đặt lại mật khẩu / dùng link để đặt mật khẩu mới — trần chặt vì đây là công cụ có
 * thể bị lợi dụng dò email đã đăng ký (dù response luôn giống nhau) hoặc dò thử token.
 */
export const passwordResetLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau 15 phút.",
});

/** Sửa hồ sơ (tên/SĐT) hoặc huỷ liên kết mạng xã hội — đã đăng nhập, trần chỉ để phòng thao tác nhầm hàng loạt */
export const accountWriteLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.",
});

/** Dùng link xác minh email (công khai, không cần đăng nhập) — trần chặt để không bị dò token */
export const emailVerificationLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau 15 phút.",
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

/**
 * Tìm kiếm ngữ nghĩa bằng AI — mỗi lượt tốn tiền thật gọi OpenAI. Trang `/tim-kiem` (server của web)
 * gọi hộ, giống hệt `GET /api/search` chính (xem lý do ở search.routes.ts): IP luôn là IP của web
 * server, không phải khách thật, nên giới hạn theo IP sẽ chặn nhầm cả site chứ không có tác dụng
 * chống lạm dụng thật sự. Giới hạn CHUNG cho toàn site thay vì theo IP.
 */
export const aiSearchLimiter = limiter({
  windowMs: 60 * 1000,
  limit: 30,
  message: "Hệ thống tìm kiếm AI đang bận. Vui lòng thử lại sau ít giây.",
  keyGenerator: () => "global",
});

/**
 * Trợ lý AI Chat — khác `aiSearchLimiter`: route này trình duyệt gọi TRỰC TIẾP (fetch từ
 * `/tro-ly-ai`), không qua server Next.js hộ, nên IP nhìn thấy đúng là IP của từng khách thật —
 * giới hạn theo IP (mặc định của `limiter()`) mới có tác dụng, không dùng khoá "global". Ưu tiên
 * `userId` khi đã đăng nhập (ổn định hơn IP, vd nhiều khách sau cùng NAT/mạng công ty).
 */
export const aiChatLimiter = limiter({
  windowMs: 60 * 1000,
  limit: 15,
  message: "Bạn nhắn tin cho trợ lý AI quá nhanh. Vui lòng thử lại sau ít giây.",
  // req.ip thô có thể là IPv6 — express-rate-limit tự chặn (ERR_ERL_KEY_GEN_IPV6) vì một khách có thể
  // đổi địa chỉ IPv6 gần như vô hạn trong cùng dải /64 để lách trần; ipKeyGenerator() gộp theo subnet cho đúng.
  keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? "unknown"),
});

/** Thêm / xoá sản phẩm yêu thích */
export const wishlistWriteLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 200,
  message: "Bạn thao tác với danh sách yêu thích quá nhanh. Vui lòng thử lại sau ít phút.",
});

/** Thêm / sửa / xoá địa chỉ giao hàng */
export const addressWriteLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  message: "Bạn thao tác với sổ địa chỉ quá nhanh. Vui lòng thử lại sau ít phút.",
});

/**
 * Tạo đơn / huỷ đơn / thử thanh toán lại — mỗi lượt đều ghi DB (và tạo đơn còn trừ kho), nên trần
 * thấp hơn hẳn giỏ hàng để không thành công cụ đặt đơn rác hoặc dò trừ kho hàng loạt.
 */
export const orderWriteLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  message: "Bạn thao tác với đơn hàng quá nhanh. Vui lòng thử lại sau ít phút.",
});

/**
 * Tra cứu đơn hàng công khai (mã đơn + số điện thoại), không cần đăng nhập: trần chặt hơn hẳn để
 * không bị dùng dò mã đơn hoặc số điện thoại của người khác.
 */
export const orderLookupLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: "Bạn tra cứu quá nhiều lần. Vui lòng thử lại sau 15 phút.",
});

/**
 * Xem trước mã giảm giá: chỉ đọc nhưng là "máy dò" biết mã còn dùng được không, nên vẫn cần trần
 * để không bị quét thử hàng loạt mã.
 */
export const voucherPreviewLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  message: "Bạn thử mã giảm giá quá nhiều lần. Vui lòng thử lại sau ít phút.",
});

/** Xác nhận thanh toán thủ công ở trang quản trị — đã chặn bằng role, trần chỉ để phòng thao tác nhầm hàng loạt */
export const adminWriteLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 100,
  message: "Thao tác quá nhanh. Vui lòng thử lại sau ít phút.",
});

/** Gửi đánh giá sản phẩm — trần thấp vì mỗi lượt ghi DB, khách thật cũng không cần gửi nhiều trong 10 phút */
export const reviewWriteLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  message: "Bạn gửi đánh giá quá nhanh. Vui lòng thử lại sau ít phút.",
});
