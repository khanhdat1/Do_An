"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgePercent, CloudOff, Cpu, Heart, Package, PackageSearch, ShoppingCart, Wallet, Wrench } from "lucide-react";
import OrderProgress from "@/components/orders/OrderProgress";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AccountSummary } from "@/types";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; summary: AccountSummary };

/** "22 thg 9, 2026" */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "numeric", month: "short", year: "numeric" });
}

interface StatCardProps {
  icon: typeof Package;
  label: string;
  value: string;
  hint: string;
  href?: string;
  accent?: boolean;
}

function StatCard({ icon: Icon, label, value, hint, href, accent }: StatCardProps) {
  const body = (
    <>
      <span className={cn("grid size-9 place-items-center rounded-xl", accent ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-500")}>
        <Icon className="size-4.5" aria-hidden />
      </span>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 truncate font-display text-xl font-bold text-slate-900 sm:text-2xl">{value}</p>
      <p className="mt-0.5 truncate text-xs text-slate-500">{hint}</p>
    </>
  );
  return href ? (
    <Link href={href} className="surface-card block p-4 transition hover:border-brand-300 hover:shadow-md">
      {body}
    </Link>
  ) : (
    <div className="surface-card p-4">{body}</div>
  );
}

const QUICK_LINKS = [
  { href: "/gio-hang", label: "Giỏ hàng", icon: ShoppingCart },
  { href: "/ai-build-pc", label: "Build PC", icon: Cpu },
  { href: "/khuyen-mai", label: "Mã khuyến mãi", icon: BadgePercent },
  { href: "/tra-cuu-don-hang", label: "Tra cứu đơn hàng", icon: PackageSearch },
] as const;

/**
 * Phần bảng điều khiển của trang Tài khoản: thẻ số liệu, đơn gần đây, lối tắt. Mọi con số lấy từ
 * `GET /api/account/summary` (số liệu thật của chính tài khoản) — không có số minh hoạ hay hạng thành viên giả.
 */
export default function AccountOverview({ userId, cartCount }: { userId: string; cartCount: number }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    apiFetch<AccountSummary>("/api/account/summary")
      .then((summary) => {
        if (!cancelled) setState({ status: "ready", summary });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="space-y-5">
      <section aria-label="Số liệu tài khoản">
        {state.status === "ready" ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={Package}
              label="Đơn hàng"
              value={String(state.summary.orders.total)}
              hint={state.summary.orders.processing > 0 ? `${state.summary.orders.processing} đơn đang xử lý` : "Không có đơn đang xử lý"}
              href="/tai-khoan/don-hang"
              accent
            />
            <StatCard icon={Wallet} label="Tổng chi tiêu" value={formatPrice(state.summary.totalSpent)} hint="Các đơn đã thanh toán" />
            <StatCard icon={Heart} label="Yêu thích" value={String(state.summary.wishlistCount)} hint="sản phẩm đã lưu" href="/yeu-thich" />
            <StatCard icon={Wrench} label="Cấu hình PC" value={String(state.summary.savedBuildCount)} hint="cấu hình đã lưu" href="/tai-khoan/cau-hinh" />
          </div>
        ) : state.status === "loading" ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy>
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="surface-card h-[134px] animate-pulse bg-slate-50" />
            ))}
          </div>
        ) : (
          <p className="surface-card flex items-center gap-2 p-4 text-sm text-slate-500">
            <CloudOff className="size-4.5 shrink-0 text-slate-500" aria-hidden />
            Không tải được số liệu tài khoản. Vui lòng tải lại trang.
          </p>
        )}
      </section>

      <section className="surface-card p-4 sm:p-5" aria-labelledby="recent-orders-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent-orders-title" className="text-base font-bold text-slate-900">
            Đơn hàng gần đây
          </h2>
          {state.status === "ready" && state.summary.orders.total > 0 ? (
            <Link href="/tai-khoan/don-hang" className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline">
              Xem tất cả
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>

        {state.status === "ready" ? (
          state.summary.recentOrders.length > 0 ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {state.summary.recentOrders.map((order) => (
                <li key={order.orderCode}>
                  <Link href={`/don-hang/${order.orderCode}`} className="block py-3.5 transition hover:bg-slate-50/60">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800">{order.orderCode}</span>
                        <OrderStatusBadge status={order.status} />
                      </div>
                      <span className="font-display text-sm font-bold text-sale-600">{formatPrice(order.totalAmount)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatDate(order.createdAt)} · {order.itemCount} sản phẩm
                    </p>
                    <OrderProgress status={order.status} size="sm" className="mt-3" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 flex flex-col items-center rounded-xl bg-slate-50 px-4 py-8 text-center">
              <Package className="size-7 text-slate-300" aria-hidden />
              <p className="mt-2 text-sm text-slate-500">Bạn chưa có đơn hàng nào.</p>
              <Link
                href="/"
                className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
              >
                Mua sắm ngay
              </Link>
            </div>
          )
        ) : state.status === "loading" ? (
          <div className="mt-3 space-y-3" aria-busy>
            {[0, 1].map((index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-50" />
            ))}
          </div>
        ) : null}
      </section>

      <section aria-label="Lối tắt" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="surface-card flex items-center gap-2.5 p-3.5 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-600"
          >
            <Icon className="size-4.5 shrink-0 text-brand-500" aria-hidden />
            <span className="min-w-0 truncate">
              {label}
              {href === "/gio-hang" && cartCount > 0 ? <span className="ml-1 text-xs text-slate-500">({cartCount})</span> : null}
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
