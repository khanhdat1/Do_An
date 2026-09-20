"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleAlert, Info, LoaderCircle, Trash2 } from "lucide-react";
import ProductThumb from "@/components/product/ProductThumb";
import QuantityStepper from "@/components/ui/QuantityStepper";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { errorMessage } from "@/lib/api-client";
import { discountPercent, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CartItem } from "@/types";

interface CartItemRowProps {
  item: CartItem;
}

/** Ghi chú nhỏ dưới dòng sản phẩm: cảnh báo hết hàng, đổi giá... */
function Note({
  tone,
  children,
}: {
  tone: "red" | "amber" | "blue";
  children: React.ReactNode;
}) {
  const Icon = tone === "blue" ? Info : CircleAlert;
  return (
    <p
      className={cn(
        "mt-2 flex items-start gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium leading-snug",
        tone === "red" && "bg-sale-500/10 text-sale-700",
        tone === "amber" && "bg-gold-400/15 text-gold-600",
        tone === "blue" && "bg-blue-50 text-blue-700",
      )}
    >
      <Icon className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export default function CartItemRow({ item }: CartItemRowProps) {
  const { setQuantity, removeItem } = useCart();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const discount = discountPercent(item.unitPrice, item.oldPrice);
  const cannotBuy = item.issue === "UNAVAILABLE" || item.issue === "OUT_OF_STOCK";

  return (
    <li
      aria-busy={busy}
      className={cn("surface-card p-3 transition-opacity sm:p-4", busy && "opacity-70")}
    >
      <div className="flex gap-3 sm:gap-4">
        <Link
          href={`/san-pham/${item.slug}`}
          className={cn("block w-20 shrink-0 sm:w-24", cannotBuy && "opacity-60 grayscale")}
        >
          <ProductThumb
            name={item.name}
            image={item.image}
            categoryPath={item.categoryPath}
            className="aspect-square"
            sizes="96px"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/san-pham/${item.slug}`}
                className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800 transition hover:text-brand-600"
              >
                {item.name}
              </Link>
              {item.brand ? <p className="mt-0.5 text-[11px] text-slate-500">{item.brand}</p> : null}
            </div>

            <button
              type="button"
              onClick={() => run(() => removeItem(item.id))}
              disabled={busy}
              aria-label={`Xóa ${item.name} khỏi giỏ hàng`}
              className="-m-1.5 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-sale-500/10 hover:text-sale-600 disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="size-4.5 animate-spin" /> : <Trash2 className="size-4.5" />}
            </button>
          </div>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-base font-bold text-sale-600">
              {formatPrice(item.unitPrice)}
            </span>
            {item.oldPrice ? (
              <>
                <span className="text-xs text-slate-400 line-through">{formatPrice(item.oldPrice)}</span>
                {discount > 0 ? (
                  <span className="rounded bg-sale-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    -{discount}%
                  </span>
                ) : null}
              </>
            ) : null}
          </div>

          {item.issue === "UNAVAILABLE" ? (
            <Note tone="red">Sản phẩm đã ngừng kinh doanh. Vui lòng xóa khỏi giỏ hàng.</Note>
          ) : null}
          {item.issue === "OUT_OF_STOCK" ? (
            <Note tone="red">Sản phẩm tạm hết hàng. Bạn có thể giữ trong giỏ hoặc xóa đi.</Note>
          ) : null}
          {item.issue === "INSUFFICIENT_STOCK" ? (
            <Note tone="amber">
              Chỉ còn {item.maxQuantity} sản phẩm, không đủ số lượng bạn chọn.{" "}
              <button
                type="button"
                onClick={() => run(() => setQuantity(item.id, item.maxQuantity))}
                disabled={busy}
                className="font-bold underline underline-offset-2 hover:no-underline"
              >
                Điều chỉnh xuống {item.maxQuantity}
              </button>
            </Note>
          ) : null}
          {item.priceChanged ? (
            <Note tone="blue">
              Giá đã thay đổi từ {formatPrice(item.priceAtAdd)} thành {formatPrice(item.unitPrice)} kể từ
              lúc bạn thêm vào giỏ.
            </Note>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-3">
            {cannotBuy ? (
              <span className="text-sm text-slate-500">Số lượng: {item.quantity}</span>
            ) : (
              <QuantityStepper
                value={item.quantity}
                max={item.maxQuantity}
                disabled={busy}
                label={item.name}
                onChange={(next) => run(() => setQuantity(item.id, next))}
              />
            )}

            <p
              className={cn(
                "font-display text-lg font-bold",
                cannotBuy ? "text-slate-400 line-through" : "text-slate-900",
              )}
            >
              {formatPrice(item.lineTotal)}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}
