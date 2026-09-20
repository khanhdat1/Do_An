import type { Request, RequestHandler } from "express";
import { verifyAccessToken, type AccessTokenClaims } from "../services/token.service.js";
import { ACCESS_COOKIE, readCookie } from "../utils/cookies.js";
import { UnauthorizedError } from "./errors.js";

/** Trình duyệt gửi qua cookie; công cụ như curl / Postman có thể gửi header Bearer */
function readAccessToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim() || undefined;
  }
  return readCookie(req, ACCESS_COOKIE);
}

/**
 * Nhận diện người dùng, KHÔNG bắt buộc đăng nhập.
 *
 * - Không có token          -> khách vãng lai, cho đi tiếp (req.auth để trống)
 * - Có token hợp lệ         -> gắn req.auth
 * - Có token sai / hết hạn  -> 401, để frontend gọi /api/auth/refresh rồi thử lại.
 *   Không được lặng lẽ coi là khách: người dùng sẽ thấy giỏ hàng của mình
 *   biến mất chỉ vì access token hết hạn.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const token = readAccessToken(req);
  if (!token) return next();

  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch {
    next(new UnauthorizedError("Phiên đăng nhập đã hết hạn"));
  }
};

/**
 * Đọc phiên hiện tại mà KHÔNG bao giờ ném lỗi: thiếu, sai hay hết hạn đều trả `null`.
 * Dành cho endpoint là điều hướng của trình duyệt (OAuth), nơi lỗi phải là một lần
 * chuyển hướng về trang web chứ không thể là JSON 401 hiện thẳng lên màn hình.
 */
export function readSession(req: Request): AccessTokenClaims | null {
  const token = readAccessToken(req);
  if (!token) return null;

  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}
