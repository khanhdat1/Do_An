"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CloudOff, ShoppingCart } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { errorMessage } from "@/lib/api-client";
import CartItemRow from "./CartItemRow";
import CartSummary from "./CartSummary";

/** Khung chờ trong lúc nạp giỏ, cùng bố cục với giỏ thật để trang không giật */
function CartSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12" aria-busy="true" aria-label="Đang tải giỏ hàng">
      <div className="space-y-3 lg:col-span-8">
        {[0, 1].map((key) => (
          <div key={key} className="surface-card flex animate-pulse gap-4 p-4">
            <div className="size-24 rounded-lg bg-slate-200" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-4 w-1/4 rounded bg-slate-200" />
              <div className="h-9 w-32 rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
      <div className="surface-card h-64 animate-pulse bg-slate-100 lg:col-span-4" />
    </div>
  );
}

function Message({
  icon,
  title,
  text,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-20 place-items-center rounded-full bg-slate-100 text-slate-400">{icon}</span>
      <h2 className="mt-5 text-lg font-bold text-slate-800">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500">{text}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

export default function CartView() {
  const { cart, status, reload, clear } = useCart();
  const toast = useToast();
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function handleClear() {
    setClearing(true);
    try {
      await clear();
      toast.success("Đã xóa toàn bộ giỏ hàng");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setClearing(false);
      setConfirmingClear(false);
    }
  }

  if (status === "loading") return <CartSkeleton />;

  if (status === "error" && cart.items.length === 0) {
    return (
      <Message
        icon={<CloudOff className="size-9" />}
        title="Không tải được giỏ hàng"
        text="Không kết nối được máy chủ. Vui lòng kiểm tra kết nối rồi thử lại."
      >
        <button
          type="button"
          onClick={() => reload().catch((error) => toast.error(errorMessage(error)))}
          className="rounded-xl bg-brand-500 px-6 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
        >
          Thử lại
        </button>
      </Message>
    );
  }

  if (cart.items.length === 0) {
    return (
      <Message
        icon={<ShoppingCart className="size-9" />}
        title="Giỏ hàng của bạn đang trống"
        text="Hãy chọn thêm sản phẩm để bắt đầu mua sắm."
      >
        <Link
          href="/"
          className="rounded-xl bg-brand-500 px-6 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
        >
          Tiếp tục mua sắm
        </Link>
      </Message>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-brand-600"
          >
            <ArrowLeft className="size-3.5" />
            Tiếp tục mua sắm
          </Link>

          {confirmingClear ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Xóa hết sản phẩm?</span>
              <button
                type="button"
                onClick={handleClear}
                disabled={clearing}
                className="font-bold text-sale-600 hover:underline disabled:opacity-60"
              >
                {clearing ? "Đang xóa..." : "Xóa"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                disabled={clearing}
                className="font-semibold text-slate-500 hover:underline"
              >
                Hủy
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              className="text-xs font-semibold text-slate-500 transition hover:text-sale-600"
            >
              Xóa tất cả
            </button>
          )}
        </div>

        <ul className="space-y-3">
          {cart.items.map((item) => (
            <CartItemRow key={item.id} item={item} />
          ))}
        </ul>
      </div>

      <div className="lg:sticky lg:top-44 lg:col-span-4">
        <CartSummary cart={cart} />
      </div>
    </div>
  );
}
