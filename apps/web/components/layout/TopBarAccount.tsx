"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { errorMessage } from "@/lib/api-client";
import { getGivenName } from "@/lib/user";

/** Phần đăng nhập / xin chào ở góc phải của thanh trên cùng */
export default function TopBarAccount() {
  const { status, user, logout } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
      toast.success("Bạn đã đăng xuất");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  // Đang hỏi server ai đang đăng nhập: giữ chỗ để thanh không giật khi có kết quả
  if (status === "loading") {
    return <span aria-hidden className="h-3.5 w-36 animate-pulse rounded bg-white/10" />;
  }

  if (!user) {
    return (
      <Link
        href="/dang-nhap"
        className="flex items-center gap-1.5 transition hover:text-gold-400"
      >
        <UserRound className="size-3.5" />
        Đăng nhập / Đăng ký
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/tai-khoan"
        className="flex items-center gap-1.5 transition hover:text-gold-400"
      >
        <UserRound className="size-3.5" />
        Xin chào,
        <span className="font-semibold text-gold-400">{getGivenName(user.fullName)}</span>
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        disabled={busy}
        className="flex items-center gap-1.5 transition hover:text-gold-400 disabled:opacity-60"
      >
        <LogOut className="size-3.5" />
        Đăng xuất
      </button>
    </>
  );
}
