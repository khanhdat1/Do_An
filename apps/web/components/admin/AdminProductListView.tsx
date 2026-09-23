"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CloudOff, LoaderCircle, PackageSearch, Plus, ShieldAlert, TriangleAlert } from "lucide-react";
import AdminBadge from "@/components/admin/AdminBadge";
import ProductThumb from "@/components/product/ProductThumb";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { adminApiFetch } from "@/lib/admin-api-client";
import { formatPrice } from "@/lib/format";
import { PRODUCT_STATUS_LABEL, PRODUCT_STATUS_TONE } from "@/lib/data/product-status";
import type { AdminProductSummary, Paginated, ProductStatus } from "@/types";

const PAGE_SIZE = 20;
const STATUS_FILTER_OPTIONS: (ProductStatus | "ALL")[] = ["ALL", "DRAFT", "ACTIVE", "HIDDEN", "DISCONTINUED"];

type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: Paginated<AdminProductSummary> };

export default function AdminProductListView() {
  const { user } = useAdminAuth();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "ALL">("ALL");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<State>({ status: "loading" });

  const allowedRead = user ? user.permissions.includes("products:read") : null;
  const canWrite = user ? user.permissions.includes("products:write") : false;

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
    setState({ status: "loading" });
  }

  function changeStatus(next: ProductStatus | "ALL") {
    setStatusFilter(next);
    setPage(1);
    setState({ status: "loading" });
  }

  function toggleLowStock() {
    setLowStockOnly((current) => !current);
    setPage(1);
    setState({ status: "loading" });
  }

  function goToPage(next: number) {
    setPage(next);
    setState({ status: "loading" });
  }

  useEffect(() => {
    if (!allowedRead) return;
    let cancelled = false;

    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search) query.set("search", search);
    if (statusFilter !== "ALL") query.set("status", statusFilter);
    if (lowStockOnly) query.set("lowStockOnly", "true");

    adminApiFetch<Paginated<AdminProductSummary>>(`/api/admin/products?${query}`)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [allowedRead, search, statusFilter, lowStockOnly, page]);

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
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">Trang này chỉ dành cho nhân viên/quản trị viên.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="admin-card flex flex-wrap items-center gap-3 p-3">
        <form onSubmit={submitSearch} className="flex min-w-0 flex-1 items-center gap-2">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Tìm theo tên hoặc mã SKU..."
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:bg-white"
          />
          <button type="submit" className="rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-slate-900">
            Tìm
          </button>
        </form>

        <select
          value={statusFilter}
          onChange={(event) => changeStatus(event.target.value as ProductStatus | "ALL")}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
        >
          {STATUS_FILTER_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value === "ALL" ? "Mọi trạng thái" : PRODUCT_STATUS_LABEL[value]}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <input type="checkbox" checked={lowStockOnly} onChange={toggleLowStock} className="size-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500/30" />
          Sắp hết hàng
        </label>

        {canWrite ? (
          <Link
            href="/admin/products/new"
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600"
          >
            <Plus className="size-4" />
            Thêm sản phẩm
          </Link>
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
          <p className="mt-3 text-sm text-slate-500">Không tải được danh sách sản phẩm. Vui lòng tải lại trang.</p>
        </div>
      ) : null}

      {state.status === "ready" && state.data.items.length === 0 ? (
        <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-slate-100 text-slate-400">
            <PackageSearch className="size-8" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-800">Không tìm thấy sản phẩm nào</h2>
        </div>
      ) : null}

      {state.status === "ready" && state.data.items.length > 0 ? (
        <div className="admin-card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-semibold">Sản phẩm</th>
                <th className="px-4 py-3 font-semibold">Danh mục</th>
                <th className="px-4 py-3 font-semibold">Giá bán</th>
                <th className="px-4 py-3 font-semibold">Tồn kho</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.data.items.map((product) => (
                <tr key={product.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/products/${product.id}`} className="flex items-center gap-3">
                      <div className="w-11 shrink-0">
                        <ProductThumb name={product.name} image={product.image} sizes="44px" />
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-1 font-bold text-slate-800 hover:text-brand-600">{product.name}</p>
                        <p className="text-xs text-slate-500">
                          {product.sku}
                          {product.brand ? ` · ${product.brand}` : ""}
                        </p>
                      </div>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{product.categoryName}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-bold text-slate-800">{formatPrice(product.sellingPrice)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className={product.lowStock ? "flex items-center gap-1 font-bold text-sale-600" : "text-slate-700"}>
                      {product.lowStock ? <TriangleAlert className="size-3.5" /> : null}
                      {product.inventoryQuantity}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <AdminBadge tone={PRODUCT_STATUS_TONE[product.status]}>{PRODUCT_STATUS_LABEL[product.status]}</AdminBadge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <Link href={`/admin/products/${product.id}`} className="text-xs font-bold text-brand-600 hover:underline">
                      {canWrite ? "Sửa" : "Xem"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {state.status === "ready" && state.data.totalPages > 1 ? (
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
            Trang {state.data.page} / {state.data.totalPages} · {state.data.total} sản phẩm
          </span>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= state.data.totalPages}
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
