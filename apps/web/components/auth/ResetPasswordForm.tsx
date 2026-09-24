"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, LoaderCircle, Lock } from "lucide-react";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { focusField } from "@/lib/forms";
import FormError from "./FormError";
import PasswordField from "./PasswordField";

function validate(password: string, confirmPassword: string): string | null {
  if (password.length < 8) return "Mật khẩu tối thiểu 8 ký tự";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Mật khẩu phải gồm cả chữ và số";
  if (new TextEncoder().encode(password).length > 72) return "Mật khẩu quá dài (tối đa 72 byte)";
  if (confirmPassword !== password) return "Mật khẩu nhập lại không khớp";
  return null;
}

export default function ResetPasswordForm({ token }: { token: string | null }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !token) return;

    const form = event.currentTarget;
    const validationError = validate(password, confirmPassword);
    if (validationError) {
      setError(validationError);
      focusField(form, "password");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/auth/reset-password", { method: "POST", body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="surface-card space-y-4 p-5 sm:p-6">
        <FormError message="Liên kết không hợp lệ — thiếu mã đặt lại mật khẩu. Hãy mở lại link trong email, hoặc yêu cầu một link mới." />
        <Link href="/quen-mat-khau" className="block text-center text-sm font-bold text-brand-600 hover:underline">
          Yêu cầu link mới
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="surface-card space-y-4 p-5 sm:p-6">
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 ring-1 ring-emerald-600/20"
        >
          <CircleCheck className="mt-0.5 size-4.5 shrink-0" />
          Đặt lại mật khẩu thành công. Bạn đã được đăng xuất khỏi mọi thiết bị — hãy đăng nhập lại
          bằng mật khẩu mới.
        </div>
        <Link
          href="/dang-nhap"
          className="group flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-brand-500 to-brand-700 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-brand-500/25 transition hover:from-brand-600 hover:to-brand-700"
        >
          Đăng nhập ngay
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="surface-card space-y-4 p-5 sm:p-6">
      <PasswordField
        label="Mật khẩu mới"
        required
        name="password"
        autoComplete="new-password"
        placeholder="Tối thiểu 8 ký tự"
        hint="Gồm cả chữ và số"
        icon={<Lock className="size-4.5" />}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <PasswordField
        label="Nhập lại mật khẩu mới"
        required
        name="confirmPassword"
        autoComplete="new-password"
        placeholder="Nhập lại mật khẩu mới"
        icon={<Lock className="size-4.5" />}
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
      />

      {error ? <FormError message={error} /> : null}

      <button
        type="submit"
        disabled={submitting}
        className="group flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-brand-500 to-brand-700 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-brand-500/25 transition hover:from-brand-600 hover:to-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? <LoaderCircle className="size-4.5 animate-spin" /> : null}
        {submitting ? "Đang lưu..." : "Đặt lại mật khẩu"}
      </button>
    </form>
  );
}
