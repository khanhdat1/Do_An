/** Dùng Map (không phải object) để tên lạ như "constructor" từ URL tuỳ ý không tra ra được gì */
const PROVIDER_LABELS = new Map<string, string>([
  ["google", "Google"],
  ["facebook", "Facebook"],
]);

function providerLabel(provider: string | undefined): string | undefined {
  return provider ? PROVIDER_LABELS.get(provider) : undefined;
}

/** Gợi ý cho người phát triển; bị lược khỏi bản build production nên khách hàng không thấy */
const DEV_HINT =
  process.env.NODE_ENV === "production"
    ? ""
    : " (Dành cho lập trình viên: điền khoá vào file .env rồi khởi động lại API, xem README mục 8.)";

/** Lỗi xảy ra lúc đăng nhập (trang đăng nhập) hay lúc liên kết thêm (trang Tài khoản) */
export type OAuthPurpose = "login" | "link";

/**
 * Câu tiếng Việt cho mã lỗi `?error=` mà API gửi về khi đăng nhập hoặc liên kết bằng
 * Google / Facebook không thành công (xem apps/api/src/routes/oauth.routes.ts).
 *
 * Chỉ mã đã biết mới có câu trả lời; mã lạ trả về `null` (không hiện gì). Nhờ vậy
 * một đường link tự chế như `?error=<chữ tuỳ ý>` không thể chèn nội dung vào trang.
 */
export function oauthErrorMessage(
  code: string | undefined,
  provider: string | undefined,
  purpose: OAuthPurpose = "login",
): string | null {
  if (!code) return null;
  const label = providerLabel(provider) ?? "mạng xã hội";
  const linking = purpose === "link";

  switch (code) {
    case "oauth_not_configured":
      return linking
        ? `Liên kết ${label} chưa được cấu hình trên hệ thống.${DEV_HINT}`
        : `Đăng nhập bằng ${label} chưa được cấu hình trên hệ thống. Vui lòng dùng email và mật khẩu.${DEV_HINT}`;
    case "oauth_denied":
      return linking
        ? `Bạn đã hủy liên kết với ${label}. Hãy thử lại nếu muốn tiếp tục.`
        : `Bạn đã hủy đăng nhập bằng ${label}. Hãy thử lại nếu muốn tiếp tục.`;
    case "oauth_state":
      return "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.";
    case "oauth_no_email":
      return `Không lấy được email từ ${label}. Hãy cho phép chia sẻ email hoặc dùng cách đăng nhập khác.`;
    case "oauth_email_taken":
      return `Email này đã có tài khoản PCZone. Hãy đăng nhập bằng cách bạn đã dùng khi tạo tài khoản (email và mật khẩu, hoặc Google), rồi vào Tài khoản → Tài khoản liên kết để liên kết ${label}.`;
    case "oauth_inactive":
      return "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ PCZone để được hỗ trợ.";
    case "oauth_login_required":
      return "Bạn cần đăng nhập để liên kết tài khoản. Vui lòng đăng nhập lại rồi thử lại.";
    case "oauth_already_linked":
      return `Tài khoản PCZone của bạn đã liên kết với một tài khoản ${label} rồi.`;
    case "oauth_provider_taken":
      return `Tài khoản ${label} này đã được liên kết với một tài khoản PCZone khác.`;
    case "oauth_failed":
      return linking
        ? `Không thể liên kết với ${label}. Vui lòng thử lại sau.`
        : `Không thể hoàn tất đăng nhập bằng ${label}. Vui lòng thử lại sau.`;
    default:
      return null;
  }
}

export interface LinkNotice {
  tone: "success" | "error";
  message: string;
}

/**
 * Kết quả lần liên kết vừa xong, đọc từ URL trang Tài khoản: `?linked=<nhà cung cấp>`
 * khi thành công, `?error=<mã>` khi thất bại. Giá trị lạ trả về `null`.
 */
export function linkNotice(
  linked: string | undefined,
  error: string | undefined,
  provider: string | undefined,
): LinkNotice | null {
  const label = providerLabel(linked);
  if (label) {
    return {
      tone: "success",
      message: `Đã liên kết ${label}. Từ giờ bạn có thể đăng nhập bằng ${label}.`,
    };
  }

  const message = oauthErrorMessage(error, provider, "link");
  return message ? { tone: "error", message } : null;
}
