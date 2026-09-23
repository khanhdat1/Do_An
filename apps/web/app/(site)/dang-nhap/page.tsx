import type { Metadata } from "next";
import Link from "next/link";
import AuthFrame from "@/components/auth/AuthFrame";
import LoginForm from "@/components/auth/LoginForm";
import { oauthErrorMessage } from "@/lib/auth-errors";
import { authHref, firstParam, resolveNext } from "@/lib/navigation";

export const metadata: Metadata = {
  title: "Đăng nhập | PCZone",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
    provider?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const next = resolveNext(params.next);
  const oauthError = oauthErrorMessage(firstParam(params.error), firstParam(params.provider));

  return (
    <AuthFrame
      mode="login"
      next={next}
      title="Đăng nhập tài khoản PCZone"
      subtitle="Chào mừng bạn quay lại hệ thống mua sắm công nghệ Hi-End"
      footer={
        <>
          Chưa có tài khoản thành viên?{" "}
          <Link
            href={authHref("/dang-ky", next)}
            className="font-bold text-brand-600 hover:underline"
          >
            Đăng ký ngay nhận 500K Voucher
          </Link>
        </>
      }
    >
      <LoginForm next={next} oauthError={oauthError} />
    </AuthFrame>
  );
}
