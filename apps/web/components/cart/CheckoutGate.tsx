"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, ShoppingCart, TriangleAlert } from "lucide-react";
import FormError from "@/components/auth/FormError";
import AddressPicker from "@/components/checkout/AddressPicker";
import CheckoutSummary from "@/components/checkout/CheckoutSummary";
import PaymentMethodPicker from "@/components/checkout/PaymentMethodPicker";
import VoucherInput, { type AppliedVoucher } from "@/components/checkout/VoucherInput";
import { useCart } from "@/components/providers/CartProvider";
import { useRequireAuth } from "@/components/auth/useRequireAuth";
import { useToast } from "@/components/providers/ToastProvider";
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { CreateOrderResult, PaymentMethods } from "@/types";

const MAX_NOTE_LENGTH = 500;

const SUBMIT_LABEL: Record<"COD" | "VNPAY" | "BANK_TRANSFER" | "MOMO", string> = {
  COD: "Đặt hàng",
  VNPAY: "Đặt hàng & thanh toán VNPay",
  BANK_TRANSFER: "Đặt hàng & lấy mã QR chuyển khoản",
  MOMO: "Đặt hàng & lấy thông tin MoMo",
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface-card mx-auto flex max-w-lg items-center justify-center gap-2 p-10 text-sm text-slate-500">
      {children}
    </div>
  );
}

/**
 * Bước đặt hàng: chọn/nhập địa chỉ giao hàng, chọn phương thức thanh toán, xem lại đơn rồi tạo đơn thật
 * (`POST /api/orders`). Chọn VNPay thì chuyển thẳng sang cổng thanh toán; chọn COD thì sang thẳng trang chi
 * tiết đơn vừa tạo.
 */
export default function CheckoutGate() {
  const user = useRequireAuth("/thanh-toan");
  const { cart, status: cartStatus, reload: reloadCart } = useCart();
  const router = useRouter();
  const toast = useToast();

  const [addressId, setAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "VNPAY" | "BANK_TRANSFER" | "MOMO">("COD");
  const [methods, setMethods] = useState<PaymentMethods | null>(null);
  const [voucher, setVoucher] = useState<AppliedVoucher | null>(null);
  const [customerNote, setCustomerNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<PaymentMethods>("/api/payments/methods")
      .then((result) => {
        if (!cancelled) setMethods(result);
      })
      .catch(() => {
        // Không tải được thì cứ để mặc định (COD) — trang vẫn đặt hàng được, chỉ là chưa biết VNPay có bật hay không
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user || cartStatus === "loading") {
    return (
      <Centered>
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải...
      </Centered>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="surface-card mx-auto flex max-w-lg flex-col items-center px-6 py-14 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-slate-100 text-slate-400">
          <ShoppingCart className="size-8" />
        </span>
        <h1 className="mt-4 text-lg font-bold text-slate-800">Giỏ hàng của bạn đang trống</h1>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">Hãy chọn sản phẩm rồi quay lại đặt hàng.</p>
        <Link href="/" className="mt-6 rounded-xl bg-brand-500 px-6 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600">
          Tiếp tục mua sắm
        </Link>
      </div>
    );
  }

  if (cart.hasBlockingIssues) {
    return (
      <div className="surface-card mx-auto flex max-w-lg flex-col items-center px-6 py-14 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-gold-400/15 text-gold-600">
          <TriangleAlert className="size-8" />
        </span>
        <h1 className="mt-4 text-lg font-bold text-slate-800">Giỏ hàng có sản phẩm cần xử lý</h1>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">
          Một vài sản phẩm đã hết hàng hoặc đổi giá. Vui lòng quay lại giỏ hàng để kiểm tra trước khi đặt hàng.
        </p>
        <Link href="/gio-hang" className="mt-6 rounded-xl bg-brand-500 px-6 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600">
          Về giỏ hàng
        </Link>
      </div>
    );
  }

  // Nút "Đặt hàng" gọi thẳng hàm này (không đặt cả trang trong một <form>): AddressForm bên trong
  // AddressPicker đã tự là một <form> riêng (nút "Lưu địa chỉ") — HTML không cho phép form lồng form.
  async function handleSubmit() {
    if (submitting) return;

    if (!addressId) {
      setFormError("Vui lòng chọn hoặc thêm địa chỉ giao hàng.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const result = await apiFetch<CreateOrderResult>("/api/orders", {
        method: "POST",
        body: {
          addressId,
          paymentMethod,
          customerNote: customerNote.trim() || undefined,
          voucherCode: voucher?.code,
        },
      });

      await reloadCart();

      if (result.payUrl) {
        // Điều hướng thẳng sang VNPay — không phải gọi API nên không cần làm mới phiên trước như lúc liên kết mạng xã hội
        window.location.assign(result.payUrl);
        return;
      }

      toast.success(`Đặt hàng thành công! Mã đơn ${result.order.orderCode}`);
      router.push(`/don-hang/${result.order.orderCode}`);
    } catch (error) {
      setFormError(errorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <div className="space-y-5 lg:col-span-8">
        <Link href="/gio-hang" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-brand-600">
          <ArrowLeft className="size-3.5" />
          Quay lại giỏ hàng
        </Link>

        <section className="surface-card p-4 sm:p-5">
          <h2 className="mb-3 text-base font-bold text-slate-900">Giao hàng tới</h2>
          <AddressPicker value={addressId} onChange={setAddressId} />
        </section>

        <section className="surface-card p-4 sm:p-5">
          <h2 className="mb-3 text-base font-bold text-slate-900">Phương thức thanh toán</h2>
          <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} methods={methods} />
        </section>

        <section className="surface-card p-4 sm:p-5">
          <h2 className="mb-3 text-base font-bold text-slate-900">Mã giảm giá</h2>
          <VoucherInput subtotal={cart.subtotal} applied={voucher} onApply={setVoucher} onRemove={() => setVoucher(null)} />
        </section>

        <section className="surface-card p-4 sm:p-5">
          <label htmlFor="customerNote" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Ghi chú cho đơn hàng <span className="font-normal text-slate-400">(không bắt buộc)</span>
          </label>
          <textarea
            id="customerNote"
            value={customerNote}
            onChange={(event) => setCustomerNote(event.target.value.slice(0, MAX_NOTE_LENGTH))}
            maxLength={MAX_NOTE_LENGTH}
            rows={3}
            placeholder="Ví dụ: giao giờ hành chính, gọi trước khi giao..."
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
          />
        </section>
      </div>

      <div className="space-y-4 lg:sticky lg:top-44 lg:col-span-4">
        <CheckoutSummary cart={cart} discountAmount={voucher?.discountAmount ?? 0} />

        {formError ? <FormError message={formError} /> : null}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !addressId}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <LoaderCircle className="size-4.5 animate-spin" /> : null}
          {submitting ? "Đang đặt hàng..." : SUBMIT_LABEL[paymentMethod]}
        </button>
      </div>
    </div>
  );
}
