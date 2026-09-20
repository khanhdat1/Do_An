"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Lock, Mail, Phone, UserRound } from "lucide-react";
import TextField from "@/components/ui/TextField";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ApiError, errorMessage } from "@/lib/api-client";
import { focusField } from "@/lib/forms";
import { getGivenName } from "@/lib/user";
import FormError from "./FormError";
import PasswordField from "./PasswordField";

type Field = "fullName" | "email" | "phone" | "password" | "confirmPassword";
type FieldErrors = Partial<Record<Field, string>>;

const FIELD_ORDER: Field[] = ["fullName", "email", "phone", "password", "confirmPassword"];

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const PHONE_PATTERN = /^(0|\+84)\d{9,10}$/;

/**
 * Luật kiểm tra ở đây phải khớp với `registerSchema` của API
 * (apps/api/src/routes/auth.routes.ts). API vẫn kiểm tra lại — đây chỉ để báo
 * lỗi ngay trong lúc gõ, không cần chờ một vòng gọi mạng.
 */
function validate(values: Record<Field, string>): FieldErrors {
  const found: FieldErrors = {};

  if (values.fullName.trim().length < 2) found.fullName = "Họ tên tối thiểu 2 ký tự";

  if (!values.email.trim()) found.email = "Vui lòng nhập email";
  else if (!EMAIL_PATTERN.test(values.email.trim())) found.email = "Email không hợp lệ";

  const phone = values.phone.replace(/[\s.-]/g, "");
  if (phone && !PHONE_PATTERN.test(phone)) found.phone = "Số điện thoại không hợp lệ";

  const { password } = values;
  if (password.length < 8) found.password = "Mật khẩu tối thiểu 8 ký tự";
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    found.password = "Mật khẩu phải gồm cả chữ và số";
  } else if (new TextEncoder().encode(password).length > 72) {
    found.password = "Mật khẩu quá dài (tối đa 72 byte)";
  }

  if (!values.confirmPassword) found.confirmPassword = "Vui lòng nhập lại mật khẩu";
  else if (values.confirmPassword !== password) found.confirmPassword = "Mật khẩu nhập lại không khớp";

  return found;
}

interface RegisterFormProps {
  /** Đường dẫn nội bộ đã được chuẩn hoá để quay lại sau khi đăng ký */
  next: string;
  /** Lỗi từ lần đăng nhập Google / Facebook vừa thất bại (đọc từ `?error=` trên URL) */
  oauthError?: string | null;
}

export default function RegisterForm({ next, oauthError = null }: RegisterFormProps) {
  const router = useRouter();
  const { status, register } = useAuth();
  const toast = useToast();

  const [values, setValues] = useState<Record<Field, string>>({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, next, router]);

  function bind(field: Field) {
    return {
      name: field,
      value: values[field],
      error: errors[field],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        setValues((current) => ({ ...current, [field]: event.target.value })),
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const found = validate(values);
    setErrors(found);
    setFormError(null);

    const firstInvalid = FIELD_ORDER.find((field) => found[field]);
    if (firstInvalid) {
      focusField(form, firstInvalid);
      return;
    }

    setSubmitting(true);
    try {
      const phone = values.phone.replace(/[\s.-]/g, "");
      const user = await register({
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        password: values.password,
        ...(phone ? { phone } : {}),
      });
      toast.success(`Tạo tài khoản thành công. Chào mừng ${getGivenName(user.fullName)}!`);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        // API kiểm tra lại dữ liệu: lỗi nào thuộc ô nào thì hiện ngay dưới ô đó
        const mapped: FieldErrors = {
          fullName: error.fieldErrors.fullName,
          email: error.fieldErrors.email,
          phone: error.fieldErrors.phone,
          password: error.fieldErrors.password,
        };
        setErrors(mapped);
        focusField(form, FIELD_ORDER.find((field) => mapped[field]) ?? "fullName");
      } else if (error instanceof ApiError && error.status === 409) {
        // Email đã có người đăng ký
        setErrors({ email: error.message });
        focusField(form, "email");
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
        {...bind("fullName")}
        label="Họ và tên"
        required
        autoComplete="name"
        placeholder="Nguyễn Văn A"
        icon={<UserRound className="size-4.5" />}
      />

      <TextField
        {...bind("email")}
        label="Email"
        required
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="name@example.com"
        icon={<Mail className="size-4.5" />}
      />

      <TextField
        {...bind("phone")}
        label="Số điện thoại"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="0912 345 678"
        icon={<Phone className="size-4.5" />}
        optional
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PasswordField
          {...bind("password")}
          label="Mật khẩu"
          required
          autoComplete="new-password"
          placeholder="Tối thiểu 8 ký tự"
          hint="Gồm cả chữ và số"
          icon={<Lock className="size-4.5" />}
        />
        <PasswordField
          {...bind("confirmPassword")}
          label="Nhập lại mật khẩu"
          required
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
          icon={<Lock className="size-4.5" />}
        />
      </div>

      {formError ? <FormError message={formError} /> : null}

      <button
        type="submit"
        disabled={submitting}
        className="group flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-brand-500 to-brand-700 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-brand-500/25 transition hover:from-brand-600 hover:to-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? <LoaderCircle className="size-4.5 animate-spin" /> : null}
        {submitting ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
        {submitting ? null : (
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        )}
      </button>
    </form>
  );
}
