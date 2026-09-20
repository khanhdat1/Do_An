import Link from "next/link";
import { ChevronRight } from "lucide-react";
import AuthAside from "./AuthAside";
import AuthTabs from "./AuthTabs";
import SocialLogin from "./SocialLogin";

interface AuthFrameProps {
  mode: "login" | "register";
  /** Đường dẫn nội bộ đã chuẩn hoá để quay lại sau khi đăng nhập */
  next: string;
  title: string;
  subtitle: string;
  /** Biểu mẫu (LoginForm / RegisterForm) */
  children: React.ReactNode;
  /** Dòng chuyển qua tab còn lại: "Chưa có tài khoản? Đăng ký ngay" */
  footer: React.ReactNode;
}

/**
 * Khung chung của trang đăng nhập và đăng ký: đường dẫn, thẻ hai cột (cột thương hiệu
 * tối bên trái, cột biểu mẫu trắng bên phải), thanh chuyển tab và hai nút mạng xã hội.
 */
export default function AuthFrame({
  mode,
  next,
  title,
  subtitle,
  children,
  footer,
}: AuthFrameProps) {
  return (
    <div className="container-page py-5 sm:py-8">
      <nav aria-label="Đường dẫn" className="mx-auto mb-4 max-w-6xl">
        <ol className="flex items-center gap-1.5 text-xs text-slate-500">
          <li>
            <Link href="/" className="transition hover:text-brand-600">
              Trang chủ
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-3.5 text-slate-300" />
          </li>
          <li aria-current="page" className="font-medium text-slate-700">
            Đăng nhập &amp; Đăng ký tài khoản
          </li>
        </ol>
      </nav>

      <div className="mx-auto grid max-w-6xl grid-cols-1 overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/8 ring-1 ring-slate-200 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <AuthAside mode={mode} />

        <div className="flex flex-col justify-center px-5 py-8 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
          <div className="mx-auto w-full max-w-xl">
            <AuthTabs mode={mode} next={next} />

            <h1 className="mt-8 text-2xl font-bold text-slate-900 sm:text-[26px]">{title}</h1>
            <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>

            <div className="mt-6">{children}</div>

            <div className="mt-6">
              <SocialLogin next={next} verb={mode === "login" ? "Đăng nhập" : "Đăng ký"} />
            </div>

            <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
