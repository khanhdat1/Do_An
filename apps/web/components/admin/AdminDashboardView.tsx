"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Banknote,
  Clock,
  CloudOff,
  Download,
  LoaderCircle,
  PackageCheck,
  ShieldAlert,
  ShoppingCart,
  TriangleAlert,
  Users,
} from "lucide-react";
import AdminBadge from "@/components/admin/AdminBadge";
import ProductThumb from "@/components/product/ProductThumb";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { adminApiFetch, downloadAdminFile, errorMessage } from "@/lib/admin-api-client";
import { formatCompactPrice, formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE } from "@/lib/data/orders";
import type { AdminDashboardSummary, DashboardGranularity } from "@/types";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: AdminDashboardSummary };

const GRANULARITY_OPTIONS: { value: DashboardGranularity; label: string }[] = [
  { value: "day", label: "Ngày" },
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
  { value: "year", label: "Năm" },
];

/** "2026-09-23T00:00:00.000Z" -> "2026-09-23" cho input type=date */
function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "slate",
  hint,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
  tone?: "brand" | "green" | "amber" | "blue" | "slate";
  hint?: string;
}) {
  const toneClass: Record<string, string> = {
    brand: "bg-brand-500/10 text-brand-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
    slate: "bg-slate-100 text-slate-500",
  };

  return (
    <div className="admin-card p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${toneClass[tone]}`}>
          <Icon className="size-5.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
          <p className="truncate text-xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
      {hint ? <p className="mt-2 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export default function AdminDashboardView() {
  const { user } = useAdminAuth();
  const toast = useToast();
  const [granularity, setGranularity] = useState<DashboardGranularity>("day");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [state, setState] = useState<State>({ status: "loading" });
  const [exporting, setExporting] = useState(false);

  const allowedRead = user ? user.permissions.includes("reports:read") : null;

  useEffect(() => {
    if (!allowedRead) return;
    let cancelled = false;

    const query = new URLSearchParams({ granularity });
    if (from) query.set("from", from);
    if (to) query.set("to", to);

    adminApiFetch<AdminDashboardSummary>(`/api/admin/dashboard/summary?${query}`)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [allowedRead, granularity, from, to]);

  async function exportReport() {
    const query = new URLSearchParams({ granularity });
    if (from) query.set("from", from);
    if (to) query.set("to", to);

    setExporting(true);
    try {
      await downloadAdminFile(`/api/admin/dashboard/export?${query}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  function changeGranularity(next: DashboardGranularity) {
    setGranularity(next);
    setFrom(null);
    setTo(null);
    setState({ status: "loading" });
  }

  function changeFrom(next: string) {
    setFrom(next);
    setState({ status: "loading" });
  }

  function changeTo(next: string) {
    setTo(next);
    setState({ status: "loading" });
  }

  if (!user || allowedRead === null) {
    return (
      <div className="admin-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải...
      </div>
    );
  }

  if (!allowedRead) {
    return (
      <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-sale-500/10 text-sale-600">
          <ShieldAlert className="size-8" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">Trang tổng quan chỉ dành cho chủ website/quản lý.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="admin-card flex flex-wrap items-center gap-3 p-3">
        <div className="flex gap-1.5">
          {GRANULARITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => changeGranularity(option.value)}
              className={`rounded-lg px-3.5 py-2 text-sm font-bold transition ${
                granularity === option.value ? "bg-brand-500 text-white shadow-sm shadow-brand-500/30" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {state.status === "ready" ? (
          <div className="ml-auto flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <label className="flex items-center gap-1.5">
              Từ
              <input
                type="date"
                value={from ?? toDateInputValue(state.data.range.from)}
                onChange={(event) => changeFrom(event.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
              />
            </label>
            <label className="flex items-center gap-1.5">
              Đến
              <input
                type="date"
                value={to ?? toDateInputValue(state.data.range.to)}
                onChange={(event) => changeTo(event.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
              />
            </label>
            <button
              type="button"
              onClick={exportReport}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-bold text-slate-600 transition hover:border-brand-300 hover:bg-brand-500/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
              {exporting ? "Đang xuất..." : "Xuất báo cáo Excel"}
            </button>
          </div>
        ) : null}
      </div>

      {state.status === "loading" ? (
        <div className="admin-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
          <LoaderCircle className="size-4.5 animate-spin" />
          Đang tải...
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
          <CloudOff className="size-8 text-slate-400" />
          <p className="mt-3 text-sm text-slate-500">Không tải được số liệu tổng quan. Vui lòng tải lại trang.</p>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard icon={Banknote} label="Doanh thu thuần" value={formatCompactPrice(state.data.revenue.netRevenue)} tone="brand" />
            <StatCard icon={ShoppingCart} label="Đơn hàng" value={formatCompactPrice(state.data.orderCount)} tone="blue" />
            <StatCard icon={PackageCheck} label="Sản phẩm đã bán" value={formatCompactPrice(state.data.productsSoldCount)} tone="green" />
            <StatCard icon={Clock} label="Đang chờ xử lý" value={String(state.data.pendingOrderCount)} tone="amber" hint="Tính tới hiện tại" />
            <StatCard icon={Users} label="Tổng khách hàng" value={formatCompactPrice(state.data.totalCustomers)} tone="slate" hint="Luỹ kế" />
          </div>

          <section className="admin-card p-4 sm:p-5">
            <h2 className="text-base font-bold text-slate-900">Doanh thu trong kỳ</h2>
            <p className="mt-1 text-xs text-slate-500">
              Cách tính: <strong>Tổng giá trị đơn</strong> = mọi đơn đặt trong kỳ (kể cả đơn huỷ/chưa thanh toán) ·{" "}
              <strong>Đã thanh toán</strong> = tiền thực nhận trong kỳ · <strong>Đã hoàn</strong> = tiền trả lại khách trong kỳ ·{" "}
              <strong>Doanh thu thuần</strong> = Đã thanh toán − Đã hoàn. Đơn huỷ hoặc chưa thanh toán không được tính vào doanh thu.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Tổng giá trị đơn</p>
                <p className="text-lg font-bold text-slate-800">{formatPrice(state.data.revenue.grossOrderValue)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Đã thanh toán</p>
                <p className="text-lg font-bold text-emerald-600">{formatPrice(state.data.revenue.paidAmount)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Đã hoàn</p>
                <p className="text-lg font-bold text-sale-600">{formatPrice(state.data.revenue.refundedAmount)}</p>
              </div>
              <div className="rounded-xl bg-brand-500/10 p-3">
                <p className="text-xs text-slate-500">Doanh thu thuần</p>
                <p className="text-lg font-bold text-brand-600">{formatPrice(state.data.revenue.netRevenue)}</p>
              </div>
            </div>

            <div className="mt-4 h-64 w-full">
              {state.data.chart.every((point) => point.netRevenue === 0) ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">Chưa có doanh thu nào trong kỳ này.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={state.data.chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-brand-500)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-brand-500)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                    <YAxis tickFormatter={formatCompactPrice} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip
                      formatter={(value) => formatPrice(Number(value))}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                    />
                    <Area type="monotone" dataKey="netRevenue" name="Doanh thu thuần" stroke="var(--color-brand-500)" strokeWidth={2} fill="url(#revenueFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="admin-card p-4 sm:p-5">
              <h2 className="mb-3 text-base font-bold text-slate-900">Sản phẩm bán chạy (trong kỳ)</h2>
              {state.data.bestSellers.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Chưa có đơn nào bán ra trong kỳ này.</p>
              ) : (
                <ul className="space-y-3">
                  {state.data.bestSellers.map((product) => (
                    <li key={product.productId} className="flex items-center gap-3">
                      <div className="w-11 shrink-0">
                        <ProductThumb name={product.name} image={product.image} sizes="44px" />
                      </div>
                      <Link href={`/admin/products/${product.productId}`} className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-semibold text-slate-800 hover:text-brand-600">{product.name}</p>
                      </Link>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        Đã bán {product.quantitySold}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="admin-card p-4 sm:p-5">
              <h2 className="mb-3 text-base font-bold text-slate-900">Sắp hết hàng</h2>
              {state.data.lowStock.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Không có sản phẩm nào sắp hết hàng.</p>
              ) : (
                <ul className="space-y-3">
                  {state.data.lowStock.map((product) => (
                    <li key={product.productId} className="flex items-center gap-3">
                      <div className="w-11 shrink-0">
                        <ProductThumb name={product.name} image={product.image} sizes="44px" />
                      </div>
                      <Link href={`/admin/products/${product.productId}`} className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-semibold text-slate-800 hover:text-brand-600">{product.name}</p>
                        <p className="text-xs text-slate-400">Ngưỡng cảnh báo: {product.lowStockThreshold}</p>
                      </Link>
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-sale-500/10 px-2.5 py-1 text-xs font-bold text-sale-600">
                        <TriangleAlert className="size-3.5" />
                        Còn {product.inventoryQuantity}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="admin-card overflow-x-auto">
            <h2 className="px-4 pt-4 text-base font-bold text-slate-900 sm:px-5 sm:pt-5">Đơn hàng gần đây</h2>
            {state.data.recentOrders.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400 sm:px-5">Chưa có đơn hàng nào.</p>
            ) : (
              <table className="mt-3 w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2.5 font-semibold sm:px-5">Mã đơn</th>
                    <th className="px-4 py-2.5 font-semibold sm:px-5">Người nhận</th>
                    <th className="px-4 py-2.5 font-semibold sm:px-5">Số tiền</th>
                    <th className="px-4 py-2.5 font-semibold sm:px-5">Trạng thái</th>
                    <th className="px-4 py-2.5 font-semibold sm:px-5">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.data.recentOrders.map((order) => (
                    <tr key={order.orderCode} className="transition hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-bold text-slate-800 sm:px-5">
                        <Link href={`/admin/orders/${order.orderCode}`} className="hover:text-brand-600 hover:underline">
                          {order.orderCode}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 sm:px-5">{order.recipientName}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-800 sm:px-5">{formatPrice(order.totalAmount)}</td>
                      <td className="px-4 py-2.5 sm:px-5">
                        <div className="flex flex-col items-start gap-1">
                          <AdminBadge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</AdminBadge>
                          <AdminBadge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</AdminBadge>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 sm:px-5">{formatDateTime(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="h-4" />
          </section>
        </>
      ) : null}
    </div>
  );
}
