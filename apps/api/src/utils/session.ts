import type { Request, Response } from "express";
import type { AuthResult, SessionContext } from "../services/auth.service.js";
import { mergeGuestCartIntoUser } from "../services/cart.service.js";
import {
  clearGuestCartCookie,
  GUEST_CART_COOKIE,
  readCookie,
  setAuthCookies,
} from "./cookies.js";

export function sessionContext(req: Request): SessionContext {
  return {
    userAgent: req.get("user-agent")?.slice(0, 300),
    ipAddress: req.ip?.slice(0, 45),
  };
}

/**
 * Gộp giỏ hàng khách vãng lai vào tài khoản. Lỗi ở bước này không được làm
 * hỏng việc đăng nhập: chỉ ghi log, giỏ khách vẫn còn nguyên (cookie giữ lại)
 * để lần đăng nhập sau gộp tiếp.
 */
async function mergeGuestCart(req: Request, res: Response, userId: string) {
  const sessionId = readCookie(req, GUEST_CART_COOKIE);
  if (!sessionId) return;

  try {
    await mergeGuestCartIntoUser(userId, sessionId);
    clearGuestCartCookie(res);
  } catch (error) {
    console.error("Không gộp được giỏ hàng khách vào tài khoản:", error);
  }
}

/**
 * Bước cuối của mọi cách đăng nhập (mật khẩu, đăng ký, Google, Facebook):
 * gộp giỏ hàng khách rồi đặt cookie phiên.
 */
export async function finishLogin(req: Request, res: Response, session: AuthResult) {
  await mergeGuestCart(req, res, session.user.id);
  setAuthCookies(res, session, { remember: session.remember });
}
