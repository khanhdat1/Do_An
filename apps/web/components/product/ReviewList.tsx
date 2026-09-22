"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleUserRound, CloudOff, LoaderCircle, MessageSquareText } from "lucide-react";
import ReviewForm from "@/components/product/ReviewForm";
import RatingStars from "@/components/product/RatingStars";
import { useAuth } from "@/components/providers/AuthProvider";
import { apiFetch } from "@/lib/api-client";
import { authHref } from "@/lib/navigation";
import type { Paginated, Review, ReviewEligibility } from "@/types";

const PAGE_SIZE = 10;

type ListState = { status: "loading" } | { status: "error" } | { status: "ready"; data: Paginated<Review> };

/** "22 thg 9, 2026" */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "numeric", month: "short", year: "numeric" });
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="border-b border-slate-100 py-4 last:border-0">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400">
          <CircleUserRound className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-800">{review.reviewerName}</p>
            {review.isVerified ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                Đã mua hàng
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <RatingStars value={review.rating} size="sm" />
            <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
          </div>
          {review.title ? <p className="mt-2 text-sm font-semibold text-slate-800">{review.title}</p> : null}
          {review.content ? <p className="mt-1 text-sm leading-relaxed text-slate-600">{review.content}</p> : null}

          {review.adminReply ? (
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-brand-600">
                <MessageSquareText className="size-3.5" />
                Phản hồi từ PCZone
              </p>
              <p className="mt-1 text-sm text-slate-600">{review.adminReply}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Đánh giá sản phẩm + form viết đánh giá — trang `/san-pham/[slug]` */
export default function ReviewList({ productSlug }: { productSlug: string }) {
  const { status: authStatus, user } = useAuth();
  const [page, setPage] = useState(1);
  const [listState, setListState] = useState<ListState>({ status: "loading" });
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [eligibilityTick, setEligibilityTick] = useState(0);

  function goToPage(next: number) {
    setPage(next);
    setListState({ status: "loading" });
  }

  useEffect(() => {
    let cancelled = false;

    apiFetch<Paginated<Review>>(`/api/products/${productSlug}/reviews?page=${page}&pageSize=${PAGE_SIZE}`)
      .then((data) => {
        if (!cancelled) setListState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setListState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [productSlug, page]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;

    apiFetch<ReviewEligibility>(`/api/products/${productSlug}/reviews/eligibility`)
      .then((data) => {
        if (!cancelled) setEligibility(data);
      })
      .catch(() => {
        // Không tải được thì cứ ẩn form đánh giá, không chặn xem danh sách
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, productSlug, eligibilityTick]);

  return (
    <section className="surface-card p-4 sm:p-6">
      <h2 className="mb-4 text-base font-bold text-slate-900">Đánh giá từ khách hàng</h2>

      {authStatus === "anonymous" ? (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <Link href={authHref("/dang-nhap", `/san-pham/${productSlug}`)} className="font-semibold text-brand-600 hover:underline">
            Đăng nhập
          </Link>{" "}
          để viết đánh giá cho sản phẩm bạn đã mua.
        </p>
      ) : null}

      {authStatus === "authenticated" && user && eligibility ? (
        eligibility.canReview ? (
          <ReviewForm
            productSlug={productSlug}
            onSubmitted={() => {
              setEligibilityTick((tick) => tick + 1);
            }}
          />
        ) : (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            {eligibility.hasReviewed
              ? "Bạn đã đánh giá sản phẩm này. Cảm ơn bạn!"
              : "Bạn cần mua và hoàn tất thanh toán sản phẩm này trước khi đánh giá."}
          </p>
        )
      ) : null}

      <div className="mt-5">
        {listState.status === "loading" ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <LoaderCircle className="size-4.5 animate-spin" />
            Đang tải đánh giá...
          </div>
        ) : null}

        {listState.status === "error" ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CloudOff className="size-8 text-slate-400" />
            <p className="mt-2 text-sm text-slate-500">Không tải được đánh giá. Vui lòng tải lại trang.</p>
          </div>
        ) : null}

        {listState.status === "ready" && listState.data.items.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Chưa có đánh giá nào cho sản phẩm này.</p>
        ) : null}

        {listState.status === "ready" && listState.data.items.length > 0 ? (
          <div>
            {listState.data.items.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : null}

        {listState.status === "ready" && listState.data.totalPages > 1 ? (
          <div className="flex items-center justify-center gap-3 pt-4">
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
              Trang {listState.data.page} / {listState.data.totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= listState.data.totalPages}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sau
              <ChevronRight className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
