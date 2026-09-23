import { Router } from "express";
import { z } from "zod";
import { toAdminUserDto } from "../mappers/user.mapper.js";
import { authenticateAdmin, requireAuth } from "../middleware/auth.js";
import { UnauthorizedError } from "../middleware/errors.js";
import { adminLoginLimiter, noStore } from "../middleware/security.js";
import {
  confirmTotp,
  disableTotp,
  findActiveAdmin,
  loginAdmin,
  logoutAdminSession,
  refreshAdminSession,
  setupTotp,
  verifyAdminLogin2fa,
} from "../services/admin-auth.service.js";
import {
  ADMIN_REFRESH_COOKIE,
  clearAdminAuthCookies,
  readCookie,
  setAdminAuthCookies,
} from "../utils/cookies.js";
import { sessionContext } from "../utils/session.js";

export const adminAuthRouter = Router();

adminAuthRouter.use(noStore);

const loginSchema = z.object({
  email: z.email("Email không hợp lệ").trim().toLowerCase(),
  password: z.string().min(1, "Vui lòng nhập mật khẩu").max(200),
  remember: z.boolean().default(true),
});

const verify2faSchema = z.object({
  pendingToken: z.string().min(1),
  code: z.string().trim().regex(/^\d{6}$/, "Mã xác thực gồm 6 chữ số"),
});

const totpCodeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Mã xác thực gồm 6 chữ số") });

/** POST /api/admin/auth/login — sai mật khẩu HOẶC tài khoản khách hàng đều chung một lỗi (không lộ) */
adminAuthRouter.post("/login", adminLoginLimiter, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await loginAdmin(input, sessionContext(req));

    if (result.status === "2fa-required") {
      res.json({ status: "2fa-required", pendingToken: result.pendingToken });
      return;
    }

    setAdminAuthCookies(res, result.session, { remember: result.session.remember });
    res.json({ status: "ok", user: toAdminUserDto(result.session.user) });
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/auth/login/verify-2fa — bước 2, chỉ dùng khi login trả "2fa-required" */
adminAuthRouter.post("/login/verify-2fa", adminLoginLimiter, async (req, res, next) => {
  try {
    const { pendingToken, code } = verify2faSchema.parse(req.body);
    const session = await verifyAdminLogin2fa(pendingToken, code, sessionContext(req));

    setAdminAuthCookies(res, session, { remember: session.remember });
    res.json({ user: toAdminUserDto(session.user) });
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/auth/refresh */
adminAuthRouter.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = readCookie(req, ADMIN_REFRESH_COOKIE);
    if (!refreshToken) throw new UnauthorizedError("Bạn chưa đăng nhập");

    const session = await refreshAdminSession(refreshToken, sessionContext(req));
    setAdminAuthCookies(res, session, { remember: session.remember });
    res.json({ user: toAdminUserDto(session.user) });
  } catch (error) {
    if (error instanceof UnauthorizedError) clearAdminAuthCookies(res);
    next(error);
  }
});

/** POST /api/admin/auth/logout */
adminAuthRouter.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = readCookie(req, ADMIN_REFRESH_COOKIE);
    if (refreshToken) await logoutAdminSession(refreshToken);

    clearAdminAuthCookies(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

/** GET /api/admin/auth/me — khác /api/auth/me: chưa đăng nhập thì 401 thẳng, không trả {user:null} */
adminAuthRouter.get("/me", authenticateAdmin, requireAuth, async (req, res, next) => {
  try {
    const user = await findActiveAdmin(req.auth!.userId);
    if (!user) throw new UnauthorizedError("Phiên đăng nhập không còn hiệu lực");
    res.json({ user: toAdminUserDto(user) });
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/auth/2fa/setup — sinh secret + QR mới, chưa bật */
adminAuthRouter.post("/2fa/setup", authenticateAdmin, requireAuth, async (req, res, next) => {
  try {
    res.json(await setupTotp(req.auth!.userId));
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/auth/2fa/confirm — nhập đúng 1 mã thì mới thật sự bật */
adminAuthRouter.post("/2fa/confirm", authenticateAdmin, requireAuth, async (req, res, next) => {
  try {
    const { code } = totpCodeSchema.parse(req.body);
    await confirmTotp(req.auth!.userId, code);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/auth/2fa/disable */
adminAuthRouter.post("/2fa/disable", authenticateAdmin, requireAuth, async (req, res, next) => {
  try {
    await disableTotp(req.auth!.userId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
