import { randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { readSession } from "../middleware/auth.js";
import { oauthLimiter } from "../middleware/security.js";
import {
  buildAuthorizeUrl,
  fetchSocialProfile,
  getProvider,
  isConfigured,
  OAuthError,
  type ProviderDefinition,
  type OAuthErrorCode,
} from "../services/oauth.providers.js";
import { linkSocialProfile, loginWithSocialProfile } from "../services/oauth.service.js";
import { clearOAuthCookie, readOAuthCookie, setOAuthCookie } from "../utils/cookies.js";
import { safeNextPath, webUrl } from "../utils/redirect.js";
import { finishLogin, sessionContext } from "../utils/session.js";

/**
 * Đăng nhập bằng Google / Facebook (OAuth 2.0, luồng "authorization code").
 *
 *   GET /api/auth/:provider            chuyển người dùng sang trang đồng ý của nhà cung cấp
 *   GET /api/auth/:provider/callback   nhà cung cấp gọi về kèm `code`; đổi lấy hồ sơ rồi đăng nhập
 *
 * Thêm `?link=1` vào bước đầu để NGƯỜI ĐÃ ĐĂNG NHẬP liên kết thêm tài khoản mạng xã
 * hội vào tài khoản PCZone của mình (nút "Liên kết" ở trang Tài khoản) thay vì đăng nhập.
 *
 * Cả hai là điều hướng của trình duyệt chứ không phải fetch, nên kết quả luôn là
 * chuyển hướng về web. Đăng nhập: thành công thì về trang `next`, thất bại thì về
 * /dang-nhap kèm `?error=<mã>`. Liên kết: về /tai-khoan kèm `?linked=<nhà cung cấp>`
 * hoặc `?error=<mã>`. Giao diện tự đổi mã sang câu tiếng Việt.
 */
export const oauthRouter = Router();

/** Nơi luồng "liên kết" bắt đầu và cũng là nơi nó kết thúc, dù thành công hay thất bại */
const ACCOUNT_PATH = "/tai-khoan";

function firstString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Tên nhà cung cấp trên URL; Express 5 kiểu hoá tham số đường dẫn là `string | string[]` */
function providerFrom(param: string | string[] | undefined): ProviderDefinition | undefined {
  return getProvider(Array.isArray(param) ? (param[0] ?? "") : (param ?? ""));
}

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Thất bại: đăng nhập thì về trang đăng nhập (kèm `next`, để lần thử lại vẫn quay về
 * đúng trang), liên kết thì về trang Tài khoản. Cả hai kèm mã lỗi.
 */
function failureUrl(
  definition: ProviderDefinition,
  code: OAuthErrorCode,
  target: { next: string; linking: boolean },
): string {
  if (target.linking) return webUrl(ACCOUNT_PATH, { error: code, provider: definition.key });

  return webUrl("/dang-nhap", {
    error: code,
    provider: definition.key,
    ...(target.next === "/" ? {} : { next: target.next }),
  });
}

/** Bước 1: bắt đầu — ghi nhớ `state` rồi chuyển sang nhà cung cấp */
oauthRouter.get("/:provider", oauthLimiter, (req, res, next) => {
  const definition = providerFrom(req.params.provider);
  if (!definition) return next();

  const linking = req.query.link === "1";
  const nextPath = linking ? ACCOUNT_PATH : safeNextPath(firstString(req.query.next));
  const fail = (code: OAuthErrorCode) =>
    res.redirect(failureUrl(definition, code, { next: nextPath, linking }));

  if (!isConfigured(definition)) return fail("oauth_not_configured");

  // Liên kết chỉ dành cho người đang đăng nhập; ghi lại là ai để bước sau gắn đúng tài khoản
  const linkUserId = linking ? readSession(req)?.userId : undefined;
  if (linking && !linkUserId) return fail("oauth_login_required");

  const state = randomBytes(24).toString("base64url");
  setOAuthCookie(res, { provider: definition.key, state, next: nextPath, linkUserId });
  res.redirect(buildAuthorizeUrl(definition, state));
});

/** Bước 2: nhà cung cấp gọi về */
oauthRouter.get("/:provider/callback", oauthLimiter, async (req, res, next) => {
  const definition = providerFrom(req.params.provider);
  if (!definition) return next();

  const flow = readOAuthCookie(req);
  clearOAuthCookie(res); // mỗi `state` chỉ dùng được một lần
  const nextPath = safeNextPath(flow?.next);
  const linkUserId = flow?.linkUserId;
  const fail = (code: OAuthErrorCode) =>
    res.redirect(failureUrl(definition, code, { next: nextPath, linking: Boolean(linkUserId) }));

  if (!isConfigured(definition)) return fail("oauth_not_configured");

  // Người dùng bấm "Huỷ" ở trang đồng ý
  if (firstString(req.query.error)) {
    return fail(req.query.error === "access_denied" ? "oauth_denied" : "oauth_failed");
  }

  // Chống CSRF đăng nhập: yêu cầu quay về phải mang đúng `state` đã đặt trong cookie của CHÍNH trình duyệt này
  const state = firstString(req.query.state);
  if (!flow || flow.provider !== definition.key || !state || !sameSecret(state, flow.state)) {
    return fail("oauth_state");
  }

  const code = firstString(req.query.code);
  if (!code) return fail("oauth_failed");

  // Liên kết: phiên hiện tại phải vẫn là người đã bấm "Liên kết", không bị đăng xuất hay
  // đổi sang tài khoản khác giữa chừng. Kiểm tra trước khi đổi `code` để khỏi tốn lượt.
  if (linkUserId && readSession(req)?.userId !== linkUserId) return fail("oauth_login_required");

  try {
    const profile = await fetchSocialProfile(definition, code);

    if (linkUserId) {
      await linkSocialProfile(linkUserId, profile);
      res.redirect(webUrl(ACCOUNT_PATH, { linked: definition.key }));
      return;
    }

    const session = await loginWithSocialProfile(profile, sessionContext(req));

    await finishLogin(req, res, session);
    res.redirect(webUrl(nextPath));
  } catch (error) {
    if (error instanceof OAuthError) return fail(error.code);

    console.error(
      `${linkUserId ? "Liên kết" : "Đăng nhập"} ${definition.label} thất bại:`,
      error instanceof Error ? error.message : error,
    );
    return fail("oauth_failed");
  }
});
