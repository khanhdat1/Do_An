import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Quên mật khẩu | PCZone",
  description: "Đặt lại mật khẩu tài khoản PCZone qua email.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-50">
            <KeyRound className="size-7 text-brand-500" strokeWidth={1.8} />
          </span>
          <h1 className="section-title mt-3 text-2xl sm:text-3xl">Quên mật khẩu</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu.
          </p>
        </div>

        <ForgotPasswordForm />
      </div>
    </div>
  );
}
