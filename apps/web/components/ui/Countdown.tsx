"use client";

import { useEffect, useState } from "react";
import { splitCountdown } from "@/lib/format";

interface CountdownProps {
  /** Tổng số giây của đợt Flash Sale */
  seconds: number;
  label?: string;
}

/**
 * Đồng hồ đếm ngược Flash Sale.
 *
 * Render lần đầu ở server sẽ hiện đúng giá trị khởi tạo, sau đó
 * `useEffect` mới bắt đầu đếm — tránh lỗi hydration mismatch.
 */
export default function Countdown({
  seconds,
  label = "Kết thúc trong",
}: CountdownProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const { hours, minutes, seconds: ss } = splitCountdown(remaining);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium text-slate-300">{label}</span>
      <div className="flex items-center gap-1">
        {[hours, minutes, ss].map((value, index) => (
          <span key={index} className="flex items-center gap-1">
            {index > 0 ? (
              <span className="text-xs font-bold text-gold-400">:</span>
            ) : null}
            <span className="min-w-7 rounded-md bg-ink-950 px-1.5 py-1 text-center font-display text-sm font-bold text-gold-400 ring-1 ring-white/10">
              {value}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
