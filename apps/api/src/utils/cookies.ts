import type { CookieOptions, Request, Response } from "express";
import { env } from "../env.js";
import { REFRESH_TOKEN_TTL_MS } from "../services/token.service.js";

export const ACCESS_COOKIE = "pcz_access";
export const REFRESH_COOKIE = "pcz_refresh";
export const GUEST_CART_COOKIE = "pcz_cart";
export const GUEST_CHAT_COOKIE = "pcz_chat";

/** `req.cookies` do cookie-parser điền, kiểu `any` — ép về chuỗi có kiểm tra */
export function readCookie(req: Request, name: string): string | undefined {
  const value = req.cookies?.[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Mọi cookie đều httpOnly: JavaScript trên trang (kể cả khi bị XSS) không đọc
 * được token. SameSite=Lax chặn trình duyệt gửi cookie kèm request POST từ
 * trang web khác (CSRF). `secure` chỉ bật ở production vì dev chạy http.
 */
const baseOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: !env.isDev,
};

const ACCESS_PATH = "/";
/** Refresh token chỉ được gửi tới nhóm endpoint /api/auth, không đi theo mọi request */
const REFRESH_PATH = "/api/auth";

/**
 * Cookie access token cố ý sống bằng refresh token (30 ngày) dù JWT bên trong
 * chỉ có hạn 15 phút. Nếu cookie biến mất đúng lúc JWT hết hạn, server sẽ thấy
 * "không có token" và coi là khách vãng lai — người đã đăng nhập bỗng thấy giỏ
 * hàng trống. Để cookie sống lâu hơn thì server thấy "token hết hạn" (401) và
 * frontend biết phải gọi /api/auth/refresh.
 *
 * `remember = false` (không tick "Ghi nhớ đăng nhập"): cả hai là cookie phiên,
 * không có hạn — trình duyệt đóng là mất, người dùng phải đăng nhập lại.
 */
export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  options: { remember?: boolean } = {},
) {
  const lifetime = (options.remember ?? true) ? { maxAge: REFRESH_TOKEN_TTL_MS } : {};

  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...baseOptions, path: ACCESS_PATH, ...lifetime });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...baseOptions, path: REFRESH_PATH, ...lifetime });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions, path: ACCESS_PATH });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions, path: REFRESH_PATH });
}

/* -------------------------------------------------------------------------- */
/*  Phiên đăng nhập quản trị — cookie KHÁC TÊN + KHÁC PATH hoàn toàn với phía  */
/*  khách hàng ở trên, để đăng xuất/đăng nhập bên này không đụng bên kia.     */
/* -------------------------------------------------------------------------- */

export const ADMIN_ACCESS_COOKIE = "pcz_admin_access";
export const ADMIN_REFRESH_COOKIE = "pcz_admin_refresh";
/** Cả hai đều chỉ đi kèm request tới /api/admin — không lẫn vào các API công khai/khách hàng */
const ADMIN_PATH = "/api/admin";

export function setAdminAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  options: { remember?: boolean } = {},
) {
  const lifetime = (options.remember ?? true) ? { maxAge: REFRESH_TOKEN_TTL_MS } : {};

  res.cookie(ADMIN_ACCESS_COOKIE, tokens.accessToken, { ...baseOptions, path: ADMIN_PATH, ...lifetime });
  res.cookie(ADMIN_REFRESH_COOKIE, tokens.refreshToken, { ...baseOptions, path: ADMIN_PATH, ...lifetime });
}

export function clearAdminAuthCookies(res: Response) {
  res.clearCookie(ADMIN_ACCESS_COOKIE, { ...baseOptions, path: ADMIN_PATH });
  res.clearCookie(ADMIN_REFRESH_COOKIE, { ...baseOptions, path: ADMIN_PATH });
}

/** Cookie định danh giỏ hàng của khách chưa đăng nhập (giá trị = Cart.sessionId) */
export function setGuestCartCookie(res: Response, sessionId: string) {
  res.cookie(GUEST_CART_COOKIE, sessionId, {
    ...baseOptions,
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearGuestCartCookie(res: Response) {
  res.clearCookie(GUEST_CART_COOKIE, { ...baseOptions, path: "/" });
}

/**
 * Cookie định danh HỘI THOẠI AI của khách chưa đăng nhập (giá trị = AiConversation.sessionId) —
 * cố ý TÁCH RIÊNG khỏi GUEST_CART_COOKIE dù cùng khuôn: giá trị cookie giỏ hàng gắn chặt với
 * Cart.sessionId, dùng chung sẽ lẫn lộn hai định danh không liên quan tới nhau.
 */
export function setGuestChatCookie(res: Response, sessionId: string) {
  res.cookie(GUEST_CHAT_COOKIE, sessionId, {
    ...baseOptions,
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearGuestChatCookie(res: Response) {
  res.clearCookie(GUEST_CHAT_COOKIE, { ...baseOptions, path: "/" });
}

/* -------------------------------------------------------------------------- */
/*  Đăng nhập bằng mạng xã hội                                                */
/* -------------------------------------------------------------------------- */

export const OAUTH_COOKIE = "pcz_oauth";
const OAUTH_FLOW_TTL_MS = 10 * 60 * 1000;

/** Những gì cần nhớ giữa lúc chuyển người dùng sang Google / Facebook và lúc họ quay về */
export interface OAuthFlow {
  provider: string;
  /** Mã ngẫu nhiên dùng một lần; nhà cung cấp gửi lại nguyên vẹn để ta biết yêu cầu quay về là do chính ta khởi tạo */
  state: string;
  /** Trang nội bộ đưa người dùng tới sau khi đăng nhập xong */
  next: string;
  /**
   * Chỉ có khi người ĐÃ đăng nhập bấm "Liên kết" ở trang Tài khoản: tài khoản mạng xã hội
   * sẽ được gắn vào User này thay vì dùng để đăng nhập. Server ghi vào sau khi kiểm tra
   * phiên hiện tại, và cookie httpOnly nên trang web không sửa được.
   */
  linkUserId?: string;
}

/**
 * Cookie này giữ `state` của một lượt đăng nhập. SameSite=Lax vẫn được gửi khi
 * Google / Facebook chuyển hướng trình duyệt về (điều hướng cấp cao nhất bằng GET),
 * và chỉ đi kèm request tới /api/auth.
 */
export function setOAuthCookie(res: Response, flow: OAuthFlow) {
  res.cookie(OAUTH_COOKIE, JSON.stringify(flow), {
    ...baseOptions,
    path: REFRESH_PATH,
    maxAge: OAUTH_FLOW_TTL_MS,
  });
}

export function readOAuthCookie(req: Request): OAuthFlow | null {
  const raw = readCookie(req, OAUTH_COOKIE);
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      "provider" in value &&
      "state" in value &&
      "next" in value &&
      typeof value.provider === "string" &&
      typeof value.state === "string" &&
      typeof value.next === "string"
    ) {
      return {
        provider: value.provider,
        state: value.state,
        next: value.next,
        ...("linkUserId" in value && typeof value.linkUserId === "string"
          ? { linkUserId: value.linkUserId }
          : {}),
      };
    }
  } catch {
    // Cookie bị sửa / hỏng: coi như không có
  }
  return null;
}

export function clearOAuthCookie(res: Response) {
  res.clearCookie(OAUTH_COOKIE, { ...baseOptions, path: REFRESH_PATH });
}
