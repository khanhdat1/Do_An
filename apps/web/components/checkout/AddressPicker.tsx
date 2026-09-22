"use client";

import { useEffect, useState } from "react";
import { CirclePlus, CloudOff, LoaderCircle } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { apiFetch, errorMessage } from "@/lib/api-client";
import AddressCard from "./AddressCard";
import AddressForm from "./AddressForm";
import type { Address } from "@/types";

type Loaded = { status: "loading" } | { status: "error" } | { status: "ready"; items: Address[] };

interface AddressPickerProps {
  /** Id địa chỉ đang chọn để giao hàng — quản lý ở component cha vì lúc đặt hàng cần đọc giá trị này */
  value: string | null;
  onChange: (addressId: string) => void;
}

/** Sổ địa chỉ ở bước đặt hàng: chọn một địa chỉ đã lưu, hoặc mở form thêm mới (tự lưu vào sổ) */
export default function AddressPicker({ value, onChange }: AddressPickerProps) {
  const toast = useToast();
  const [state, setState] = useState<Loaded>({ status: "loading" });
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ items: Address[] }>("/api/addresses")
      .then(({ items }) => {
        if (cancelled) return;
        setState({ status: "ready", items });
        if (items.length === 0) {
          setShowForm(true);
        } else if (!value) {
          onChange((items.find((address) => address.isDefault) ?? items[0]).id);
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ tải một lần lúc mở trang, không tải lại theo value/onChange
  }, []);

  function handleCreated(address: Address) {
    setState((current) => ({
      status: "ready",
      items: current.status === "ready" ? [address, ...current.items] : [address],
    }));
    onChange(address.id);
    setShowForm(false);
    toast.success("Đã lưu địa chỉ mới");
  }

  async function handleDelete(addressId: string) {
    if (state.status !== "ready") return;
    setDeletingId(addressId);
    try {
      await apiFetch(`/api/addresses/${addressId}`, { method: "DELETE" });
      const remaining = state.items.filter((address) => address.id !== addressId);
      setState({ status: "ready", items: remaining });
      if (value === addressId) {
        const next = remaining.find((address) => address.isDefault) ?? remaining[0];
        if (next) onChange(next.id);
        else setShowForm(true);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải sổ địa chỉ...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-sale-600">
        <CloudOff className="size-4.5" />
        Không tải được sổ địa chỉ. Vui lòng tải lại trang.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {state.items.length > 0 ? (
        <div role="radiogroup" aria-label="Chọn địa chỉ giao hàng" className="space-y-2.5">
          {state.items.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              selected={value === address.id}
              onSelect={() => onChange(address.id)}
              onDelete={() => handleDelete(address.id)}
              deleting={deletingId === address.id}
            />
          ))}
        </div>
      ) : null}

      {showForm ? (
        <AddressForm
          isFirstAddress={state.items.length === 0}
          onCreated={handleCreated}
          onCancel={state.items.length > 0 ? () => setShowForm(false) : undefined}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm font-semibold text-brand-600 transition hover:text-brand-700"
        >
          <CirclePlus className="size-4.5" />
          Thêm địa chỉ mới
        </button>
      )}
    </div>
  );
}
