import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma, prisma, type User } from "@pczone/db";
import { ConflictError, ForbiddenError, UnauthorizedError } from "../middleware/errors.js";
import {
  generateRefreshToken,
  hashToken,
  refreshTtlMs,
  signAccessToken,
  wasRemembered,
} from "./token.service.js";

export const BCRYPT_COST = 12;

/**
 * Hash hợp lệ của một chuỗi không ai biết. Khi email không tồn tại vẫn phải
 * chạy bcrypt.compare với hash này, để thời gian phản hồi của "sai email" và
 * "sai mật khẩu" giống nhau — kẻ tấn công không dò được email nào đã đăng ký.
 */
export const DUMMY_HASH = "$2b$12$OeBTJkIOm/aJr9DvZFkA5Od3XENL.ltkTpU35IytbDc8KOE2VGBBG";

/**
 * Hai tab cùng gọi /refresh trong một khoảng rất ngắn (mở lại trình duyệt
 * khôi phục nhiều tab). Tab đến sau cầm refresh token vừa bị tab trước xoay
 * vòng; nếu từ chối thì cookie bị dọn và người dùng bị đăng xuất oan. Chấp nhận
 * token vừa bị thu hồi trong vài giây là cách xử lý phổ biến.
 */
const REFRESH_REUSE_LEEWAY_MS = 10_000;

/** Giữ lại dòng refresh token đã thu hồi thêm một lúc rồi mới dọn */
const REVOKED_RETENTION_MS = 60 * 60 * 1000;

export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  /** Có tick "Ghi nhớ đăng nhập" không: quyết định cookie sống 30 ngày hay chỉ sống tới khi đóng trình duyệt */
  remember: boolean;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Mật khẩu băm cho tài khoản chỉ đăng nhập bằng mạng xã hội. Nó là băm của một
 * chuỗi ngẫu nhiên 256 bit không ai biết, nên không thể đăng nhập bằng mật khẩu.
 * Dùng cùng cost với mật khẩu thật để thời gian phản hồi lúc đăng nhập không lộ
 * email nào là tài khoản mạng xã hội.
 */
export async function createUnusablePasswordHash(): Promise<string> {
  return bcrypt.hash(randomBytes(32).toString("base64url"), BCRYPT_COST);
}

/**
 * Phần dùng CHUNG cho phiên khách hàng lẫn phiên admin (admin-auth.service.ts): tạo một dòng
 * refresh token trong DB, dọn các dòng cũ đã hết hạn/đã thu hồi của chính người dùng này. Không
 * quan tâm "khách hàng hay admin" — điều đó chỉ nằm ở việc hàm gọi nó ký access token bằng
 * `signAccessToken` hay `signAdminAccessToken` sau đó.
 */
export async function createRefreshTokenRow(
  user: { id: string },
  context: SessionContext,
  remember: boolean,
): Promise<string> {
  const now = Date.now();
  const { token: refreshToken, tokenHash } = generateRefreshToken();

  await prisma.refreshToken.deleteMany({
    where: {
      userId: user.id,
      OR: [
        { expiresAt: { lt: new Date(now) } },
        { revokedAt: { lt: new Date(now - REVOKED_RETENTION_MS) } },
      ],
    },
  });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      expiresAt: new Date(now + refreshTtlMs(remember)),
    },
  });

  return refreshToken;
}

/** Tạo phiên mới: một access token (JWT) + một refresh token (lưu hash vào DB) */
export async function issueSession(
  user: User,
  context: SessionContext,
  remember = true,
): Promise<AuthResult> {
  const refreshToken = await createRefreshTokenRow(user, context, remember);
  return { user, accessToken: signAccessToken(user), refreshToken, remember };
}

export async function registerUser(
  input: RegisterInput,
  context: SessionContext,
): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError("Email này đã được đăng ký");

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  let user: User;
  try {
    user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        phone: input.phone,
        lastLoginAt: new Date(),
      },
    });
  } catch (error) {
    // Hai request đăng ký cùng email chạy song song: người thua bị unique index chặn
    if (isUniqueViolation(error)) throw new ConflictError("Email này đã được đăng ký");
    throw error;
  }

  return issueSession(user, context);
}

export async function loginUser(
  input: { email: string; password: string; remember?: boolean },
  context: SessionContext,
): Promise<AuthResult> {
  const found = await prisma.user.findUnique({ where: { email: input.email } });

  const passwordOk = await bcrypt.compare(input.password, found?.passwordHash ?? DUMMY_HASH);
  if (!found || !passwordOk) {
    throw new UnauthorizedError("Email hoặc mật khẩu không đúng");
  }

  // Kiểm tra khoá tài khoản SAU khi mật khẩu đúng, để người lạ không dò được tài khoản nào bị khoá
  if (!found.isActive) {
    throw new ForbiddenError("Tài khoản của bạn đã bị khoá. Vui lòng liên hệ PCZone để được hỗ trợ.");
  }

  const user = await prisma.user.update({
    where: { id: found.id },
    data: { lastLoginAt: new Date() },
  });

  return issueSession(user, context, input.remember ?? true);
}

/**
 * Kiểm tra + xoay vòng một refresh token (thu hồi token cũ, trả về user để hàm gọi tự ký access
 * token phù hợp — khách hàng hay admin). Dùng chung cho cả hai phía, giống `createRefreshTokenRow`.
 */
export async function rotateRefreshToken(
  refreshToken: string,
): Promise<{ user: User; remember: boolean }> {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: true },
  });

  const now = Date.now();
  const invalid =
    !record ||
    record.expiresAt.getTime() <= now ||
    !record.user.isActive ||
    (record.revokedAt !== null && now - record.revokedAt.getTime() > REFRESH_REUSE_LEEWAY_MS);

  if (invalid) throw new UnauthorizedError("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");

  // Thu hồi có điều kiện `revokedAt: null`: nếu hai request tranh nhau, chỉ một bên ghi được
  if (record.revokedAt === null) {
    await prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date(now) },
    });
  }

  return { user: record.user, remember: wasRemembered(record) };
}

/**
 * Đổi refresh token lấy cặp token mới (xoay vòng): token cũ bị thu hồi ngay,
 * nên một refresh token bị đánh cắp chỉ dùng được cho tới lần người thật refresh kế tiếp.
 */
export async function refreshSession(
  refreshToken: string,
  context: SessionContext,
): Promise<AuthResult> {
  const { user, remember } = await rotateRefreshToken(refreshToken);
  return issueSession(user, context, remember);
}

/** Đăng xuất: xoá hẳn dòng refresh token (không để lại token đã thu hồi có thể bị dùng lại) */
export async function logoutSession(refreshToken: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(refreshToken) } });
}

/** Trả về người dùng nếu còn tồn tại và chưa bị khoá */
export async function findActiveUser(userId: string): Promise<User | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.isActive ? user : null;
}

export interface UpdateProfileInput {
  fullName: string;
  /** Chuỗi rỗng để xoá số điện thoại đã lưu */
  phone?: string;
}

/** Sửa hồ sơ: chỉ tên và số điện thoại. Không cho đổi email ở đây — đó là danh tính đăng nhập/liên kết mạng xã hội, cần luồng riêng (xác minh lại) nếu làm sau này. */
export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { fullName: input.fullName, phone: input.phone || null },
  });
}
