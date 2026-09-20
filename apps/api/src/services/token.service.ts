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
