import type { Metadata } from "next";
import AccountView from "@/components/auth/AccountView";
import { linkNotice } from "@/lib/auth-errors";
import { firstParam } from "@/lib/navigation";

export const metadata: Metadata = {
  title: "Tài khoản của tôi | PCZone",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{
    linked?: string | string[];
    error?: string | string[];
    provider?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const notice = linkNotice(
    firstParam(params.linked),
    firstParam(params.error),
    firstParam(params.provider),
  );

  return (
    <div className="container-page py-8">
      <AccountView notice={notice} />
    </div>
  );
}
