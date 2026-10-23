"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, Eye, EyeOff, KeyRound, LoaderCircle, Lock, LockOpen, Pencil, Trash2, X } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { adminApiFetch, ApiError, errorMessage } from "@/lib/admin-api-client";
import { cn } from "@/lib/utils";
import type { AdminCustomerDetail, AdminCustomerPasswordReset, AdminCustomerSummary } from "@/types";

/*
 * Bốn hộp thoại của trang Quản lý khách hàng (giao diện tối): Sửa thông tin, Khoá/Mở khoá, Cấp lại mật khẩu, Xoá.
 * Màu: nền ink (cùng thanh menu), nút có chữ dùng brand-500 (#c2410c, chữ trắng 5,2:1); cam nhấn ember-500 (#d94e15)
 * chỉ cho viền, vòng focus, biểu tượng — chữ trắng trên ember chỉ 4,2:1, chưa đạt WCAG AA.
 */

export const darkInputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-ember-500 focus:ring-2 focus:ring-ember-500/40 disabled:opacity-60";

const primaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 disabled:cursor-not-allowed disabled:opacity-50";
const dangerButton =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-sale-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-sale-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 disabled:cursor-not-allowed disabled:opacity-50";
const ghostButton =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-white/15 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 disabled:cursor-not-allowed disabled:opacity-50";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Khung hộp thoại dùng chung: role="dialog", Esc để đóng, giữ phím Tab trong hộp, trả focus về nút đã mở khi đóng */
function Dialog({
  title,
  description,
  icon,
  tone = "accent",
  busy = false,
  onClose,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  icon: React.ReactNode;
  tone?: "accent" | "danger";
  busy?: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  footer: React.ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("input, textarea, select") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const [head, tail] = [items[0], items[items.length - 1]];
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus?.();
    };
    // Chỉ chạy lúc mở/đóng hộp thoại
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="max-h-[calc(100vh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-ink-900 text-slate-100 shadow-2xl ring-1 ring-white/10"
      >
        <div className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset",
              tone === "danger" ? "bg-red-500/15 text-red-300 ring-red-400/30" : "bg-ember-500/15 text-brand-300 ring-ember-500/40",
            )}
          >
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-lg font-bold text-white">
              {title}
            </h2>
            {description ? (
              <div id={descriptionId} className="mt-0.5 text-sm text-slate-300">
                {description}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng hộp thoại"
            className="grid size-8 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500"
          >
            <X className="size-4.5" />
          </button>
        </div>
        {children ? <div className="space-y-4 px-5 py-4">{children}</div> : null}
        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-4">{footer}</div>
      </div>
    </div>
  );
}

function Field({ id, label, required, error, hint, children }: { id: string; label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-300">
        {label}
        {required ? <span className="text-brand-300"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-300">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200 ring-1 ring-inset ring-red-400/30">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/*  1. Sửa thông tin                                                          */
/* -------------------------------------------------------------------------- */

type EditForm = { fullName: string; email: string; phone: string; province: string; district: string; ward: string; streetAddress: string };
const ADDRESS_KEYS = ["province", "district", "ward", "streetAddress"] as const;

export function EditCustomerDialog({ customer, onClose, onSaved }: { customer: AdminCustomerSummary; onClose: () => void; onSaved: (updated: AdminCustomerDetail) => void }) {
  const toast = useToast();
  const [form, setForm] = useState<EditForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [originalEmail, setOriginalEmail] = useState(customer.email);

  useEffect(() => {
    let cancelled = false;
    adminApiFetch<AdminCustomerDetail>(`/api/admin/customers/${customer.id}`)
      .then((detail) => {
        if (cancelled) return;
        setOriginalEmail(detail.email);
        setForm({
          fullName: detail.fullName,
          email: detail.email,
          phone: detail.phone ?? "",
          province: detail.defaultAddress?.province ?? "",
          district: detail.defaultAddress?.district ?? "",
          ward: detail.defaultAddress?.ward ?? "",
          streetAddress: detail.defaultAddress?.streetAddress ?? "",
        });
      })
      .catch((error) => {
        if (!cancelled) setLoadError(errorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [customer.id]);

  function set<K extends keyof EditForm>(key: K, value: string) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    const hasAddress = ADDRESS_KEYS.some((key) => form[key].trim());
    if (hasAddress && ADDRESS_KEYS.some((key) => !form[key].trim())) {
      setFormError("Địa chỉ cần đủ tỉnh/thành, quận/huyện, phường/xã và số nhà – tên đường (hoặc để trống cả bốn ô).");
      return;
    }
    setBusy(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const updated = await adminApiFetch<AdminCustomerDetail>(`/api/admin/customers/${customer.id}`, {
        method: "PATCH",
        body: {
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          address: hasAddress
            ? { province: form.province, district: form.district, ward: form.ward, streetAddress: form.streetAddress }
            : undefined,
        },
      });
      toast.success(`Đã cập nhật thông tin ${updated.fullName}`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError) setFieldErrors(error.fieldErrors);
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const err = (key: string) => fieldErrors[key];
  const describe = (id: string, key: string) => (err(key) ? `${id}-error` : undefined);

  return (
    <Dialog
      title="Sửa thông tin khách hàng"
      description={
        <>
          {customer.code} · {customer.email}
        </>
      }
      icon={<Pencil className="size-5" />}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={ghostButton}>
            Huỷ
          </button>
          <button type="submit" form="edit-customer-form" disabled={busy || !form} className={primaryButton}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
            {busy ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </>
      }
    >
      {loadError ? <FormError message={loadError} /> : null}
      {!form && !loadError ? (
        <p className="flex items-center gap-2 text-sm text-slate-300">
          <LoaderCircle className="size-4 animate-spin" />
          Đang tải thông tin...
        </p>
      ) : null}
      {form ? (
        <form id="edit-customer-form" onSubmit={submit} noValidate className="space-y-4">
          <Field id="edit-fullName" label="Họ tên" required error={err("fullName")}>
            <input id="edit-fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} maxLength={150} aria-invalid={Boolean(err("fullName"))} aria-describedby={describe("edit-fullName", "fullName")} className={darkInputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="edit-email"
              label="Email"
              required
              error={err("email")}
              hint={form.email.trim().toLowerCase() !== originalEmail ? "Email mới cần được khách xác minh lại." : undefined}
            >
              <input id="edit-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} maxLength={254} aria-invalid={Boolean(err("email"))} aria-describedby={describe("edit-email", "email")} className={darkInputClass} />
            </Field>
            <Field id="edit-phone" label="Số điện thoại" error={err("phone")}>
              <input id="edit-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={20} placeholder="09xx xxx xxx" aria-invalid={Boolean(err("phone"))} aria-describedby={describe("edit-phone", "phone")} className={darkInputClass} />
            </Field>
          </div>
          <fieldset className="rounded-xl border border-white/10 p-3">
            <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-300">Địa chỉ mặc định</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field id="edit-province" label="Tỉnh/Thành" error={err("address.province")}>
                <input id="edit-province" value={form.province} onChange={(e) => set("province", e.target.value)} maxLength={100} className={darkInputClass} />
              </Field>
              <Field id="edit-district" label="Quận/Huyện" error={err("address.district")}>
                <input id="edit-district" value={form.district} onChange={(e) => set("district", e.target.value)} maxLength={100} className={darkInputClass} />
              </Field>
              <Field id="edit-ward" label="Phường/Xã" error={err("address.ward")}>
                <input id="edit-ward" value={form.ward} onChange={(e) => set("ward", e.target.value)} maxLength={100} className={darkInputClass} />
              </Field>
            </div>
            <div className="mt-3">
              <Field id="edit-street" label="Số nhà, tên đường" error={err("address.streetAddress")}>
                <input id="edit-street" value={form.streetAddress} onChange={(e) => set("streetAddress", e.target.value)} maxLength={300} className={darkInputClass} />
              </Field>
            </div>
          </fieldset>
          <FormError message={formError} />
        </form>
      ) : null}
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  2. Khoá / Mở khoá                                                         */
/* -------------------------------------------------------------------------- */

const QUICK_REASONS = ["Đặt nhiều đơn ảo, không nhận hàng", "Spam đánh giá sản phẩm", "Nghi bị chiếm tài khoản", "Theo yêu cầu của khách"];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function LockCustomerDialog({ customer, onClose, onDone }: { customer: AdminCustomerSummary; onClose: () => void; onDone: (updated: AdminCustomerDetail) => void }) {
  const toast = useToast();
  const locking = customer.isActive;
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const reasonOk = reason.trim().length >= 3;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (locking && !reasonOk) {
      setFormError("Vui lòng nhập lý do khoá tài khoản (tối thiểu 3 ký tự).");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const updated = await adminApiFetch<AdminCustomerDetail>(`/api/admin/customers/${customer.id}/lock`, {
        method: "PATCH",
        body: locking ? { isActive: false, reason: reason.trim() } : { isActive: true },
      });
      toast.success(locking ? `Đã khoá tài khoản ${customer.fullName} và đăng xuất khách` : `Đã mở khoá tài khoản ${customer.fullName}`);
      onDone(updated);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={locking ? "Khoá tài khoản" : "Mở khoá tài khoản"}
      description={
        <>
          {customer.fullName} · {customer.email}
        </>
      }
      icon={locking ? <Lock className="size-5" /> : <LockOpen className="size-5" />}
      tone={locking ? "danger" : "accent"}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={ghostButton}>
            Huỷ
          </button>
          <button type="submit" form="lock-customer-form" disabled={busy || (locking && !reasonOk)} className={locking ? dangerButton : primaryButton}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : locking ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
            {busy ? "Đang xử lý..." : locking ? "Khoá tài khoản" : "Mở khoá"}
          </button>
        </>
      }
    >
      <form id="lock-customer-form" onSubmit={submit} noValidate className="space-y-4">
        {locking ? (
          <>
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-100 ring-1 ring-inset ring-amber-400/30">
              Khách bị <strong>đăng xuất ngay</strong> trên mọi thiết bị và không đăng nhập được cho tới khi mở khoá. Đơn hàng đang có vẫn được xử lý bình thường.
            </p>
            <Field id="lock-reason" label="Lý do khoá" required hint="Chỉ lưu nội bộ, khách không thấy. Tối đa 300 ký tự.">
              <textarea id="lock-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} className={darkInputClass} placeholder="Ví dụ: đặt nhiều đơn COD rồi không nhận hàng" />
            </Field>
            <div className="flex flex-wrap gap-2" aria-label="Lý do thường gặp">
              {QUICK_REASONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setReason(item)}
                  className="rounded-full px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/15 transition hover:bg-white/10 hover:ring-ember-500"
                >
                  {item}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-2 text-sm text-slate-200">
            <p>Khách sẽ đăng nhập lại được ngay sau khi mở khoá.</p>
            {customer.lockReason ? (
              <p className="rounded-lg bg-white/5 px-3 py-2 ring-1 ring-inset ring-white/10">
                <span className="font-bold text-white">Lý do đã khoá:</span> {customer.lockReason}
                {customer.lockedAt ? <span className="text-slate-400"> · {formatDateTime(customer.lockedAt)}</span> : null}
              </p>
            ) : null}
          </div>
        )}
        <FormError message={formError} />
      </form>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  3. Cấp lại mật khẩu                                                       */
/* -------------------------------------------------------------------------- */

export function ResetPasswordDialog({ customer, onClose }: { customer: AdminCustomerSummary; onClose: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<"random" | "manual">("random");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ generatedPassword?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function clientCheck(): string | null {
    if (mode === "random") return null;
    if (password.length < 8) return "Mật khẩu tối thiểu 8 ký tự.";
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Mật khẩu phải gồm cả chữ và số.";
    if (password !== confirm) return "Hai lần nhập mật khẩu không khớp.";
    return null;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = clientCheck();
    if (problem) {
      setFormError(problem);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const result = await adminApiFetch<AdminCustomerPasswordReset>(`/api/admin/customers/${customer.id}/reset-password`, {
        method: "POST",
        body: mode === "manual" ? { password } : {},
      });
      setDone(result);
      setPassword("");
      setConfirm("");
      toast.success(`Đã cấp lại mật khẩu cho ${customer.fullName}`);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast.error("Trình duyệt không cho sao chép — hãy chọn và chép thủ công.");
    }
  }

  if (done) {
    return (
      <Dialog
        title="Đã cấp lại mật khẩu"
        description={
          <>
            {customer.fullName} · {customer.email}
          </>
        }
        icon={<KeyRound className="size-5" />}
        onClose={onClose}
        footer={
          <button type="button" onClick={onClose} className={primaryButton}>
            Xong
          </button>
        }
      >
        {done.generatedPassword ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-200">Mật khẩu mới (chỉ hiện một lần — hãy gửi cho khách qua kênh an toàn):</p>
            <div className="flex items-center gap-2 rounded-lg bg-ink-950 px-3 py-2 ring-1 ring-inset ring-ember-500/60">
              <code data-testid="generated-password" className="flex-1 font-mono text-lg tracking-wider text-white">
                {done.generatedPassword}
              </code>
              <button type="button" onClick={() => copy(done.generatedPassword as string)} className={ghostButton}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Đã chép" : "Sao chép"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-200">Mật khẩu bạn đặt đã được lưu.</p>
        )}
        <p className="text-sm text-slate-300">Khách đã bị đăng xuất khỏi mọi thiết bị và phải đăng nhập lại bằng mật khẩu mới.</p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title="Cấp lại mật khẩu"
      description={
        <>
          {customer.fullName} · {customer.email}
        </>
      }
      icon={<KeyRound className="size-5" />}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={ghostButton}>
            Huỷ
          </button>
          <button type="submit" form="reset-password-form" disabled={busy} className={primaryButton}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            {busy ? "Đang cấp..." : mode === "random" ? "Tạo mật khẩu mới" : "Đặt mật khẩu"}
          </button>
        </>
      }
    >
      <form id="reset-password-form" onSubmit={submit} noValidate className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-300">Cách cấp mật khẩu</legend>
          {(
            [
              ["random", "Tạo mật khẩu ngẫu nhiên", "Hệ thống sinh 12 ký tự gồm chữ và số, hiện một lần để bạn gửi cho khách."],
              ["manual", "Tự đặt mật khẩu", "Tối thiểu 8 ký tự, gồm cả chữ và số."],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset transition",
                mode === value ? "bg-ember-500/10 ring-ember-500" : "ring-white/10 hover:bg-white/5",
              )}
            >
              <input type="radio" name="reset-mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1 accent-[#d94e15]" />
              <span>
                <span className="block text-sm font-bold text-white">{label}</span>
                <span className="block text-xs text-slate-300">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {mode === "manual" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="reset-password" label="Mật khẩu mới" required>
              <div className="relative">
                <input id="reset-password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" maxLength={72} className={cn(darkInputClass, "pr-10")} />
                <button
                  type="button"
                  onClick={() => setShow((value) => !value)}
                  aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-300 hover:text-white"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            <Field id="reset-confirm" label="Nhập lại mật khẩu" required>
              <input id="reset-confirm" type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" maxLength={72} className={darkInputClass} />
            </Field>
          </div>
        ) : null}
        <p className="text-xs text-slate-300">Khách sẽ bị đăng xuất khỏi mọi thiết bị; link đặt lại mật khẩu còn hạn (nếu có) bị huỷ.</p>
        <FormError message={formError} />
      </form>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  4. Xoá tài khoản                                                          */
/* -------------------------------------------------------------------------- */

export function DeleteCustomerDialog({ customer, onClose, onDeleted }: { customer: AdminCustomerSummary; onClose: () => void; onDeleted: () => void }) {
  const toast = useToast();
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!understood) return;
    setBusy(true);
    setFormError(null);
    try {
      await adminApiFetch<void>(`/api/admin/customers/${customer.id}`, { method: "DELETE" });
      toast.success(`Đã xoá tài khoản ${customer.fullName}`);
      onDeleted();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="Xoá tài khoản khách hàng?"
      description={
        <>
          {customer.code} · {customer.fullName} · {customer.email}
        </>
      }
      icon={<Trash2 className="size-5" />}
      tone="danger"
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={ghostButton}>
            Huỷ
          </button>
          <button type="submit" form="delete-customer-form" disabled={busy || !understood} className={dangerButton}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {busy ? "Đang xoá..." : "Xoá vĩnh viễn"}
          </button>
        </>
      }
    >
      <form id="delete-customer-form" onSubmit={submit} className="space-y-3 text-sm text-slate-200">
        <p className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-red-100 ring-1 ring-inset ring-red-400/30">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Thao tác này không thể hoàn tác.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-slate-300">
          <li>Xoá tài khoản, sổ địa chỉ, giỏ hàng, danh sách yêu thích, đánh giá sản phẩm và các phiên đăng nhập.</li>
          <li>
            {customer.orderCount > 0
              ? `${customer.orderCount} đơn hàng của khách vẫn được giữ lại để đối soát (không còn gắn với tài khoản).`
              : "Khách chưa có đơn hàng nào."}
          </li>
          <li>Không xoá được khi khách còn đơn đang xử lý (chờ xác nhận → đang giao).</li>
        </ul>
        <label className="flex cursor-pointer items-center gap-2 font-semibold text-white">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="size-4 accent-[#dc2626]" />
          Tôi hiểu và muốn xoá tài khoản này
        </label>
        <FormError message={formError} />
      </form>
    </Dialog>
  );
}
