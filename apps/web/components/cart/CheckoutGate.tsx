"use client";

import Link from "next/link";
import { ArrowLeft, Construction, LoaderCircle } from "lucide-react";
import { useRequireAuth } from "@/components/auth/useRequireAuth";

/**
 * Cửa vào bước đặt hàng. Mới có phần bắt buộc đăng nhập (đăng nhập xong quay lại
 * đúng đây); form địa chỉ, chọn thanh toán và tạo đơn sẽ làm ở bước tiếp theo.
 */
export default function CheckoutGate() {
  const user = useRequireAuth("/thanh-toan");

  if (!user) {
    return (
      <div className="surface-card mx-auto flex max-w-lg items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang kiểm tra đăng nhập...
      </div>
    );
  }

  return (
    <div className="surface-card mx-auto flex max-w-lg flex-col items-center px-6 py-14 text-center">
      <span className="grid size-20 place-items-center rounded-full bg-gold-400/15 text-gold-600">
        <Construction className="size-9" />
      </span>
      <h1 className="mt-5 text-lg font-bold text-slate-800">Bước đặt hàng đang được xây dựng</h1>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500">
        Xin chào {user.fullName}, giỏ hàng của bạn đã được lưu. Tính năng nhập địa chỉ giao hàng và
        thanh toán sẽ sớm có mặt.
      </p>
      <Link
        href="/gio-hang"
        className="mt-6 flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
      >
        <ArrowLeft className="size-4" />
        Quay lại giỏ hàng
      </Link>
    </div>
  );
}
