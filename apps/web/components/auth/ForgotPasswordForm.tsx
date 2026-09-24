"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, LoaderCircle, Mail } from "lucide-react";
import TextField from "@/components/ui/TextField";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { focusField } from "@/lib/forms";

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

/**
 * Form "quên mật khẩu". Server LUÔN trả cùng một thông điệp bất kể email có tồn tại hay không
 * (chống dò email đã đăng ký) — nên ở đây cũng chỉ có một trạng thái thành công duy nhất, không
 * phân biệt "đã gửi" hay "email không tồn tại".
 */
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_PATTERN.test(trimmed)) {
      setError("Vui lòng nhập một email hợp lệ");
      focusField(form, "email");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/auth/forgot-password", { method: "POST", body: { email: trimmed } });
      setSent(trimmed);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="surface-card space-y-4 p-5 sm:p-6">
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 ring-1 ring-emerald-600/20"
        >
          <CircleCheck className="mt-0.5 size-4.5 shrink-0" />
          Nếu <strong>{sent}</strong> đã đăng ký tại PCZone, chúng tôi đã gửi email chứa link đặt lại
          mật khẩu — link có hiệu lực trong 30 phút. Kiểm tra cả hộp thư rác nếu chưa thấy.
        </div>
        <Link
          href="/dang-nhap"
          className="block text-center text-sm font-bold text-brand-600 hover:underline"
        >
          Quay lại đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="surface-card space-y-4 p-5 sm:p-6">
      <TextField
        label="Email đã đăng ký"
        required
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        placeholder="name@example.com"
        icon={<Mail className="size-4.5" />}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={error ?? undefined}
      />

      <button
        type="submit"
        disabled={submitting}
        className="group flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-brand-500 to-brand-700 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-brand-500/25 transition hover:from-brand-600 hover:to-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? <LoaderCircle className="size-4.5 animate-spin" /> : null}
        {submitting ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
        {submitting ? null : <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />}
      </button>

      <Link href="/dang-nhap" className="block text-center text-sm text-slate-500 hover:text-brand-600 hover:underline">
        Quay lại đăng nhập
      </Link>
    </form>
  );
}
