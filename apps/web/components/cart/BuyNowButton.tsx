"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShoppingCart } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { errorMessage } from "@/lib/api-client";

interface BuyNowButtonProps {
  productId: string;
  /** false thì hiện nút "Hết hàng" bị khoá */
  inStock?: boolean;
}

/**
 * Nút "Mua ngay" của thẻ sản phẩm: thêm 1 sản phẩm vào giỏ rồi chuyển tới trang giỏ hàng.
 */
export default function BuyNowButton({ productId, inStock = true }: BuyNowButtonProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await addItem(productId, 1);
      // Không tắt trạng thái bận: trang sắp chuyển đi, tránh bấm đúp thêm hai lần
      router.push("/gio-hang");
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  if (!inStock) {
    return (
      <button
        type="button"
        disabled
        className="flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg bg-slate-200 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500"
      >
        Hết hàng
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600 active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
    >
      {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
      Mua ngay
    </button>
  );
}
