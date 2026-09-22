"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  /** Số sao đang tô (làm tròn khi chỉ hiển thị) */
  value: number;
  /** Có thì cho bấm chọn sao (dùng trong form viết đánh giá); không có thì chỉ hiển thị */
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASS = { sm: "size-3.5", md: "size-5", lg: "size-7" };

/** 5 sao — chế độ hiển thị (làm tròn `value`) hoặc chế độ chọn khi có `onChange` */
export default function RatingStars({ value, onChange, size = "md", className }: RatingStarsProps) {
  const rounded = Math.round(value);
  const interactive = Boolean(onChange);

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role={interactive ? "radiogroup" : undefined}
      aria-label={interactive ? "Chọn số sao" : `${value} trên 5 sao`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= rounded;
        const Icon = (
          <Star className={cn(SIZE_CLASS[size], filled ? "fill-gold-400 text-gold-400" : "fill-transparent text-slate-300")} />
        );

        if (!interactive) {
          return <span key={star}>{Icon}</span>;
        }

        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === rounded}
            aria-label={`${star} sao`}
            onClick={() => onChange?.(star)}
            className="rounded p-0.5 transition hover:scale-110"
          >
            {Icon}
          </button>
        );
      })}
    </div>
  );
}
