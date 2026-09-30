"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CloudOff, Copy, LoaderCircle, Sparkles, Trash2, Wrench } from "lucide-react";
import { useRequireAuth } from "@/components/auth/useRequireAuth";
import { useToast } from "@/components/providers/ToastProvider";
import { errorMessage } from "@/lib/api-client";
import { formatPrice } from "@/lib/format";
import { savedBuildUrl } from "@/lib/pc-build";
import { deleteBuild, listMyBuilds } from "@/lib/pc-build-client";
import type { SavedBuildSummary } from "@/types";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; items: SavedBuildSummary[] };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "numeric", month: "short", year: "numeric" });
}

/** Trang `/tai-khoan/cau-hinh`: cấu hình tự lưu và gợi ý AI của tài khoản, mới nhất trước */
export default function MyBuildsView() {
  const user = useRequireAuth("/tai-khoan/cau-hinh");
  const userId = user?.id;
  const [state, setState] = useState<State>({ status: "loading" });
  const [deleting, setDeleting] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listMyBuilds()
      .then((items) => {
        if (!cancelled) setState({ status: "ready", items });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(savedBuildUrl(code));
      toast.success("Đã sao chép link cấu hình");
    } catch {
      toast.error("Trình duyệt không cho sao chép tự động — hãy mở cấu hình rồi sao chép địa chỉ trên thanh trình duyệt.");
    }
  }

  async function remove(build: SavedBuildSummary) {
    if (!window.confirm(`Xoá cấu hình "${build.name}"? Link đã chia sẻ sẽ không mở được nữa.`)) return;
    setDeleting(build.code);
    try {
      await deleteBuild(build.code);
      setState((current) => (current.status === "ready" ? { status: "ready", items: current.items.filter((item) => item.code !== build.code) } : current));
      toast.success("Đã xoá cấu hình");
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setDeleting(null);
    }
  }

  if (!user || state.status === "loading") {
    return (
      <div className="surface-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" aria-hidden />
        Đang tải cấu hình đã lưu...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
        <CloudOff className="size-8 text-slate-500" aria-hidden />
        <p className="mt-3 text-sm text-slate-500">Không tải được danh sách cấu hình. Vui lòng tải lại trang.</p>
      </div>
    );
  }

  if (state.items.length === 0) {
    return (
      <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-slate-100 text-slate-500">
          <Wrench className="size-8" aria-hidden />
        </span>
        <h2 className="mt-4 text-lg font-bold text-slate-800">Chưa có cấu hình nào</h2>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">
          Cấu hình bạn bấm &quot;Lưu&quot; và các gợi ý AI tạo khi đã đăng nhập sẽ hiện ở đây.
        </p>
        <Link
          href="/ai-build-pc"
          className="mt-6 rounded-xl bg-brand-500 px-6 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
        >
          Mở Build PC
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {state.items.map((build) => (
        <li key={build.code} className="surface-card flex flex-wrap items-center gap-3 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">
            {build.isAiGenerated ? <Sparkles className="size-5" aria-label="Gợi ý AI" /> : <Wrench className="size-5" aria-label="Tự ráp" />}
          </span>
          <div className="min-w-0 flex-1 basis-48">
            <p className="truncate font-semibold text-slate-800">{build.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {formatDate(build.createdAt)} · {build.itemCount} linh kiện · lúc lưu {formatPrice(build.totalAtSave)} ·{" "}
              <span className={build.isValidAtSave ? "text-emerald-700" : "text-slate-500"}>
                {/* isValid = đủ linh kiện và không có lỗi (cảnh báo không tính) — không gọi là "tương thích" cho khỏi hiểu quá */}
                {build.isValidAtSave ? "đủ linh kiện, không có lỗi" : "còn thiếu hoặc có lỗi"}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href={`/ai-build-pc?build=${encodeURIComponent(build.code)}`}
              className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-600"
            >
              Mở
            </Link>
            <button
              type="button"
              onClick={() => copyLink(build.code)}
              aria-label={`Sao chép link cấu hình ${build.name}`}
              className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-brand-400 hover:text-brand-600"
            >
              <Copy className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => remove(build)}
              disabled={deleting === build.code}
              aria-label={`Xoá cấu hình ${build.name}`}
              className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
