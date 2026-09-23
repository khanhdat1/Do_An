"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, CloudOff, LoaderCircle, MessageSquareText, ShieldAlert, Trash2 } from "lucide-react";
import AdminBadge from "@/components/admin/AdminBadge";
import RatingStars from "@/components/product/RatingStars";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { adminApiFetch, errorMessage } from "@/lib/admin-api-client";
import type { AdminReviewSummary, Paginated } from "@/types";

const PAGE_SIZE = 20;

type Tab = "PENDING" | "ALL";
type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: Paginated<AdminReviewSummary> };

/** "22/09/2026" */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ReplyBox({ reviewId, existingReply, onReplied }: { reviewId: string; existingReply?: string; onReplied: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState(existingReply ?? "");
  const [busy, setBusy] = useState(false);

  async function handleSend() {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await adminApiFetch(`/api/admin/reviews/${reviewId}/reply`, { method: "POST", body: { reply: reply.trim() } });
      toast.success("Đã lưu phản hồi");
      setOpen(false);
      onReplied();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-brand-400 hover:text-brand-600"
      >
        <MessageSquareText className="size-3.5" />
        {existingReply ? "Sửa phản hồi" : "Trả lời"}
      </button>
    );
  }

  return (
    <div className="mt-2 w-full">
      <textarea
        value={reply}
        onChange={(event) => setReply(event.target.value.slice(0, 1000))}
        rows={2}
        placeholder="Phản hồi công khai của cửa hàng..."
        className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
      />
      <div className="mt-1.5 flex gap-2">
        <button
          type="button"
          onClick={handleSend}
          disabled={busy || !reply.trim()}
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Đang lưu..." : "Lưu"}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={busy} className="text-xs font-semibold text-slate-500 hover:underline">
          Huỷ
        </button>
      </div>
    </div>
  );
}

/** Danh sách đánh giá cho nhân viên/quản trị duyệt / xoá / trả lời — trang `/admin/reviews` */
export default function AdminReviewListView() {
  const { user } = useAdminAuth();
  const [tab, setTab] = useState<Tab>("PENDING");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<State>({ status: "loading" });
  const [refreshTick, setRefreshTick] = useState(0);

  function changeTab(next: Tab) {
    setTab(next);
    setPage(1);
    setState({ status: "loading" });
  }

  function goToPage(next: number) {
    setPage(next);
    setState({ status: "loading" });
  }

  function refresh() {
    setState({ status: "loading" });
    setRefreshTick((tick) => tick + 1);
  }

  const allowed = user ? user.permissions.includes("products:read") : null;

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;

    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (tab === "PENDING") query.set("isApproved", "false");

    adminApiFetch<Paginated<AdminReviewSummary>>(`/api/admin/reviews?${query}`)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [allowed, tab, page, refreshTick]);

  const toast = useToast();

  async function handleApprove(id: string) {
    try {
      await adminApiFetch(`/api/admin/reviews/${id}/approve`, { method: "POST", body: {} });
      toast.success("Đã duyệt đánh giá");
      refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function handleDelete(id: string) {
    try {
      await adminApiFetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
      toast.success("Đã xoá đánh giá");
      refresh();
    } catch (error) {
      toast.error(errorMessage(error));
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
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">Trang này chỉ dành cho nhân viên/quản trị viên.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="admin-card flex gap-2 p-3">
        {(["PENDING", "ALL"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => changeTab(value)}
            className={`rounded-lg px-3.5 py-2 text-sm font-bold transition ${
              tab === value ? "bg-brand-500 text-white shadow-sm shadow-brand-500/30" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {value === "PENDING" ? "Chờ duyệt" : "Tất cả"}
          </button>
        ))}
      </div>

      {state.status === "loading" ? (
        <div className="admin-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
          <LoaderCircle className="size-4.5 animate-spin" />
          Đang tải...
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
          <CloudOff className="size-8 text-slate-400" />
          <p className="mt-3 text-sm text-slate-500">Không tải được danh sách đánh giá. Vui lòng tải lại trang.</p>
        </div>
      ) : null}

      {state.status === "ready" && state.data.items.length === 0 ? (
        <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
          <h2 className="text-lg font-bold text-slate-800">
            {tab === "PENDING" ? "Không có đánh giá nào chờ duyệt" : "Chưa có đánh giá nào"}
          </h2>
        </div>
      ) : null}

      {state.status === "ready" && state.data.items.length > 0 ? (
        <div className="admin-card divide-y divide-slate-100 p-2">
          {state.data.items.map((review) => (
            <div key={review.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/san-pham/${review.productSlug}`} target="_blank" className="text-sm font-bold text-brand-600 hover:underline">
                    {review.productName}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">{review.reviewerName}</span>
                    <RatingStars value={review.rating} size="sm" />
                    <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
                    {review.isApproved ? (
                      <AdminBadge tone="green">Đã duyệt</AdminBadge>
                    ) : (
                      <AdminBadge tone="amber">Chờ duyệt</AdminBadge>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {!review.isApproved ? (
                    <button
                      type="button"
                      onClick={() => handleApprove(review.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600"
                    >
                      <Check className="size-3.5" />
                      Duyệt
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleDelete(review.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-sale-600 transition hover:border-sale-300 hover:bg-sale-500/5"
                  >
                    <Trash2 className="size-3.5" />
                    Xoá
                  </button>
                </div>
              </div>

              {review.title ? <p className="mt-2 text-sm font-semibold text-slate-800">{review.title}</p> : null}
              {review.content ? <p className="mt-1 text-sm text-slate-600">{review.content}</p> : null}

              <div className="mt-2">
                <ReplyBox reviewId={review.id} existingReply={review.adminReply} onReplied={refresh} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {state.status === "ready" && state.data.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="size-4" />
            Trước
          </button>
          <span className="text-sm text-slate-500">
            Trang {state.data.page} / {state.data.totalPages}
          </span>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= state.data.totalPages}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sau
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
