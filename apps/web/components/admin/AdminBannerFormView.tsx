"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, CloudOff, ImageOff, LoaderCircle, ShieldAlert, Trash2, Upload } from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ApiError, adminApiFetch, errorMessage, uploadAdminImage } from "@/lib/admin-api-client";
import { toDateInput } from "@/lib/format";
import type { AdminBanner, AdminBannerInput, BannerStatus } from "@/types";

type LoadState = { status: "loading" } | { status: "not_found" } | { status: "error" } | { status: "ready"; banner: AdminBanner | null };

interface FormState {
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  displayOrder: string;
  status: BannerStatus;
  startsAt: string;
  endsAt: string;
}

function emptyForm(): FormState {
  return { title: "", subtitle: "", imageUrl: "", linkUrl: "", displayOrder: "0", status: "DRAFT", startsAt: "", endsAt: "" };
}

function formFromBanner(banner: AdminBanner): FormState {
  return {
    title: banner.title ?? "",
    subtitle: banner.subtitle ?? "",
    imageUrl: banner.imageUrl,
    linkUrl: banner.linkUrl ?? "",
    displayOrder: String(banner.displayOrder),
    status: banner.status,
    startsAt: banner.startsAt ? toDateInput(banner.startsAt) : "",
    endsAt: banner.endsAt ? toDateInput(banner.endsAt) : "",
  };
}

function DeleteControl({ bannerId, onDeleted }: { bannerId: string; onDeleted: () => void }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await adminApiFetch(`/api/admin/banners/${bannerId}`, { method: "DELETE" });
      toast.success("Đã xoá banner");
      onDeleted();
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Xoá hẳn banner này?</span>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-sale-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-sale-700 disabled:opacity-60"
        >
          {busy ? "Đang xoá..." : "Xoá"}
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
      className="flex items-center gap-1.5 rounded-lg border border-sale-200 px-3.5 py-2 text-xs font-bold text-sale-600 transition hover:border-sale-300 hover:bg-sale-500/5"
    >
      <Trash2 className="size-3.5" />
      Xoá banner
    </button>
  );
}

/** Form thêm mới (bannerId rỗng) / sửa banner — `/admin/banners/new` và `/admin/banners/[id]` */
export default function AdminBannerFormView({ bannerId }: { bannerId?: string }) {
  const { user } = useAdminAuth();
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<LoadState>(() => (bannerId ? { status: "loading" } : { status: "ready", banner: null }));
  const [form, setForm] = useState<FormState>(emptyForm());
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const allowedRead = user ? user.permissions.includes("content:read") : null;
  const canWrite = user ? user.permissions.includes("content:write") : false;

  useEffect(() => {
    if (!allowedRead || !bannerId) return;
    let cancelled = false;

    adminApiFetch<AdminBanner>(`/api/admin/banners/${bannerId}`)
      .then((banner) => {
        if (cancelled) return;
        setState({ status: "ready", banner });
        setForm(formFromBanner(banner));
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ status: error instanceof ApiError && error.status === 404 ? "not_found" : "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [allowedRead, bannerId]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadAdminImage("/api/admin/banners/upload-image", file);
      updateField("imageUrl", url);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.imageUrl) {
      toast.error("Cần tải ảnh banner lên trước khi lưu");
      return;
    }
    setSaving(true);
    try {
      const body: AdminBannerInput = {
        title: form.title.trim() || undefined,
        subtitle: form.subtitle.trim() || undefined,
        imageUrl: form.imageUrl,
        linkUrl: form.linkUrl.trim() || undefined,
        displayOrder: Number(form.displayOrder) || 0,
        status: form.status,
        startsAt: form.startsAt ? `${form.startsAt}T00:00:00` : undefined,
        endsAt: form.endsAt ? `${form.endsAt}T23:59:59` : undefined,
      };

      if (bannerId) {
        const updated = await adminApiFetch<AdminBanner>(`/api/admin/banners/${bannerId}`, { method: "PATCH", body });
        setState({ status: "ready", banner: updated });
        setForm(formFromBanner(updated));
        toast.success("Đã lưu thay đổi");
      } else {
        await adminApiFetch<AdminBanner>("/api/admin/banners", { method: "POST", body });
        toast.success("Đã tạo banner");
        router.replace("/admin/banners");
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!user || allowedRead === null) {
    return (
      <div className="admin-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải...
      </div>
    );
  }

  if (!allowedRead) {
    return (
      <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-sale-500/10 text-sale-600">
          <ShieldAlert className="size-8" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">Trang này chỉ dành cho chủ website/quản lý.</p>
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
        <h2 className="text-lg font-bold text-slate-800">Không tìm thấy banner này</h2>
        <Link href="/admin/banners" className="mt-3 text-sm font-bold text-brand-600 hover:underline">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
        <CloudOff className="size-8 text-slate-400" />
        <p className="mt-3 text-sm text-slate-500">Không tải được banner. Vui lòng tải lại trang.</p>
      </div>
    );
  }

  const readOnly = !canWrite;
  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-500";

  return (
    <div className="space-y-4">
      <Link href="/admin/banners" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-600">
        <ChevronLeft className="size-4" />
        Quay lại danh sách banner
      </Link>

      <form onSubmit={submit} className="admin-card space-y-4 p-4 sm:p-5">
        <h1 className="text-lg font-bold text-slate-900">{bannerId ? "Sửa banner" : "Thêm banner"}</h1>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Ảnh banner</label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex h-24 w-44 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
              {form.imageUrl ? (
                <Image src={form.imageUrl} alt="Xem trước banner" fill sizes="176px" className="object-cover" />
              ) : (
                <ImageOff className="size-6 text-slate-400" />
              )}
              {uploading ? (
                <div className="absolute inset-0 grid place-items-center bg-white/70">
                  <LoaderCircle className="size-5 animate-spin text-brand-500" />
                </div>
              ) : null}
            </div>
            {!readOnly ? (
              <div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:border-brand-300 hover:bg-brand-500/5 disabled:opacity-50"
                >
                  <Upload className="size-3.5" />
                  {form.imageUrl ? "Đổi ảnh" : "Tải ảnh lên"}
                </button>
                <p className="mt-1 text-xs text-slate-400">JPEG/PNG/WEBP/GIF, tối đa 5MB</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Tiêu đề (không bắt buộc)</label>
            <input value={form.title} onChange={(event) => updateField("title", event.target.value)} disabled={readOnly} maxLength={200} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Phụ đề (không bắt buộc)</label>
            <input value={form.subtitle} onChange={(event) => updateField("subtitle", event.target.value)} disabled={readOnly} maxLength={300} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Liên kết khi bấm vào (không bắt buộc)</label>
          <input
            value={form.linkUrl}
            onChange={(event) => updateField("linkUrl", event.target.value)}
            disabled={readOnly}
            placeholder="/danh-muc/laptop hoặc https://..."
            maxLength={500}
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Thứ tự hiển thị (số nhỏ hơn hiện trước)</label>
            <input type="number" value={form.displayOrder} onChange={(event) => updateField("displayOrder", event.target.value)} disabled={readOnly} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Trạng thái</label>
            <select value={form.status} onChange={(event) => updateField("status", event.target.value as BannerStatus)} disabled={readOnly} className={inputClass}>
              <option value="DRAFT">Nháp (chưa hiện)</option>
              <option value="PUBLISHED">Đã đăng</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Bắt đầu hiện (để trống = hiện ngay)</label>
            <input type="date" value={form.startsAt} onChange={(event) => updateField("startsAt", event.target.value)} disabled={readOnly} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Ngừng hiện (để trống = không giới hạn)</label>
            <input type="date" value={form.endsAt} onChange={(event) => updateField("endsAt", event.target.value)} disabled={readOnly} className={inputClass} />
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Banner chỉ hiện thật trên trang chủ khi vừa ở trạng thái &quot;Đã đăng&quot;, vừa trong khoảng ngày ở trên (nếu có đặt).
        </p>

        {canWrite ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
            {state.banner ? <DeleteControl bannerId={state.banner.id} onDeleted={() => router.replace("/admin/banners")} /> : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}
