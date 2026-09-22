import Link from "next/link";
import ProductThumb from "@/components/product/ProductThumb";
import { formatPrice } from "@/lib/format";
import { calcShippingFee, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";
import type { Cart } from "@/types";

interface CheckoutSummaryProps {
  cart: Cart;
  /** Số tiền được giảm từ mã đang áp dụng (nếu có) — luôn được API tính lại lúc tạo đơn thật */
  discountAmount?: number;
}

/** Xem trước các dòng hàng + tổng tiền ở bước đặt hàng. Chỉ đọc — sửa số lượng thì quay lại trang giỏ hàng. */
export default function CheckoutSummary({ cart, discountAmount = 0 }: CheckoutSummaryProps) {
  const shippingFee = calcShippingFee(cart.subtotal);
  const total = cart.subtotal - discountAmount + shippingFee;

  return (
    <aside className="surface-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Đơn hàng ({cart.itemCount} sản phẩm)</h2>
        <Link href="/gio-hang" className="text-xs font-semibold text-brand-600 hover:underline">
          Sửa giỏ hàng
        </Link>
      </div>

      <ul className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
        {cart.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            <ProductThumb
              name={item.name}
              image={item.image}
              categoryPath={item.categoryPath}
              className="w-14 shrink-0"
              sizes="56px"
            />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-xs font-medium leading-snug text-slate-700">{item.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {item.quantity} × {formatPrice(item.unitPrice)}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-slate-800">{formatPrice(item.lineTotal)}</p>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Tạm tính</dt>
          <dd className="font-semibold text-slate-800">{formatPrice(cart.subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Phí vận chuyển</dt>
          <dd className="font-semibold text-slate-800">
            {shippingFee === 0 ? <span className="text-emerald-600">Miễn phí</span> : formatPrice(shippingFee)}
          </dd>
        </div>
        {shippingFee > 0 ? (
          <p className="text-xs text-slate-400">
            Miễn phí vận chuyển cho đơn từ {formatPrice(FREE_SHIPPING_THRESHOLD)}
          </p>
        ) : null}
        {discountAmount > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Giảm giá</dt>
            <dd className="font-semibold text-emerald-600">-{formatPrice(discountAmount)}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
        <span className="text-sm font-semibold text-slate-700">Tổng cộng</span>
        <span className="font-display text-2xl font-bold text-sale-600">{formatPrice(total)}</span>
      </div>
    </aside>
  );
}
