import { Router } from "express";
import { z } from "zod";
import { toAuthUserDto, toLinkedProviderDto } from "../mappers/user.mapper.js";
import { authenticate } from "../middleware/auth.js";
import { BadRequestError, UnauthorizedError } from "../middleware/errors.js";
import { accountWriteLimiter, loginLimiter, noStore, passwordResetLimiter, registerLimiter } from "../middleware/security.js";
import {
  findActiveUser,
  loginUser,
  logoutSession,
  refreshSession,
  registerUser,
  updateProfile,
} from "../services/auth.service.js";
import { getProvider } from "../services/oauth.providers.js";
import { listLinkedAccounts, unlinkProvider } from "../services/oauth.service.js";
import { requestPasswordReset, resetPassword } from "../services/password-reset.service.js";
import { clearAuthCookies, readCookie, REFRESH_COOKIE, setAuthCookies } from "../utils/cookies.js";
import { finishLogin, sessionContext } from "../utils/session.js";

export const authRouter = Router();

authRouter.use(noStore);

/* -------------------------------------------------------------------------- */
/*  Kiểm tra dữ liệu vào                                                      */
/* -------------------------------------------------------------------------- */

const emailSchema = z
  .string({ error: "Vui lòng nhập email" })
  .trim()
  .toLowerCase()
  .max(254, "Email quá dài")
  .pipe(z.email("Email không hợp lệ"));

/**
 * bcrypt chỉ đọc 72 byte đầu và lặng lẽ bỏ phần còn lại, nên phải chặn ở đây:
 * nếu không, hai mật khẩu chỉ khác nhau sau byte thứ 72 sẽ bị coi là một.
 */
const newPasswordSchema = z
  .string({ error: "Vui lòng nhập mật khẩu" })
  .min(8, "Mật khẩu tối thiểu 8 ký tự")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Mật khẩu quá dài (tối đa 72 byte)")
  .refine(
    (value) => /[A-Za-z]/.test(value) && /\d/.test(value),
    "Mật khẩu phải gồm cả chữ và số",
  );

/** Số điện thoại Việt Nam, cho phép nhập có dấu cách / gạch; để trống cũng được */
const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.-]/g, ""))
  .pipe(z.union([z.literal(""), z.string().regex(/^(0|\+84)\d{9,10}$/, "Số điện thoại không hợp lệ")]))
  .transform((value) => value || undefined)
  .optional();

const forgotPasswordSchema = z.object({ email: emailSchema });

const resetPasswordSchema = z.object({
  token: z.string({ error: "Thiếu mã đặt lại mật khẩu" }).trim().min(1).max(200),
  password: newPasswordSchema,
});

const updateProfileSchema = z.object({
  fullName: z
    .string({ error: "Vui lòng nhập họ tên" })
    .trim()
    .min(2, "Họ tên tối thiểu 2 ký tự")
    .max(150, "Họ tên quá dài"),
  phone: phoneSchema,
});

const providerParam = z.object({ provider: z.enum(["google", "facebook"], { error: "Nhà cung cấp không hợp lệ" }) });

const registerSchema = z.object({
  fullName: z
    .string({ error: "Vui lòng nhập họ tên" })
    .trim()
    .min(2, "Họ tên tối thiểu 2 ký tự")
    .max(150, "Họ tên quá dài"),
  email: emailSchema,
  phone: phoneSchema,
  password: newPasswordSchema,
});

/**
 * Đăng nhập không áp luật độ mạnh của mật khẩu: tài khoản tạo trước khi có luật
 * đó (như tài khoản admin trong seed) vẫn phải đăng nhập được.
 */
const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: "Vui lòng nhập mật khẩu" })
    .min(1, "Vui lòng nhập mật khẩu")
    .max(200, "Mật khẩu quá dài"),
  /** Ô "Ghi nhớ đăng nhập trên thiết bị này". Không gửi thì mặc định có nhớ. */
  remember: z.boolean({ error: "Giá trị ghi nhớ đăng nhập không hợp lệ" }).default(true),
});

/* -------------------------------------------------------------------------- */
/*  Endpoint                                                                  */
/* -------------------------------------------------------------------------- */

/** POST /api/auth/register — tạo tài khoản và đăng nhập luôn */
authRouter.post("/register", registerLimiter, async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const session = await registerUser(input, sessionContext(req));

    await finishLogin(req, res, session);
    res.status(201).json({ user: toAuthUserDto(session.user) });
  } catch (error) {
    next(error);
  }
});

/** POST /api/auth/login  { email, password, remember? } */
authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const session = await loginUser(input, sessionContext(req));

    await finishLogin(req, res, session);
    res.json({ user: toAuthUserDto(session.user) });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/forgot-password  { email }
 * LUÔN trả cùng một thông điệp bất kể email có tồn tại hay không — không để lộ tài khoản nào
 * đã đăng ký. Có gửi email thật hay chỉ in link ra console tuỳ `RESEND_API_KEY` đã cấu hình chưa.
 */
authRouter.post("/forgot-password", passwordResetLimiter, async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    await requestPasswordReset(email);
    res.json({ status: "ok", message: "Nếu email này đã đăng ký, chúng tôi đã gửi link đặt lại mật khẩu." });
  } catch (error) {
    next(error);
  }
});

/** POST /api/auth/reset-password  { token, password } — đặt mật khẩu mới, đăng xuất khỏi mọi thiết bị */
authRouter.post("/reset-password", passwordResetLimiter, async (req, res, next) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    await resetPassword(token, password);
    res.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/refresh — đổi refresh token (cookie) lấy cặp token mới.
 * Frontend tự gọi khi một request bị 401 vì access token hết hạn.
 */
authRouter.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = readCookie(req, REFRESH_COOKIE);
    if (!refreshToken) throw new UnauthorizedError("Bạn chưa đăng nhập");

    const session = await refreshSession(refreshToken, sessionContext(req));
    // Giữ nguyên chế độ đã chọn lúc đăng nhập (ghi nhớ / chỉ trong phiên trình duyệt)
    setAuthCookies(res, session, { remember: session.remember });
    res.json({ user: toAuthUserDto(session.user) });
  } catch (error) {
    // Phiên hỏng: dọn cookie để trình duyệt không mang mãi token chết theo mỗi request
    if (error instanceof UnauthorizedError) clearAuthCookies(res);
    next(error);
  }
});

/** POST /api/auth/logout — thu hồi refresh token và xoá cookie */
authRouter.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = readCookie(req, REFRESH_COOKIE);
    if (refreshToken) await logoutSession(refreshToken);

    clearAuthCookies(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me — người dùng hiện tại.
 * Khách chưa đăng nhập nhận `{ user: null }` (200) thay vì 401, để lần mở trang
 * đầu tiên của khách không sinh ra lỗi đỏ trong console trình duyệt.
 */
authRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    if (!req.auth) {
      res.json({ user: null });
      return;
    }

    const user = await findActiveUser(req.auth.userId);
    if (!user) throw new UnauthorizedError("Phiên đăng nhập không còn hiệu lực");

    res.json({ user: toAuthUserDto(user) });
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/auth/me  { fullName, phone? } — sửa hồ sơ. Không đổi được email ở đây (mục 1). */
authRouter.patch("/me", authenticate, accountWriteLimiter, async (req, res, next) => {
  try {
    if (!req.auth) throw new UnauthorizedError("Bạn chưa đăng nhập");

    const input = updateProfileSchema.parse(req.body);
    const user = await updateProfile(req.auth.userId, input);
    res.json({ user: toAuthUserDto(user) });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/providers — các tài khoản Google / Facebook đã liên kết với người
 * dùng hiện tại (trang Tài khoản dùng để hiện "Đã liên kết" hay nút "Liên kết").
 */
authRouter.get("/providers", authenticate, async (req, res, next) => {
  try {
    if (!req.auth) throw new UnauthorizedError("Bạn chưa đăng nhập");

    const accounts = await listLinkedAccounts(req.auth.userId);
    res.json({ providers: accounts.map(toLinkedProviderDto) });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/auth/providers/:provider — huỷ liên kết. Chặn (409) nếu đây là liên kết cuối cùng
 * và tài khoản chưa có mật khẩu thật (`unlinkProvider` ở oauth.service.ts giải thích đầy đủ).
 */
authRouter.delete("/providers/:provider", authenticate, accountWriteLimiter, async (req, res, next) => {
  try {
    if (!req.auth) throw new UnauthorizedError("Bạn chưa đăng nhập");

    const { provider } = providerParam.parse(req.params);
    // providerParam đã giới hạn còn đúng "google"/"facebook" nên luôn khớp được definition
    const definition = getProvider(provider);
    if (!definition) throw new BadRequestError("Nhà cung cấp không hợp lệ");

    await unlinkProvider(req.auth.userId, definition.provider);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
