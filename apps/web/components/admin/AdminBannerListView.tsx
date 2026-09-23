"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CloudOff, ImageOff, LoaderCircle, Plus, ShieldAlert } from "lucide-react";
import AdminBadge from "@/components/admin/AdminBadge";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { adminApiFetch } from "@/lib/admin-api-client";
import type { AdminBanner } from "@/types";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; items: AdminBanner[] };

/** "22/09/2026" */
function formatDate(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
}

/** Danh sách banner trang chủ — không phân trang, số banner luôn nhỏ — trang `/admin/banners` */
export default function AdminBannerListView() {
  const { user } = useAdminAuth();
  const [state, setState] = useState<State>({ status: "loading" });

  const allowedRead = user ? user.permissions.includes("content:read") : null;
  const canWrite = user ? user.permissions.includes("content:write") : false;

  useEffect(() => {
    if (!allowedRead) return;
    let cancelled = false;

    adminApiFetch<{ items: AdminBanner[] }>("/api/admin/banners")
      .then((data) => {
        if (!cancelled) setState({ status: "ready", items: data.items });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [allowedRead]);

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

  return (
    <div className="space-y-4">
      {canWrite ? (
        <div className="flex justify-end">
          <Link
            href="/admin/banners/new"
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600"
          >
            <Plus className="size-4" />
            Thêm banner
          </Link>
        </div>
      ) : null}

      {state.status === "loading" ? (
        <div className="admin-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
          <LoaderCircle className="size-4.5 animate-spin" />
          Đang tải...
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
          <CloudOff className="size-8 text-slate-400" />
          <p className="mt-3 text-sm text-slate-500">Không tải được danh sách banner. Vui lòng tải lại trang.</p>
        </div>
      ) : null}

      {state.status === "ready" && state.items.length === 0 ? (
        <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-slate-100 text-slate-400">
            <ImageOff className="size-8" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-800">Chưa có banner nào</h2>
        </div>
      ) : null}

      {state.status === "ready" && state.items.length > 0 ? (
        <div className="admin-card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-semibold">Banner</th>
                <th className="px-4 py-3 font-semibold">Thứ tự</th>
                <th className="px-4 py-3 font-semibold">Lịch hiển thị</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.items.map((banner) => (
                <tr key={banner.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/banners/${banner.id}`} className="flex items-center gap-3">
                      <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        <Image src={banner.imageUrl} alt={banner.title ?? "Banner"} fill sizes="80px" className="object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-1 font-bold text-slate-800 hover:text-brand-600">{banner.title || "(Không có tiêu đề)"}</p>
                        {banner.subtitle ? <p className="line-clamp-1 text-xs text-slate-500">{banner.subtitle}</p> : null}
                      </div>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{banner.displayOrder}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                    {banner.startsAt || banner.endsAt ? `${formatDate(banner.startsAt)} – ${formatDate(banner.endsAt)}` : "Không giới hạn"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <AdminBadge tone={banner.status === "PUBLISHED" ? "green" : "slate"}>
                      {banner.status === "PUBLISHED" ? "Đã đăng" : "Nháp"}
                    </AdminBadge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <Link href={`/admin/banners/${banner.id}`} className="text-xs font-bold text-brand-600 hover:underline">
                      {canWrite ? "Sửa" : "Xem"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
