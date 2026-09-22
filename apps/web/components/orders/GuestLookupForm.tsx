"use client";

import { useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import FormError from "@/components/auth/FormError";
import OrderDetailView from "@/components/orders/OrderDetailView";
import TextField from "@/components/ui/TextField";
import { apiFetch, ApiError, errorMessage } from "@/lib/api-client";
import type { Order } from "@/types";

interface Errors {
  code?: string;
  phone?: string;
}

/**
 * Tra cứu đơn hàng không cần đăng nhập: phải nhập đúng cả mã đơn lẫn số điện thoại nhận hàng
 * (`GET /api/order-lookup`, có trần gọi chặt để chống dò).
 */
export default function GuestLookupForm() {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const found: Errors = {};
    if (!code.trim()) found.code = "Vui lòng nhập mã đơn hàng";
    const phoneDigits = phone.replace(/[\s.-]/g, "");
    if (!phoneDigits) found.phone = "Vui lòng nhập số điện thoại";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    setOrder(null);
    try {
      const params = new URLSearchParams({ code: code.trim(), phone: phoneDigits });
      setOrder(await apiFetch<Order>(`/api/order-lookup?${params.toString()}`));
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.status === 404
          ? "Không tìm thấy đơn hàng khớp mã đơn và số điện thoại đã nhập. Vui lòng kiểm tra lại."
          : errorMessage(error),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} noValidate className="surface-card space-y-4 p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Mã đơn hàng"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            error={errors.code}
            placeholder="PCZ20260922-0001"
            autoComplete="off"
          />
          <TextField
            label="Số điện thoại nhận hàng"
            required
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            error={errors.phone}
            placeholder="0912 345 678"
            autoComplete="tel"
          />
        </div>

        {formError ? <FormError message={formError} /> : null}

        <button
          type="submit"
          disabled={submitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:px-8"
        >
          {submitting ? <LoaderCircle className="size-4.5 animate-spin" /> : <Search className="size-4.5" />}
          {submitting ? "Đang tra cứu..." : "Tra cứu"}
        </button>
      </form>

      {order ? <OrderDetailView order={order} /> : null}
    </div>
  );
}
