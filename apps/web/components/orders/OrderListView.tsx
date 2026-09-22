"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CloudOff, LoaderCircle, PackageSearch } from "lucide-react";
import ProductThumb from "@/components/product/ProductThumb";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/data/orders";
import type { OrderSummary, Paginated } from "@/types";

const PAGE_SIZE = 10;

type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: Paginated<OrderSummary> };

/** "22 thg 9, 2026" */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "numeric", month: "short", year: "numeric" });
}

function OrderCard({ order }: { order: OrderSummary }) {
  return (
    <Link
      href={`/don-hang/${order.orderCode}`}
      className="surface-card flex items-center gap-4 p-4 transition hover:border-brand-300 hover:shadow-md"
    >
      <div className="flex shrink-0 -space-x-3">
        {order.previewItems.map((item, index) => (
          <ProductThumb
            key={index}
            name={item.name}
            image={item.image}
            sizes="56px"
            className="aspect-square size-14 w-14 shrink-0 ring-2 ring-white"
          />
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-800">{order.orderCode}</p>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {formatDate(order.createdAt)} · {order.itemCount} sản phẩm · {PAYMENT_METHOD_LABEL[order.paymentMethod]}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-display text-lg font-bold text-sale-600">{formatPrice(order.totalAmount)}</p>
      </div>
    </Link>
  );
}

/** Danh sách đơn hàng của tài khoản, mới nhất trước — trang `/tai-khoan/don-hang` */
export default function OrderListView() {
  const [page, setPage] = useState(1);
  const [state, setState] = useState<State>({ status: "loading" });

  // Đổi trang: state chuyển về "loading" ngay trong sự kiện bấm nút, KHÔNG phải ở đầu effect bên dưới
  // (setState đồng bộ ngay lúc effect chạy bị lint react-hooks/set-state-in-effect chặn) — xem nút Trước/Sau.
  function goToPage(next: number) {
    setPage(next);
    setState({ status: "loading" });
  }

  useEffect(() => {
    let cancelled = false;

    apiFetch<Paginated<OrderSummary>>(`/api/orders?page=${page}&pageSize=${PAGE_SIZE}`)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [page]);

  if (state.status === "loading") {
    return (
      <div className="surface-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải danh sách đơn hàng...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
        <CloudOff className="size-8 text-slate-400" />
        <p className="mt-3 text-sm text-slate-500">Không tải được danh sách đơn hàng. Vui lòng tải lại trang.</p>
      </div>
    );
  }

  const { data } = state;

  if (data.items.length === 0 && page === 1) {
    return (
      <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-slate-100 text-slate-400">
          <PackageSearch className="size-8" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-slate-800">Bạn chưa có đơn hàng nào</h2>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">Đơn hàng sau khi đặt sẽ hiện ở đây.</p>
        <Link
          href="/"
          className="mt-6 rounded-xl bg-brand-500 px-6 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
        >
          Tiếp tục mua sắm
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.items.map((order) => (
        <OrderCard key={order.orderCode} order={order} />
      ))}

      {data.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="size-4" />
            Trước
          </button>
          <span className="text-sm text-slate-500">
            Trang {data.page} / {data.totalPages}
          </span>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= data.totalPages}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sau
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
