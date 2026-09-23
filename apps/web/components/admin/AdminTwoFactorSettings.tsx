"use client";

import { useState } from "react";
import { Check, LoaderCircle, ShieldCheck, ShieldOff } from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { adminApiFetch, errorMessage } from "@/lib/admin-api-client";
import type { TotpSetupResult } from "@/types";

type Stage = "idle" | "setting-up" | "confirming";

/** Bật/tắt xác thực 2 bước (TOTP) cho tài khoản quản trị đang đăng nhập — trang /admin/2fa */
export default function AdminTwoFactorSettings() {
  const { user, refresh } = useAdminAuth();
  const toast = useToast();
  const [stage, setStage] = useState<Stage>("idle");
  const [setup, setSetup] = useState<TotpSetupResult | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startSetup() {
    setBusy(true);
    setError(null);
    try {
      const result = await adminApiFetch<TotpSetupResult>("/api/admin/auth/2fa/setup", { method: "POST", body: {} });
      setSetup(result);
      setStage("confirming");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApiFetch("/api/admin/auth/2fa/confirm", { method: "POST", body: { code } });
      toast.success("Đã bật xác thực 2 bước");
      setStage("idle");
      setSetup(null);
      setCode("");
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await adminApiFetch("/api/admin/auth/2fa/disable", { method: "POST", body: {} });
      toast.success("Đã tắt xác thực 2 bước");
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <div className="admin-card max-w-lg p-5">
      <div className="flex items-center gap-3">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-xl ${
            user.totpEnabled ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
          }`}
        >
          {user.totpEnabled ? <ShieldCheck className="size-5.5" /> : <ShieldOff className="size-5.5" />}
        </span>
        <div>
          <p className="font-bold text-slate-800">Xác thực 2 bước (TOTP)</p>
          <p className="text-sm text-slate-500">
            {user.totpEnabled ? "Đang bật — cần thêm mã từ app xác thực mỗi lần đăng nhập." : "Đang tắt."}
          </p>
        </div>
      </div>

      {stage === "idle" && !user.totpEnabled ? (
        <button
          type="button"
          onClick={startSetup}
          disabled={busy}
          className="mt-4 flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Bật xác thực 2 bước
        </button>
      ) : null}

      {stage === "idle" && user.totpEnabled ? (
        <button
          type="button"
          onClick={disable}
          disabled={busy}
          className="mt-4 rounded-xl border border-sale-200 px-5 py-2.5 text-sm font-bold text-sale-600 transition hover:bg-sale-500/5 disabled:opacity-60"
        >
          {busy ? "Đang tắt..." : "Tắt xác thực 2 bước"}
        </button>
      ) : null}

      {stage === "confirming" && setup ? (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-600">
            Mở app xác thực (Google Authenticator, Authy...), quét mã QR bên dưới hoặc nhập mã thủ công, rồi nhập mã 6 số
            hiện ra để xác nhận.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh QR base64 dựng động, không phải ảnh tĩnh trong repo */}
          <img src={setup.qrCodeDataUrl} alt="Mã QR thiết lập 2FA" width={200} height={200} className="rounded-lg border border-slate-200" />
          <p className="rounded-lg bg-slate-50 p-2.5 text-center font-mono text-xs tracking-wider text-slate-600">{setup.secret}</p>

          <form onSubmit={confirmSetup} className="space-y-2.5">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Mã 6 số"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-lg font-bold tracking-[0.3em] outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            />
            {error ? <p className="text-xs font-medium text-sale-600">{error}</p> : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                Xác nhận
              </button>
              <button
                type="button"
                onClick={() => {
                  setStage("idle");
                  setSetup(null);
                  setCode("");
                }}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:underline"
              >
                Huỷ
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
