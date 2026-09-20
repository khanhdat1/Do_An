"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShoppingCart, Zap } from "lucide-react";
import QuantityStepper from "@/components/ui/QuantityStepper";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { errorMessage } from "@/lib/api-client";

interface ProductPurchasePanelProps {
  productId: string;
  name: string;
  inStock: boolean;
  /** Số lượng tối đa được đặt (đã tính tồn kho và trần mỗi dòng) */
  maxQuantity: number;
}

/**
 * Khối mua hàng của trang chi tiết: chọn số lượng, "Thêm vào giỏ", "Mua ngay".
 * Tính sẵn số lượng đã có trong giỏ để không cho chọn vượt trần rồi mới báo lỗi.
 */
export default function ProductPurchasePanel({
  productId,
  name,
  inStock,
  maxQuantity,
}: ProductPurchasePanelProps) {
  const router = useRouter();
  const { cart, addItem } = useCart();
  const toast = useToast();

  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState<"cart" | "buy" | null>(null);

  const inCart = cart.items.find((item) => item.productId === productId)?.quantity ?? 0;
  const remaining = Math.max(0, maxQuantity - inCart);
  const canBuy = inStock && remaining > 0;
  // Khách vừa đổi số lượng trong giỏ ở tab khác làm `remaining` co lại: kẹp lại cho hợp lệ
  const selected = Math.min(quantity, Math.max(1, remaining));

  async function add(mode: "cart" | "buy") {
    setPending(mode);
    try {
      await addItem(productId, selected);

      if (mode === "buy") {
        router.push("/gio-hang");
        return; // giữ trạng thái bận tới khi chuyển trang
      }

      toast.success(`Đã thêm ${selected} sản phẩm vào giỏ hàng`, {
        label: "Xem giỏ hàng",
        href: "/gio-hang",
      });
      setQuantity(1);
    } catch (error) {
      toast.error(errorMessage(error));
    }
    setPending(null);
  }

  if (!inStock) {
    return (
      <div className="mt-5">
        <button
          type="button"
          disabled
          className="flex h-12 w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-200 text-sm font-bold uppercase tracking-wide text-slate-500"
        >
          Tạm hết hàng
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm font-semibold text-slate-700">Số lượng</span>
        <QuantityStepper
          value={selected}
          max={Math.max(1, remaining)}
          disabled={!canBuy || pending !== null}
          label={name}
          onChange={setQuantity}
        />
        {inCart > 0 ? (
          <span className="text-xs text-slate-500">Trong giỏ đã có {inCart}</span>
        ) : null}
      </div>

      {!canBuy ? (
        <p className="mt-2 text-xs font-medium text-gold-600">
          Bạn đã thêm tối đa số lượng cho phép của sản phẩm này vào giỏ hàng.
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => add("cart")}
          disabled={!canBuy || pending !== null}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-brand-500 bg-white text-sm font-bold uppercase tracking-wide text-brand-600 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === "cart" ? (
            <LoaderCircle className="size-4.5 animate-spin" />
          ) : (
            <ShoppingCart className="size-4.5" />
          )}
          Thêm vào giỏ
        </button>

        <button
          type="button"
          onClick={() => add("buy")}
          disabled={!canBuy || pending !== null}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === "buy" ? (
            <LoaderCircle className="size-4.5 animate-spin" />
          ) : (
            <Zap className="size-4.5" />
          )}
          Mua ngay
        </button>
      </div>
    </div>
  );
}
