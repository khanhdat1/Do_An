"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

interface TextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "id"> {
  label: string;
  /** Thông báo lỗi; có giá trị thì ô chuyển sang viền đỏ và đọc lên cho trình đọc màn hình */
  error?: string;
  /** Gợi ý ngắn dưới ô nhập, ẩn đi khi đang có lỗi */
  hint?: string;
  /** Dấu * cạnh tên ô: trường bắt buộc */
  required?: boolean;
  /** Gắn nhãn "Không bắt buộc" cạnh tên ô (bị thay bởi `labelAside` nếu có) */
  optional?: boolean;
  /** Icon đặt sát mép trái trong ô nhập */
  icon?: React.ReactNode;
  /** Nội dung bên phải hàng nhãn, ví dụ liên kết "Quên mật khẩu?" */
  labelAside?: React.ReactNode;
  /** Nội dung đặt sát mép phải trong ô nhập (nút hiện / ẩn mật khẩu...) */
  trailing?: React.ReactNode;
}

/** Ô nhập liệu chuẩn của site: nhãn, gợi ý và lỗi được nối đúng bằng aria */
export default function TextField({
  label,
  error,
  hint,
  required,
  optional,
  icon,
  labelAside,
  trailing,
  ...inputProps
}: TextFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-slate-700">
          {label}
          {required ? (
            <span aria-hidden className="ml-0.5 text-brand-600">
              *
            </span>
          ) : null}
        </label>
        {labelAside ??
          (optional ? (
            <span className="text-[11px] font-normal text-slate-400">Không bắt buộc</span>
          ) : null)}
      </div>

      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-slate-400">
            {icon}
          </span>
        ) : null}

        <input
          {...inputProps}
          id={id}
          aria-required={required ? true : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-11 w-full rounded-lg border bg-slate-50 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500",
            icon ? "pl-10.5" : "pl-3.5",
            trailing ? "pr-11" : "pr-3.5",
            error
              ? "border-sale-500 focus:border-sale-500 focus:ring-sale-500/20"
              : "border-slate-200 focus:border-brand-500 focus:ring-brand-500/20",
          )}
        />

        {trailing ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{trailing}</div>
        ) : null}
      </div>

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-sale-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
