import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { UserRole } from "@pczone/db";
import { env } from "../env.js";

/** Access token sống ngắn: lộ ra thì kẻ xấu chỉ dùng được vài phút */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Refresh token sống dài, nhưng lưu DB nên thu hồi được (đăng xuất, khoá tài khoản) */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Không tick "Ghi nhớ đăng nhập": phiên chỉ sống tối đa 1 ngày kể từ lần dùng gần nhất */
export const SESSION_REFRESH_TTL_MS = 24 * 60 * 60 * 1000;

export function refreshTtlMs(remember: boolean): number {
  return remember ? REFRESH_TOKEN_TTL_MS : SESSION_REFRESH_TTL_MS;
}

/**
 * Phiên này có được "ghi nhớ" không? Không có cột riêng cho việc đó nên suy ra từ
 * độ dài hạn lúc cấp: 30 ngày là có nhớ, 1 ngày là không. Khi refresh, token mới
 * giữ đúng chế độ của token cũ.
 */
export function wasRemembered(record: { createdAt: Date; expiresAt: Date }): boolean {
  return record.expiresAt.getTime() - record.createdAt.getTime() > SESSION_REFRESH_TTL_MS;
}

const ISSUER = "pczone-api";
/** Issuer riêng cho phiên quản trị — cùng khoá bí mật, nhưng jwt.verify ghim issuer nên một token
 * ký cho phía khách hàng không bao giờ xác minh được ở phía admin và ngược lại. */
const ADMIN_ISSUER = "pczone-admin-api";
/** Token tạm giữa bước 1 (đúng mật khẩu) và bước 2 (đúng mã 2FA) của đăng nhập admin — không phải
 * access token thật, không set cookie, chỉ đi trong body response rồi POST lại ngay sau đó. */
const TWO_FA_PENDING_TTL_SECONDS = 60;

export interface AccessTokenClaims {
  userId: string;
  role: UserRole;
}

export function signAccessToken(user: { id: string; role: UserRole }): string {
  return jwt.sign({ role: user.role }, env.jwtSecret, {
    algorithm: "HS256",
    issuer: ISSUER,
    subject: user.id,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

/**
 * Xác thực access token. Ném lỗi nếu sai chữ ký, hết hạn hoặc thiếu claim.
 * Ghim `algorithms` để chặn kiểu tấn công đổi header sang `alg: none`.
 */
export function verifyAccessToken(token: string): AccessTokenClaims {
  const payload = jwt.verify(token, env.jwtSecret, {
    algorithms: ["HS256"],
    issuer: ISSUER,
  });

  if (typeof payload === "string" || !payload.sub || typeof payload.role !== "string") {
    throw new Error("Access token thiếu claim bắt buộc");
  }

  return { userId: payload.sub, role: payload.role as UserRole };
}

/** Giống signAccessToken nhưng issuer riêng (pcz_admin_access cookie) — xem ADMIN_ISSUER ở trên */
export function signAdminAccessToken(user: { id: string; role: UserRole }): string {
  return jwt.sign({ role: user.role }, env.jwtSecret, {
    algorithm: "HS256",
    issuer: ADMIN_ISSUER,
    subject: user.id,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAdminAccessToken(token: string): AccessTokenClaims {
  const payload = jwt.verify(token, env.jwtSecret, {
    algorithms: ["HS256"],
    issuer: ADMIN_ISSUER,
  });

  if (typeof payload === "string" || !payload.sub || typeof payload.role !== "string") {
    throw new Error("Access token thiếu claim bắt buộc");
  }

  return { userId: payload.sub, role: payload.role as UserRole };
}

/** Bước 1 đăng nhập admin (đúng mật khẩu, tài khoản có bật 2FA) ký token tạm này thay vì cấp cookie ngay */
export function sign2faPendingToken(userId: string): string {
  return jwt.sign({ purpose: "2fa-pending" }, env.jwtSecret, {
    algorithm: "HS256",
    issuer: ADMIN_ISSUER,
    subject: userId,
    expiresIn: TWO_FA_PENDING_TTL_SECONDS,
  });
}

/** Ném lỗi nếu sai/hết hạn/không phải loại token này (vd lỡ gửi nhầm access token thật vào đây) */
export function verify2faPendingToken(token: string): { userId: string } {
  const payload = jwt.verify(token, env.jwtSecret, {
    algorithms: ["HS256"],
    issuer: ADMIN_ISSUER,
  });

  if (typeof payload === "string" || !payload.sub || payload.purpose !== "2fa-pending") {
    throw new Error("Token xác thực 2 bước không hợp lệ");
  }

  return { userId: payload.sub };
}

/**
 * Refresh token là chuỗi ngẫu nhiên 384 bit, không phải JWT: nó chỉ có nghĩa
 * khi đối chiếu được với một dòng trong DB.
 */
export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = randomBytes(48).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

/**
 * DB chỉ giữ hash của refresh token. Lộ DB thì kẻ tấn công không có token gốc
 * để dùng. Token đã ngẫu nhiên đủ dài nên SHA-256 là đủ (không cần bcrypt).
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Token trong link "quên mật khẩu" — cùng khuôn với refresh token (chuỗi ngẫu nhiên, chỉ lưu hash) */
export function generatePasswordResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}
