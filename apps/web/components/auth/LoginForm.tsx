"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Lock, Mail } from "lucide-react";
import TextField from "@/components/ui/TextField";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ApiError, errorMessage } from "@/lib/api-client";
import { focusField } from "@/lib/forms";
import { getGivenName } from "@/lib/user";
import FormError from "./FormError";
import PasswordField from "./PasswordField";

type Field = "email" | "password";
type FieldErrors = Partial<Record<Field, string>>;

const FIELD_ORDER: Field[] = ["email", "password"];
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

interface LoginFormProps {
  /** Đường dẫn nội bộ đã được chuẩn hoá để quay lại sau khi đăng nhập */
  next: string;
  /** Lỗi từ lần đăng nhập Google / Facebook vừa thất bại (đọc từ `?error=` trên URL) */
  oauthError?: string | null;
}

export default function LoginForm({ next, oauthError = null }: LoginFormProps) {
  const router = useRouter();
  const { status, login } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Đã đăng nhập (vừa submit xong, hoặc tự mở lại trang này): đi tiếp tới `next`
  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, next, router]);

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (!email.trim()) found.email = "Vui lòng nhập email";
    else if (!EMAIL_PATTERN.test(email.trim())) found.email = "Email không hợp lệ";
    if (!password) found.password = "Vui lòng nhập mật khẩu";
    return found;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const found = validate();
    setErrors(found);
    setFormError(null);

    const firstInvalid = FIELD_ORDER.find((field) => found[field]);
    if (firstInvalid) {
      focusField(form, firstInvalid);
      return;
    }

    setSubmitting(true);
    try {
      const user = await login({ email: email.trim(), password, remember });
      toast.success(`Chào mừng ${getGivenName(user.fullName)} quay lại!`);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        const mapped = { email: error.fieldErrors.email, password: error.fieldErrors.password };
        setErrors(mapped);
        focusField(form, FIELD_ORDER.find((field) => mapped[field]) ?? "email");
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "authenticated") {
    return <p className="py-8 text-center text-sm text-slate-500">Bạn đã đăng nhập, đang chuyển hướng...</p>;
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {oauthError ? <FormError message={oauthError} /> : null}

      <TextField
        label="Email"
        required
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        placeholder="name@example.com"
        icon={<Mail className="size-4.5" />}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errors.email}
      />

      <PasswordField
        label="Mật khẩu"
        required
        name="password"
        autoComplete="current-password"
        placeholder="••••••••"
        icon={<Lock className="size-4.5" />}
        labelAside={
          <button
            type="button"
            onClick={() =>
              toast.info(
                "Tính năng đặt lại mật khẩu đang được phát triển. Vui lòng liên hệ support@pczone.vn để được hỗ trợ.",
              )
            }
            className="text-xs font-bold text-brand-600 transition hover:text-brand-700 hover:underline"
          >
            Quên mật khẩu?
          </button>
        }
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
      />

      <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[13px] text-slate-600">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          className="size-4 cursor-pointer rounded border-slate-300 accent-brand-500"
        />
        Ghi nhớ đăng nhập trên thiết bị này
      </label>

      {formError ? <FormError message={formError} /> : null}

      <button
        type="submit"
        disabled={submitting}
        className="group flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-brand-500 to-brand-700 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-brand-500/25 transition hover:from-brand-600 hover:to-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? <LoaderCircle className="size-4.5 animate-spin" /> : null}
        {submitting ? "Đang đăng nhập..." : "Đăng nhập hệ thống"}
        {submitting ? null : (
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        )}
      </button>
    </form>
  );
}
