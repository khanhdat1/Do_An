"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import FormError from "@/components/auth/FormError";
import RatingStars from "@/components/product/RatingStars";
import { useToast } from "@/components/providers/ToastProvider";
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { Review } from "@/types";

const MAX_TITLE = 200;
const MAX_CONTENT = 3000;

interface ReviewFormProps {
  productSlug: string;
  onSubmitted: (review: Review) => void;
}

/** Form viết đánh giá — chỉ hiện khi `ReviewList` đã xác nhận `canReview` qua API eligibility */
export default function ReviewForm({ productSlug, onSubmitted }: ReviewFormProps) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (rating < 1) {
      setError("Vui lòng chọn số sao đánh giá");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const review = await apiFetch<Review>(`/api/products/${productSlug}/reviews`, {
        method: "POST",
        body: { rating, title: title.trim() || undefined, content: content.trim() || undefined },
      });
      onSubmitted(review);
      toast.success("Đã gửi đánh giá — chờ cửa hàng duyệt trước khi hiện công khai");
      setRating(0);
      setTitle("");
      setContent("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="mb-2 text-sm font-semibold text-slate-700">Chọn số sao</p>
      <RatingStars value={rating} onChange={setRating} size="lg" />

      <input
        value={title}
        onChange={(event) => setTitle(event.target.value.slice(0, MAX_TITLE))}
        placeholder="Tiêu đề (không bắt buộc)"
        maxLength={MAX_TITLE}
        className="mt-4 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
      />
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value.slice(0, MAX_CONTENT))}
        placeholder="Chia sẻ cảm nhận của bạn về sản phẩm (không bắt buộc)"
        rows={4}
        maxLength={MAX_CONTENT}
        className="mt-2.5 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
      />

      {error ? <div className="mt-2.5"><FormError message={error} /></div> : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-3 flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {submitting ? "Đang gửi..." : "Gửi đánh giá"}
      </button>
    </div>
  );
}
