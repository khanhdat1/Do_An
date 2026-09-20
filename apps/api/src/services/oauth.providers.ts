import { OAuthProvider } from "@pczone/db";
import { z } from "zod";
import { env } from "../env.js";

export type ProviderKey = "google" | "facebook";

/**
 * Mã lỗi gửi về trang đăng nhập qua `?error=`. Chỉ gửi mã, không gửi nội dung lỗi
 * của nhà cung cấp: frontend tự đổi mã sang câu tiếng Việt, nên không có chuyện
 * chèn chữ tuỳ ý vào giao diện qua URL.
 */
export type OAuthErrorCode =
  | "oauth_not_configured"
  | "oauth_denied"
  | "oauth_state"
  | "oauth_failed"
  | "oauth_no_email"
  | "oauth_email_taken"
  | "oauth_inactive"
  // Ba mã dưới đây chỉ xảy ra khi LIÊN KẾT (người đã đăng nhập bấm "Liên kết" ở trang Tài khoản)
  | "oauth_login_required"
  | "oauth_already_linked"
  | "oauth_provider_taken";

export class OAuthError extends Error {
  constructor(
    readonly code: OAuthErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "OAuthError";
  }
}

/** Hồ sơ người dùng lấy từ Google / Facebook, đã chuẩn hoá về một dạng chung */
export interface SocialProfile {
  provider: OAuthProvider;
  /** `sub` của Google / `id` của Facebook — cố định suốt đời tài khoản mạng xã hội */
  providerAccountId: string;
  email: string | null;
  /**
   * Nhà cung cấp có BẢO ĐẢM email đã xác minh không.
   * Google: có (`email_verified`). Facebook: không bảo đảm nên luôn là false —
   * email của Facebook không bao giờ được dùng để chiếm hay gộp vào tài khoản có sẵn.
   */
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
}

export interface ProviderDefinition {
  key: ProviderKey;
  provider: OAuthProvider;
  /** Tên hiển thị trong thông báo lỗi */
  label: string;
  clientId?: string;
  clientSecret?: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
}

const FACEBOOK_GRAPH_URL = "https://graph.facebook.com/v23.0";

/** Khi kiểm thử (OAUTH_MOCK_URL) mọi lời gọi đi vào máy chủ giả thay vì nhà cung cấp thật */
function endpoints(
  key: ProviderKey,
  real: { authorizeUrl: string; tokenUrl: string; userInfoUrl: string },
) {
  const mock = env.oauth.mockUrl;
  if (!mock) return real;

  return {
    authorizeUrl: `${mock}/${key}/authorize`,
    tokenUrl: `${mock}/${key}/token`,
    userInfoUrl: `${mock}/${key}/userinfo`,
  };
}

const PROVIDERS: Record<ProviderKey, ProviderDefinition> = {
  google: {
    key: "google",
    provider: OAuthProvider.GOOGLE,
    label: "Google",
    clientId: env.oauth.google.clientId,
    clientSecret: env.oauth.google.clientSecret,
    scope: "openid email profile",
    ...endpoints("google", {
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    }),
  },
  facebook: {
    key: "facebook",
    provider: OAuthProvider.FACEBOOK,
    label: "Facebook",
    clientId: env.oauth.facebook.clientId,
    clientSecret: env.oauth.facebook.clientSecret,
    scope: "public_profile,email",
    ...endpoints("facebook", {
      authorizeUrl: `https://www.facebook.com/v23.0/dialog/oauth`,
      tokenUrl: `${FACEBOOK_GRAPH_URL}/oauth/access_token`,
      userInfoUrl: `${FACEBOOK_GRAPH_URL}/me`,
    }),
  },
};

export function getProvider(key: string): ProviderDefinition | undefined {
  return key === "google" || key === "facebook" ? PROVIDERS[key] : undefined;
}

export function isConfigured(definition: ProviderDefinition): boolean {
  return Boolean(definition.clientId && definition.clientSecret);
}

/** Địa chỉ nhà cung cấp gọi về sau khi người dùng đồng ý — phải được khai đúng y hệt bên Google / Facebook */
export function redirectUri(definition: ProviderDefinition): string {
  return `${env.apiPublicUrl}/api/auth/${definition.key}/callback`;
}

/** Địa chỉ trang đồng ý (consent) của nhà cung cấp để chuyển người dùng sang */
export function buildAuthorizeUrl(definition: ProviderDefinition, state: string): string {
  const url = new URL(definition.authorizeUrl);
  url.searchParams.set("client_id", definition.clientId ?? "");
  url.searchParams.set("redirect_uri", redirectUri(definition));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", definition.scope);
  url.searchParams.set("state", state);
  // Luôn hiện danh sách tài khoản Google để chọn, tránh tự đăng nhập bằng tài khoản Google đang mở sẵn
  if (definition.key === "google") url.searchParams.set("prompt", "select_account");
  return url.toString();
}

/* -------------------------------------------------------------------------- */
/*  Gọi nhà cung cấp                                                          */
/* -------------------------------------------------------------------------- */

const REQUEST_TIMEOUT_MS = 10_000;

async function requestJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  // Không ghi nội dung phản hồi vào lỗi: có thể chứa mã hoặc token
  if (!response.ok) throw new Error(`HTTP ${response.status} từ ${new URL(url).host}`);
  return response.json();
}

const tokenResponse = z.object({ access_token: z.string().min(1) });

const googleProfile = z.object({
  sub: z.string().min(1).max(100),
  email: z.string().optional(),
  email_verified: z.union([z.boolean(), z.string()]).optional(),
  name: z.string().optional(),
  picture: z.string().optional(),
});

const facebookProfile = z.object({
  id: z.string().min(1).max(100),
  name: z.string().optional(),
  email: z.string().optional(),
  picture: z.object({ data: z.object({ url: z.string().optional() }).optional() }).optional(),
});

function cleanEmail(value: string | undefined): string | null {
  const email = value?.trim().toLowerCase();
  return email ? email : null;
}

/**
 * Đổi mã (`code`) nhà cung cấp gửi về lấy access token, rồi lấy hồ sơ người dùng.
 * Cả hai bước đều là gọi từ server sang server, có kèm client secret — trình
 * duyệt của người dùng không bao giờ thấy token.
 */
export async function fetchSocialProfile(
  definition: ProviderDefinition,
  code: string,
): Promise<SocialProfile> {
  const clientId = definition.clientId ?? "";
  const clientSecret = definition.clientSecret ?? "";

  if (definition.key === "google") {
    const token = tokenResponse.parse(
      await requestJson(definition.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri(definition),
          grant_type: "authorization_code",
        }),
      }),
    );

    const info = googleProfile.parse(
      await requestJson(definition.userInfoUrl, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      }),
    );

    return {
      provider: definition.provider,
      providerAccountId: info.sub,
      email: cleanEmail(info.email),
      emailVerified: info.email_verified === true || info.email_verified === "true",
      name: info.name?.trim() || null,
      avatarUrl: info.picture ?? null,
    };
  }

  const tokenUrl = new URL(definition.tokenUrl);
  tokenUrl.search = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri(definition),
    code,
  }).toString();
  const token = tokenResponse.parse(await requestJson(tokenUrl.toString()));

  const userUrl = new URL(definition.userInfoUrl);
  userUrl.search = new URLSearchParams({
    fields: "id,name,email,picture.type(large)",
    access_token: token.access_token,
  }).toString();
  const info = facebookProfile.parse(await requestJson(userUrl.toString()));

  return {
    provider: definition.provider,
    providerAccountId: info.id,
    email: cleanEmail(info.email),
    emailVerified: false,
    name: info.name?.trim() || null,
    avatarUrl: info.picture?.data?.url ?? null,
  };
}
