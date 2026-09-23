"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, CloudOff, Lock, LoaderCircle, ShieldAlert, ShieldOff, Unlock } from "lucide-react";
import AdminBadge from "@/components/admin/AdminBadge";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ApiError, adminApiFetch, errorMessage } from "@/lib/admin-api-client";
import { ROLE_LABEL } from "@/lib/data/admin-roles";
import type { AdminAccount, AdminAccountInput, AdminAssignableRole } from "@/types";

type LoadState = { status: "loading" } | { status: "not_found" } | { status: "error" } | { status: "ready"; account: AdminAccount | null };

const ASSIGNABLE_ROLES = ["OWNER", "MANAGER", "ORDER_STAFF", "PRODUCT_STAFF"] as const;

interface FormState {
  email: string;
  fullName: string;
  /** "" chỉ xảy ra khi tài khoản đang ở vai trò CŨ (ADMIN/STAFF) — không tự đoán vai trò mới thay người dùng */
  role: AdminAssignableRole | "";
  password: string;
}

const ROLE_OPTIONS: AdminAssignableRole[] = [...ASSIGNABLE_ROLES];

function emptyForm(): FormState {
  return { email: "", fullName: "", role: "PRODUCT_STAFF", password: "" };
}

function isLegacyRole(role: AdminAccount["role"]): boolean {
  return !(ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

function formFromAccount(account: AdminAccount): FormState {
  return {
    email: account.email,
    fullName: account.fullName,
    role: isLegacyRole(account.role) ? "" : (account.role as AdminAssignableRole),
    password: "",
  };
}

/** Khoá/mở khoá — ẩn hẳn nếu đang sửa CHÍNH TÀI KHOẢN ĐANG ĐĂNG NHẬP (server cũng chặn, đây chỉ là UX) */
function LockControl({ account, onUpdated }: { account: AdminAccount; onUpdated: (account: AdminAccount) => void }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const updated = await adminApiFetch<AdminAccount>(`/api/admin/accounts/${account.id}/lock`, {
        method: "PATCH",
        body: { isActive: !account.isActive },
      });
      onUpdated(updated);
      toast.success(updated.isActive ? "Đã mở khoá tài khoản" : "Đã khoá tài khoản");
      setConfirming(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500">{account.isActive ? "Khoá tài khoản này?" : "Mở khoá tài khoản này?"}</span>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white transition disabled:opacity-60 ${
            account.isActive ? "bg-sale-600 hover:bg-sale-700" : "bg-brand-500 hover:bg-brand-600"
          }`}
        >
          {busy ? "Đang xử lý..." : "Xác nhận"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="text-xs font-semibold text-slate-500 hover:underline">
          Không
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition ${
        account.isActive
          ? "border-sale-200 text-sale-600 hover:border-sale-300 hover:bg-sale-500/5"
          : "border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-500/5"
      }`}
    >
      {account.isActive ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
      {account.isActive ? "Khoá tài khoản" : "Mở khoá tài khoản"}
    </button>
  );
}

function ForceDisable2faControl({ account, onUpdated }: { account: AdminAccount; onUpdated: (account: AdminAccount) => void }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!account.totpEnabled) return null;

  async function submit() {
    setBusy(true);
    try {
      const updated = await adminApiFetch<AdminAccount>(`/api/admin/accounts/${account.id}/disable-2fa`, { method: "POST", body: {} });
      onUpdated(updated);
      toast.success("Đã tắt 2FA của tài khoản này");
      setConfirming(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Tắt 2FA hộ? Chỉ dùng khi họ mất thiết bị xác thực.</span>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-sale-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-sale-700 disabled:opacity-60"
        >
          {busy ? "Đang xử lý..." : "Xác nhận"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="text-xs font-semibold text-slate-500 hover:underline">
          Không
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:border-brand-300 hover:bg-brand-500/5"
    >
      <ShieldOff className="size-3.5" />
      Tắt 2FA hộ
    </button>
  );
}

/** Form thêm mới (accountId rỗng) / sửa tài khoản quản trị — `/admin/accounts/new` và `/admin/accounts/[id]` */
export default function AdminAccountFormView({ accountId }: { accountId?: string }) {
  const { user } = useAdminAuth();
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<LoadState>(() => (accountId ? { status: "loading" } : { status: "ready", account: null }));
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const allowed = user ? user.permissions.includes("admins:manage") : null;

  useEffect(() => {
    if (!allowed || !accountId) return;
    let cancelled = false;

    adminApiFetch<AdminAccount>(`/api/admin/accounts/${accountId}`)
      .then((account) => {
        if (cancelled) return;
        setState({ status: "ready", account });
        setForm(formFromAccount(account));
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ status: error instanceof ApiError && error.status === 404 ? "not_found" : "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [allowed, accountId]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const isSelf = accountId === user?.id;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const body: AdminAccountInput = {
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        // "" nghĩa là tài khoản CŨ (ADMIN/STAFF) chưa chọn vai trò mới — gửi undefined để server giữ nguyên,
        // không ép chọn vai trò mới chỉ để lưu tên/mật khẩu/khoá tài khoản
        role: form.role || undefined,
        password: form.password.trim() || undefined,
      };

      if (accountId) {
        const updated = await adminApiFetch<AdminAccount>(`/api/admin/accounts/${accountId}`, { method: "PATCH", body });
        setState({ status: "ready", account: updated });
        setForm(formFromAccount(updated));
        toast.success("Đã lưu thay đổi");
      } else {
        const created = await adminApiFetch<AdminAccount>("/api/admin/accounts", { method: "POST", body });
        toast.success("Đã tạo tài khoản quản trị");
        router.replace(`/admin/accounts/${created.id}`);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!user || allowed === null) {
    return (
      <div className="admin-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải...
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-sale-500/10 text-sale-600">
          <ShieldAlert className="size-8" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">Trang này chỉ dành cho chủ website.</p>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="admin-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải...
      </div>
    );
  }

  if (state.status === "not_found") {
    return (
      <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
        <h2 className="text-lg font-bold text-slate-800">Không tìm thấy tài khoản này</h2>
        <Link href="/admin/accounts" className="mt-3 text-sm font-bold text-brand-600 hover:underline">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
        <CloudOff className="size-8 text-slate-400" />
        <p className="mt-3 text-sm text-slate-500">Không tải được tài khoản. Vui lòng tải lại trang.</p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-500";

  return (
    <div className="space-y-4">
      <Link href="/admin/accounts" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-600">
        <ChevronLeft className="size-4" />
        Quay lại danh sách tài khoản quản trị
      </Link>

      <form onSubmit={submit} className="admin-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-slate-900">{accountId ? "Sửa tài khoản quản trị" : "Thêm tài khoản quản trị"}</h1>
          {state.account ? (state.account.isActive ? <AdminBadge tone="green">Đang hoạt động</AdminBadge> : <AdminBadge tone="red">Đã khoá</AdminBadge>) : null}
        </div>

        {isSelf ? <p className="text-xs text-slate-400">Đây là tài khoản bạn đang đăng nhập — không tự đổi vai trò hay tự khoá được.</p> : null}
        {state.account && isLegacyRole(state.account.role) ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            Tài khoản này đang ở vai trò cũ ({ROLE_LABEL[state.account.role]}) — chọn một vai trò ở dưới rồi lưu để chuyển sang hệ thống phân quyền hiện tại.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Email đăng nhập</label>
            <input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} required maxLength={255} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Họ tên</label>
            <input value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} required maxLength={150} className={inputClass} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Vai trò</label>
            <select
              value={form.role}
              onChange={(event) => updateField("role", event.target.value as AdminAssignableRole)}
              disabled={isSelf}
              required={!accountId}
              className={inputClass}
            >
              {!form.role ? (
                <option value="" disabled>
                  — Chọn vai trò —
                </option>
              ) : null}
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">{accountId ? "Đặt lại mật khẩu (để trống = giữ nguyên)" : "Mật khẩu"}</label>
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              required={!accountId}
              minLength={8}
              placeholder={accountId ? "Ít nhất 8 ký tự" : ""}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
          {state.account && !isSelf ? (
            <div className="flex flex-wrap items-center gap-2">
              <ForceDisable2faControl account={state.account} onUpdated={(updated) => setState({ status: "ready", account: updated })} />
              <LockControl account={state.account} onUpdated={(updated) => setState({ status: "ready", account: updated })} />
            </div>
          ) : null}
        </div>
      </form>
    </div>
  );
}
