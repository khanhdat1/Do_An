import bcrypt from "bcryptjs";
import { generateSecret, generateURI, verify as verifyTotp } from "otplib";
import QRCode from "qrcode";
import { prisma, type User } from "@pczone/db";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../middleware/errors.js";
import { logAdminAction } from "./audit-log.service.js";
import {
  BCRYPT_COST,
  createRefreshTokenRow,
  DUMMY_HASH,
  logoutSession,
  rotateRefreshToken,
  type SessionContext,
} from "./auth.service.js";
import { sign2faPendingToken, signAdminAccessToken, verify2faPendingToken } from "./token.service.js";

const TOTP_ISSUER = "PCZone Admin";

export interface AdminAuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  remember: boolean;
}

/** Đăng nhập thất bại ở bước mật khẩu, hoặc mật khẩu đúng nhưng cần thêm bước nhập mã 2FA */
export type AdminLoginResult =
  | { status: "ok"; session: AdminAuthResult }
  | { status: "2fa-required"; pendingToken: string };

/**
 * Bước 1 đăng nhập admin: kiểm mật khẩu VÀ role (khách hàng dù đúng mật khẩu cũng không vào được —
 * cùng một thông báo lỗi chung với "sai mật khẩu" để không lộ việc email đó có tồn tại dưới dạng
 * tài khoản khách hàng). Có bật 2FA thì trả token tạm thay vì cấp phiên thật ngay.
 */
export async function loginAdmin(
  input: { email: string; password: string; remember?: boolean },
  context: SessionContext,
): Promise<AdminLoginResult> {
  const found = await prisma.user.findUnique({ where: { email: input.email } });

  const passwordOk = await bcrypt.compare(input.password, found?.passwordHash ?? DUMMY_HASH);
  const isAdminRole = found ? found.role !== "CUSTOMER" : false;
  if (!found || !passwordOk || !isAdminRole) {
    throw new UnauthorizedError("Email hoặc mật khẩu không đúng");
  }

  if (!found.isActive) {
    throw new ForbiddenError("Tài khoản của bạn đã bị khoá. Vui lòng liên hệ chủ website để được hỗ trợ.");
  }

  if (found.totpEnabledAt) {
    return { status: "2fa-required", pendingToken: sign2faPendingToken(found.id) };
  }

  const session = await issueAdminSession(found, context, input.remember ?? true);
  return { status: "ok", session };
}

/** Bước 2 (chỉ khi tài khoản đã bật 2FA): xác minh mã 6 số rồi mới cấp phiên thật */
export async function verifyAdminLogin2fa(
  pendingToken: string,
  code: string,
  context: SessionContext,
): Promise<AdminAuthResult> {
  const { userId } = verify2faPendingToken(pendingToken);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive || user.role === "CUSTOMER" || !user.totpSecret || !user.totpEnabledAt) {
    throw new UnauthorizedError("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
  }

  const result = await verifyTotp({ secret: user.totpSecret, token: code });
  if (!result.valid) throw new UnauthorizedError("Mã xác thực không đúng");

  return issueAdminSession(user, context, true);
}

async function issueAdminSession(user: User, context: SessionContext, remember: boolean): Promise<AdminAuthResult> {
  const refreshToken = await createRefreshTokenRow(user, context, remember);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { user, accessToken: signAdminAccessToken(user), refreshToken, remember };
}

/** Đổi refresh token admin lấy cặp mới — dùng chung logic xoay vòng với phía khách hàng */
export async function refreshAdminSession(refreshToken: string, context: SessionContext): Promise<AdminAuthResult> {
  const { user, remember } = await rotateRefreshToken(refreshToken);
  if (user.role === "CUSTOMER") throw new UnauthorizedError("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
  return issueAdminSession(user, context, remember);
}

/** Xoá hẳn dòng refresh token — logic giống hệt phía khách hàng (không quan tâm ai issue ra nó) */
export const logoutAdminSession = logoutSession;

export async function findActiveAdmin(userId: string): Promise<User | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.isActive && user.role !== "CUSTOMER" ? user : null;
}

/* -------------------------------------------------------------------------- */
/*  2FA (TOTP) — tự nguyện bật theo từng tài khoản quản trị                    */
/* -------------------------------------------------------------------------- */

export interface TotpSetupResult {
  secret: string;
  qrCodeDataUrl: string;
}

/** Sinh secret mới + QR — CHƯA bật (chỉ set totpEnabledAt sau khi confirm2fa đúng mã) */
export async function setupTotp(userId: string): Promise<TotpSetupResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const secret = generateSecret();
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: secret } });

  const uri = generateURI({ issuer: TOTP_ISSUER, label: user.email, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(uri);
  return { secret, qrCodeDataUrl };
}

/** Xác nhận đã quét đúng mã QR (nhập đúng 1 mã hiện tại) rồi mới thật sự bật 2FA */
export async function confirmTotp(userId: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.totpSecret) throw new NotFoundError("Bạn cần bắt đầu bước thiết lập 2FA trước");

  const result = await verifyTotp({ secret: user.totpSecret, token: code });
  if (!result.valid) throw new UnauthorizedError("Mã xác thực không đúng");

  await prisma.user.update({ where: { id: userId }, data: { totpEnabledAt: new Date() } });
  await logAdminAction(prisma, {
    actorId: userId,
    actorRole: user.role,
    action: "admin.2fa_enabled",
    targetType: "User",
    targetId: userId,
  });
}

/** Tắt 2FA (vd mất thiết bị xác thực) — cần đã đăng nhập, không phải bước quên mật khẩu */
export async function disableTotp(userId: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: null, totpEnabledAt: null } });
  await logAdminAction(prisma, {
    actorId: userId,
    actorRole: user.role,
    action: "admin.2fa_disabled",
    targetType: "User",
    targetId: userId,
  });
}
