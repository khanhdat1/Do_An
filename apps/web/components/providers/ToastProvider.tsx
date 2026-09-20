"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

interface ToastAction {
  label: string;
  href: string;
}

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
}

interface ToastApi {
  success: (message: string, action?: ToastAction) => void;
  error: (message: string) => void;
  /** Thông tin trung tính, không phải thành công hay lỗi (tính năng chưa có, gợi ý...) */
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Số thông báo hiển thị cùng lúc; cái cũ nhất bị đẩy đi khi vượt quá */
const MAX_VISIBLE = 3;
const DURATION_MS: Record<ToastTone, number> = { success: 4000, error: 6000, info: 6000 };

const TONE_RING: Record<ToastTone, string> = {
  success: "ring-emerald-500/30",
  error: "ring-sale-500/30",
  info: "ring-blue-500/30",
};

/**
 * Thông báo nổi ở góc màn hình (thêm giỏ hàng thành công, lỗi mạng...).
 * Bọc ngoài cùng trong `AppProviders`; component nào cũng gọi được qua `useToast()`.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string, action?: ToastAction) => {
      const id = ++nextId.current;
      setToasts((current) => [...current, { id, tone, message, action }].slice(-MAX_VISIBLE));
      window.setTimeout(() => dismiss(id), DURATION_MS[tone]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, action) => push("success", message, action),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-100 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={cn(
              "animate-toast-in pointer-events-auto flex items-start gap-3 rounded-xl bg-white p-3.5 shadow-xl shadow-slate-900/15 ring-1",
              TONE_RING[toast.tone],
            )}
          >
            {toast.tone === "error" ? (
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-sale-600" />
            ) : toast.tone === "info" ? (
              <Info className="mt-0.5 size-5 shrink-0 text-blue-500" />
            ) : (
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" />
            )}

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug text-slate-800">{toast.message}</p>
              {toast.action ? (
                <Link
                  href={toast.action.href}
                  onClick={() => dismiss(toast.id)}
                  className="mt-1 inline-block text-xs font-bold text-brand-600 hover:underline"
                >
                  {toast.action.label}
                </Link>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Đóng thông báo"
              className="-m-1 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast phải được dùng bên trong <ToastProvider>");
  return context;
}
