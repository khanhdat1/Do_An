"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  min?: number;
  max: number;
  /** Được gọi khi giá trị thực sự đổi; luôn nằm trong [min, max] */
  onChange: (value: number) => void;
  /**
   * Bật trong lúc đang lưu thay đổi. Khi tắt đi mà `value` không đổi (lưu thất
   * bại) thì ô nhập trả về `value`, không giữ lại số vừa gõ.
   */
  disabled?: boolean;
  /** Tên sản phẩm, để trình đọc màn hình biết bộ chọn này thuộc dòng nào */
  label?: string;
  className?: string;
}

/**
 * Bộ chọn số lượng: nút − / + và ô nhập số.
 * Gõ tay thì chỉ áp dụng khi rời ô hoặc nhấn Enter, và tự kẹp vào [min, max].
 */
export default function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  disabled = false,
  label,
  className,
}: QuantityStepperProps) {
  const [draft, setDraft] = useState(String(value));
  const [previous, setPrevious] = useState({ value, disabled });

  // Đồng bộ chữ trong ô nhập theo `value` từ ngoài đưa vào (cách React khuyến nghị
  // thay cho useEffect: đặt state ngay trong lúc render khi prop đổi)
  if (previous.value !== value || previous.disabled !== disabled) {
    setPrevious({ value, disabled });
    if (previous.value !== value || (previous.disabled && !disabled)) {
      setDraft(String(value));
    }
  }

  function commit() {
    const parsed = Number.parseInt(draft, 10);
    const next = Number.isNaN(parsed) ? value : Math.min(max, Math.max(min, parsed));

    if (next === value) {
      setDraft(String(value));
      return;
    }
    onChange(next);
  }

  const buttonClass =
    "grid size-9 place-items-center text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent";

  return (
    <div
      role="group"
      aria-label={label ? `Số lượng ${label}` : "Số lượng"}
      className={cn(
        "inline-flex items-center overflow-hidden rounded-lg border border-slate-300 bg-white",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label="Giảm số lượng"
        className={buttonClass}
      >
        <Minus className="size-4" />
      </button>

      <input
        type="text"
        inputMode="numeric"
        value={draft}
        disabled={disabled}
        aria-label="Số lượng"
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 3))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        className="h-9 w-11 border-x border-slate-200 bg-transparent text-center text-sm font-semibold text-slate-800 outline-none focus:bg-brand-50 disabled:text-slate-400"
      />

      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label="Tăng số lượng"
        className={buttonClass}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
