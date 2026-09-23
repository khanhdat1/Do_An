"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import AdminBadge from "@/components/admin/AdminBadge";
import { useToast } from "@/components/providers/ToastProvider";
import { adminApiFetch, errorMessage } from "@/lib/admin-api-client";
import { INVENTORY_TX_LABEL, INVENTORY_TX_TONE } from "@/lib/data/product-status";
import type { AdminProductDetail, InventoryAdjustmentInput, InventoryTransaction, Paginated } from "@/types";

const PAGE_SIZE = 10;
type AdjustType = InventoryAdjustmentInput["type"];

const TYPE_OPTIONS: { value: AdjustType; label: string }[] = [
  { value: "IMPORT", label: "Nhập kho" },
  { value: "EXPORT", label: "Xuất kho" },
  { value: "ADJUST", label: "Điều chỉnh theo kiểm kê" },
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function AdjustmentForm({ product, onAdjusted }: { product: AdminProductDetail; onAdjusted: (product: AdminProductDetail) => void }) {
  const toast = useToast();
  const [type, setType] = useState<AdjustType>("IMPORT");
  const [quantity, setQuantity] = useState("");
  const [newQuantity, setNewQuantity] = useState(String(product.inventoryQuantity));
  const [unitCost, setUnitCost] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      let body: InventoryAdjustmentInput;
      if (type === "IMPORT") {
        body = { type: "IMPORT", quantity: Number(quantity), unitCost: unitCost ? Number(unitCost) : undefined, note: note.trim() || undefined };
      } else if (type === "EXPORT") {
        body = { type: "EXPORT", quantity: Number(quantity), note: note.trim() || undefined };
      } else {
        body = { type: "ADJUST", newQuantity: Number(newQuantity), note: note.trim() || undefined };
      }

      const updated = await adminApiFetch<AdminProductDetail>(`/api/admin/products/${product.id}/inventory`, { method: "POST", body });
      onAdjusted(updated);
      toast.success("Đã ghi nhận thay đổi tồn kho");
      setQuantity("");
      setUnitCost("");
      setNote("");
      setNewQuantity(String(updated.inventoryQuantity));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-slate-100 pt-4">
      <div className="flex gap-2">
        {TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setType(option.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              type === option.value ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {type === "ADJUST" ? (
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Số lượng đếm được thực tế</label>
          <input
            type="number"
            min={0}
            required
            value={newQuantity}
            onChange={(event) => setNewQuantity(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
          <p className="mt-1 text-xs text-slate-400">
            Tồn kho hiện ghi nhận: {product.inventoryQuantity}. Hệ thống tự tính chênh lệch, không cần tự trừ.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Số lượng</label>
            <input
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          {type === "IMPORT" ? (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Giá nhập / đơn vị (không bắt buộc)</label>
              <input
                type="number"
                min={0}
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          ) : null}
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Ghi chú (không bắt buộc)</label>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Vd. nhập từ nhà cung cấp X, kiểm kê định kỳ..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {busy ? "Đang lưu..." : "Ghi nhận"}
      </button>
    </form>
  );
}

export default function AdminProductInventoryPanel({
  product,
  onUpdated,
  canWrite,
}: {
  product: AdminProductDetail;
  onUpdated: (product: AdminProductDetail) => void;
  canWrite: boolean;
}) {
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<Paginated<InventoryTransaction> | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    adminApiFetch<Paginated<InventoryTransaction>>(`/api/admin/products/${product.id}/inventory?page=${page}&pageSize=${PAGE_SIZE}`)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [product.id, page, refreshTick]);

  const available = product.inventoryQuantity - product.reservedQuantity;

  return (
    <section className="admin-card p-4 sm:p-5">
      <h2 className="text-base font-bold text-slate-900">Tồn kho</h2>
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-2xl font-bold text-slate-800">{product.inventoryQuantity}</p>
          <p className="text-xs text-slate-500">Tồn kho</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-2xl font-bold text-slate-800">{product.reservedQuantity}</p>
          <p className="text-xs text-slate-500">Đang giữ chỗ</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className={`text-2xl font-bold ${available <= product.lowStockThreshold ? "text-sale-600" : "text-slate-800"}`}>{available}</p>
          <p className="text-xs text-slate-500">Còn bán được</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">Ngưỡng cảnh báo sắp hết hàng: {product.lowStockThreshold} (sửa ở form thông tin sản phẩm phía trên)</p>

      {canWrite ? (
        <AdjustmentForm
          product={product}
          onAdjusted={(updated) => {
            onUpdated(updated);
            setRefreshTick((tick) => tick + 1);
          }}
        />
      ) : null}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <h3 className="mb-2 text-sm font-bold text-slate-700">Lịch sử nhập/xuất/điều chỉnh</h3>
        {!history ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
            <LoaderCircle className="size-4 animate-spin" />
            Đang tải...
          </div>
        ) : history.items.length === 0 ? (
          <p className="py-4 text-sm text-slate-400">Chưa có giao dịch kho nào.</p>
        ) : (
          <div className="space-y-2">
            {history.items.map((tx) => (
              <div key={tx.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-2.5 text-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminBadge tone={INVENTORY_TX_TONE[tx.type]}>{INVENTORY_TX_LABEL[tx.type]}</AdminBadge>
                    <span className={`font-bold ${tx.quantityChange >= 0 ? "text-emerald-600" : "text-sale-600"}`}>
                      {tx.quantityChange >= 0 ? "+" : ""}
                      {tx.quantityChange}
                    </span>
                    <span className="text-xs text-slate-400">→ còn {tx.quantityAfter}</span>
                  </div>
                  {tx.note ? <p className="mt-1 text-xs text-slate-500">{tx.note}</p> : null}
                  {tx.orderCode ? (
                    <Link href={`/admin/orders/${tx.orderCode}`} className="mt-1 block text-xs font-semibold text-brand-600 hover:underline">
                      Đơn {tx.orderCode}
                    </Link>
                  ) : null}
                </div>
                <div className="shrink-0 text-right text-xs text-slate-400">
                  <p>{formatDateTime(tx.createdAt)}</p>
                  {tx.createdByName ? <p>{tx.createdByName}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {history && history.totalPages > 1 ? (
          <div className="mt-3 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs text-slate-500">
              {history.page}/{history.totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= history.totalPages}
              className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
