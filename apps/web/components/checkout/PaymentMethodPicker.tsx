"use client";

import { Banknote, CreditCard, Landmark, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaymentMethods } from "@/types";

type Method = "COD" | "VNPAY" | "BANK_TRANSFER" | "MOMO";

interface PaymentMethodPickerProps {
  value: Method;
  onChange: (method: Method) => void;
  /** `null` = chưa tải xong `/api/payments/methods`: tạm coi mọi phương thức khả dụng, không khoá nhầm trong lúc chờ */
  methods: PaymentMethods | null;
}

const OPTIONS: { value: Method; label: string; note: string; icon: typeof Banknote; configKey: keyof PaymentMethods }[] = [
  { value: "COD", label: "Thanh toán khi nhận hàng", note: "Trả tiền mặt cho nhân viên giao hàng (COD)", icon: Banknote, configKey: "cod" },
  { value: "VNPAY", label: "Thanh toán qua VNPay", note: "Quét mã hoặc thẻ ATM/Visa/Master qua cổng VNPay", icon: CreditCard, configKey: "vnpay" },
  { value: "BANK_TRANSFER", label: "Chuyển khoản ngân hàng", note: "Quét mã QR, hệ thống tự đối chiếu theo mã đơn", icon: Landmark, configKey: "bankTransfer" },
  { value: "MOMO", label: "Ví MoMo", note: "Chuyển khoản qua ứng dụng MoMo", icon: Wallet, configKey: "momo" },
];

export default function PaymentMethodPicker({ value, onChange, methods }: PaymentMethodPickerProps) {
  return (
    <div role="radiogroup" aria-label="Phương thức thanh toán" className="space-y-2.5">
      {OPTIONS.map((option) => {
        const disabled = methods !== null && !methods[option.configKey];
        const selected = value === option.value && !disabled;
        const Icon = option.icon;

        return (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition",
              disabled && "cursor-not-allowed opacity-50",
              selected ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500" : "border-slate-200 bg-white hover:border-slate-300",
            )}
          >
            <input
              type="radio"
              name="paymentMethod"
              value={option.value}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span
              className={cn(
                "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full border-2",
                selected ? "border-brand-500" : "border-slate-300",
              )}
              aria-hidden="true"
            >
              {selected ? <span className="size-2 rounded-full bg-brand-500" /> : null}
            </span>

            <Icon className="mt-0.5 size-5 shrink-0 text-slate-400" />

            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-800">{option.label}</span>
              <span className="block text-xs text-slate-500">
                {disabled ? "Phương thức này hiện chưa khả dụng, vui lòng chọn COD" : option.note}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
