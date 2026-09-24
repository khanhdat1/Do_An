"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { apiFetch, errorMessage } from "@/lib/api-client";
import FormError from "./FormError";

type State = { status: "verifying" } | { status: "done" } | { status: "error"; message: string };

/**
 * Bấm link trong email là đủ — không cần thêm bước nào của người dùng, tự gọi API ngay khi trang
 * mở (khác `/dat-lai-mat-khau`, vốn cần thêm một giá trị mới là mật khẩu nên bắt buộc phải có form).
 */
export default function VerifyEmailNotice({ token }: { token: string | null }) {
  const [state, setState] = useState<State>(token ? { status: "verifying" } : { status: "error", message: "" });
  const calledRef = useRef(false);

  useEffect(() => {
    if (!token || calledRef.current) return;
    calledRef.current = true;

    apiFetch("/api/auth/verify-email", { method: "POST", body: { token } })
      .then(() => setState({ status: "done" }))
      .catch((error) => setState({ status: "error", message: errorMessage(error) }));
  }, [token]);

  if (!token) {
    return (
      <div className="surface-card space-y-4 p-5 sm:p-6">
        <FormError message="Liên kết không hợp lệ — thiếu mã xác minh. Hãy mở lại link trong email." />
        <Link href="/tai-khoan" className="block text-center text-sm font-bold text-brand-600 hover:underline">
          Về trang Tài khoản
        </Link>
      </div>
    );
  }

  if (state.status === "verifying") {
    return (
      <div className="surface-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang xác minh...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="surface-card space-y-4 p-5 sm:p-6">
        <FormError message={state.message} />
        <Link href="/tai-khoan" className="block text-center text-sm font-bold text-brand-600 hover:underline">
          Về trang Tài khoản để gửi lại
        </Link>
      </div>
    );
  }

  return (
    <div className="surface-card space-y-4 p-5 sm:p-6">
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-lg bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 ring-1 ring-emerald-600/20"
      >
        <CircleCheck className="mt-0.5 size-4.5 shrink-0" />
        Xác minh email thành công.
      </div>
      <Link
        href="/tai-khoan"
        className="flex h-11 w-full items-center justify-center rounded-lg bg-linear-to-r from-brand-500 to-brand-700 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-brand-500/25 transition hover:from-brand-600 hover:to-brand-700"
      >
        Về trang Tài khoản
      </Link>
    </div>
  );
}
