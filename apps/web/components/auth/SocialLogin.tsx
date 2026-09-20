import { PUBLIC_API_URL } from "@/lib/config";
import { FacebookIcon, GoogleIcon } from "./SocialIcons";

interface SocialLoginProps {
  /** Đường dẫn nội bộ (đã chuẩn hoá) để quay lại sau khi đăng nhập xong */
  next: string;
  /** "Đăng nhập" hoặc "Đăng ký": chỉ đổi chữ trên nút, cách hoạt động giống hệt nhau */
  verb: string;
}

const buttonClass =
  "flex h-11 items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

/**
 * Hai nút đăng nhập bằng mạng xã hội.
 *
 * Là liên kết thường (<a>) chứ không phải fetch: OAuth cần chuyển cả trang sang
 * Google / Facebook rồi quay về, không thể làm ngầm. Liên kết trỏ thẳng vào API;
 * API lo phần còn lại và đưa trình duyệt về `next` khi xong.
 */
export default function SocialLogin({ next, verb }: SocialLoginProps) {
  const href = (provider: "google" | "facebook") =>
    `${PUBLIC_API_URL}/api/auth/${provider}${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}`;

  return (
    <div>
      <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        Hoặc tiếp tục với
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <a href={href("google")} className={buttonClass}>
          <GoogleIcon className="size-4.5" />
          {verb} với Google
        </a>
        <a href={href("facebook")} className={buttonClass}>
          <FacebookIcon className="size-4.5" />
          {verb} với Facebook
        </a>
      </div>
    </div>
  );
}
