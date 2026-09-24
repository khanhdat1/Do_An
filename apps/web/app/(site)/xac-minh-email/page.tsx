import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import VerifyEmailNotice from "@/components/auth/VerifyEmailNotice";

export const metadata: Metadata = {
  title: "Xác minh email | PCZone",
  description: "Xác minh email tài khoản PCZone.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" && params.token.length > 0 ? params.token : null;

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-50">
            <MailCheck className="size-7 text-brand-500" strokeWidth={1.8} />
          </span>
          <h1 className="section-title mt-3 text-2xl sm:text-3xl">Xác minh email</h1>
        </div>

        <VerifyEmailNotice token={token} />
      </div>
    </div>
  );
}
