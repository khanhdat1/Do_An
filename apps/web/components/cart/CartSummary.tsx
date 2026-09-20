"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, TriangleAlert } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { formatPrice } from "@/lib/format";
import { authHref } from "@/lib/navigation";
import type { Cart, CartItem } from "@/types";

/** Trang đặt hàng — cửa ngõ sang bước thanh toán */
const CHECKOUT_PATH = "/thanh-toan";

const ctaClass =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-brand-600";

/** Dòng ngừng bán / hết hàng không được tính vào tiền phải trả (khớp với `subtotal` của API) */
function isBillable(item: CartItem): boolean {
  return item.issue !== "UNAVAILABLE" && item.issue !== "OUT_OF_STOCK";
}

/** Tổng số tiền khách được giảm so với giá niêm yết, chỉ tính các dòng còn mua được */
function calcSavings(items: CartItem[]): number {
  return items.reduce(
    (sum, item) => (item.oldPrice ? sum + (item.oldPrice - item.unitPrice) * item.quantity : sum),
    0,
  );
}

/** Khối tổng tiền bên phải trang giỏ hàng + nút đi tiếp tuỳ theo trạng thái đăng nhập */
export default function CartSummary({ cart }: { cart: Cart }) {
  const { status } = useAuth();
  const billable = cart.items.filter(isBillable);
  const billableCount = billable.reduce((sum, item) => sum + item.quantity, 0);
  const savings = calcSavings(billable);

  return (
    <aside className="surface-card p-4 sm:p-5">
      <h2 className="text-base font-bold text-slate-900">Tóm tắt đơn hàng</h2>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Tạm tính ({billableCount} sản phẩm)</dt>
          <dd className="font-semibold text-slate-800">{formatPrice(cart.subtotal)}</dd>
        </div>

        {savings > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Bạn tiết kiệm</dt>
            <dd className="font-semibold text-emerald-600">-{formatPrice(savings)}</dd>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Phí vận chuyển</dt>
          <dd className="text-xs text-slate-500">Tính ở bước đặt hàng</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
        <span className="text-sm font-semibold text-slate-700">Tổng cộng</span>
        <span className="font-display text-2xl font-bold text-sale-600">{formatPrice(cart.subtotal)}</span>
      </div>

      <div className="mt-5">
        {cart.hasBlockingIssues ? (
          <>
            <button type="button" disabled className={`${ctaClass} cursor-not-allowed opacity-50 hover:bg-brand-500`}>
              Tiến hành đặt hàng
            </button>
            <p className="mt-2.5 flex items-start gap-1.5 text-xs text-slate-500">
              <TriangleAlert className="mt-px size-3.5 shrink-0 text-gold-600" />
              Vui lòng xử lý các sản phẩm đang có cảnh báo trong giỏ trước khi đặt hàng.
            </p>
          </>
        ) : status === "authenticated" ? (
          <Link href={CHECKOUT_PATH} className={ctaClass}>
            Tiến hành đặt hàng
            <ArrowRight className="size-4.5" />
          </Link>
        ) : (
          <>
            <Link href={authHref("/dang-nhap", CHECKOUT_PATH)} className={ctaClass}>
              Đăng nhập để đặt hàng
              <ArrowRight className="size-4.5" />
            </Link>
            <p className="mt-2.5 text-center text-xs text-slate-500">
              Chưa có tài khoản?{" "}
              <Link
                href={authHref("/dang-ky", CHECKOUT_PATH)}
                className="font-semibold text-brand-600 hover:underline"
              >
                Đăng ký
              </Link>
              . Giỏ hàng của bạn sẽ được giữ nguyên.
            </p>
          </>
        )}
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 border-t border-slate-100 pt-4 text-[11px] text-slate-500">
        <ShieldCheck className="size-3.5 text-emerald-500" />
        100% chính hãng — đổi trả trong 30 ngày
      </p>
    </aside>
  );
}
