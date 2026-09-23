"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Lock, ShieldCheck } from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { errorMessage } from "@/lib/admin-api-client";

/**
 * Trang đăng nhập quản trị RIÊNG — không dùng chung LoginForm/AuthFrame của khách hàng. Hai bước:
 * mật khẩu, rồi (chỉ khi tài khoản đã bật 2FA) mã 6 số.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const { status, login, verifyLogin2fa } = useAdminAuth();

  const [step, setStep] = useState<"password" | "2fa">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") router.replace("/admin");
  }, [status, router]);

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await login({ email: email.trim().toLowerCase(), password });
      if (result.status === "2fa-required") {
        setPendingToken(result.pendingToken);
        setStep("2fa");
      }
      // status "ok": AdminAuthProvider đã cập nhật status="authenticated", effect ở trên tự điều hướng
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handle2faSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyLogin2fa(pendingToken, code);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
            {step === "password" ? <Lock className="size-6" /> : <ShieldCheck className="size-6" />}
          </span>
          <h1 className="mt-3 text-lg font-bold text-slate-900">
            {step === "password" ? "Đăng nhập quản trị" : "Xác thực 2 bước"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {step === "password" ? "Dành cho nhân viên/quản trị viên PCZone" : "Nhập mã 6 số trong app xác thực của bạn"}
          </p>
        </div>

        {step === "password" ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="admin-email" className="mb-1 block text-xs font-semibold text-slate-600">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="mb-1 block text-xs font-semibold text-slate-600">
                Mật khẩu
              </label>
              <input
                id="admin-password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
                autoComplete="current-password"
              />
            </div>

            {error ? <p className="text-xs font-medium text-sale-600">{error}</p> : null}

            <button
              type="submit"
              disabled={busy}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {busy ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
        ) : (
          <form onSubmit={handle2faSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="admin-2fa-code" className="mb-1 block text-xs font-semibold text-slate-600">
                Mã xác thực
              </label>
              <input
                id="admin-2fa-code"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-lg font-bold tracking-[0.3em] text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
                autoComplete="one-time-code"
              />
            </div>

            {error ? <p className="text-xs font-medium text-sale-600">{error}</p> : null}

            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {busy ? "Đang xác thực..." : "Xác nhận"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("password");
                setCode("");
                setError(null);
              }}
              className="w-full text-center text-xs font-semibold text-slate-500 hover:underline"
            >
              Quay lại
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
