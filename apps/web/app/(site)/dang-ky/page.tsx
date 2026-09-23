import type { Metadata } from "next";
import Link from "next/link";
import AuthFrame from "@/components/auth/AuthFrame";
import RegisterForm from "@/components/auth/RegisterForm";
import { oauthErrorMessage } from "@/lib/auth-errors";
import { authHref, firstParam, resolveNext } from "@/lib/navigation";

export const metadata: Metadata = {
  title: "Đăng ký tài khoản | PCZone",
};

export default async function RegisterPage({
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
      mode="register"
      next={next}
      title="Đăng ký thành viên PCZone"
      subtitle="Tạo tài khoản để lưu giỏ hàng và mua sắm nhanh hơn"
      footer={
        <>
          Đã có tài khoản thành viên?{" "}
          <Link
            href={authHref("/dang-nhap", next)}
            className="font-bold text-brand-600 hover:underline"
          >
            Đăng nhập ngay
          </Link>
        </>
      }
    >
      <RegisterForm next={next} oauthError={oauthError} />
    </AuthFrame>
  );
}
