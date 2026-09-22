"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Heart, LogOut, Package, ShieldCheck, ShoppingCart, UserRound } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useWishlist } from "@/components/providers/WishlistProvider";
import Avatar from "@/components/ui/Avatar";
import { errorMessage } from "@/lib/api-client";

const BUTTON_CLASS =
  "grid size-10 place-items-center rounded-xl bg-brand-500 text-white transition hover:bg-brand-600";

/**
 * Nút tài khoản trên header.
 * - Chưa đăng nhập (hoặc đang kiểm tra): liên kết tới trang đăng nhập.
 * - Đã đăng nhập: avatar chữ cái đầu, bấm để mở menu tài khoản / đăng xuất.
 */
export default function UserMenu() {
  const { status, user, logout } = useAuth();
  const { cart } = useCart();
  const { productIds } = useWishlist();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
      setOpen(false);
      toast.success("Bạn đã đăng xuất");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (status !== "authenticated" || !user) {
    return (
      <Link href="/dang-nhap" aria-label="Đăng nhập" className={BUTTON_CLASS}>
        <UserRound className="size-5" />
      </Link>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="user-menu"
        aria-label={`Tài khoản của ${user.fullName}`}
        className={`${BUTTON_CLASS} overflow-hidden text-xs`}
      >
        <Avatar name={user.fullName} src={user.avatarUrl} className="size-full" />
      </button>

      {open ? (
        <div
          id="user-menu"
          className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-xl bg-white text-slate-700 shadow-xl shadow-black/20 ring-1 ring-black/5"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-bold text-slate-900">{user.fullName}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>

          <div className="p-1.5 text-sm">
            <Link
              href="/tai-khoan"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium transition hover:bg-slate-100"
            >
              <UserRound className="size-4 text-slate-400" />
              Tài khoản của tôi
            </Link>
            <Link
              href="/tai-khoan/don-hang"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium transition hover:bg-slate-100"
            >
              <Package className="size-4 text-slate-400" />
              Đơn hàng của tôi
            </Link>
            <Link
              href="/yeu-thich"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium transition hover:bg-slate-100"
            >
              <Heart className="size-4 text-slate-400" />
              Sản phẩm yêu thích
              {productIds.size > 0 ? (
                <span className="ml-auto rounded-full bg-sale-600 px-1.5 text-[10px] font-bold text-white">
                  {productIds.size}
                </span>
              ) : null}
            </Link>
            <Link
              href="/gio-hang"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium transition hover:bg-slate-100"
            >
              <ShoppingCart className="size-4 text-slate-400" />
              Giỏ hàng
              {cart.itemCount > 0 ? (
                <span className="ml-auto rounded-full bg-sale-600 px-1.5 text-[10px] font-bold text-white">
                  {cart.itemCount}
                </span>
              ) : null}
            </Link>
          </div>

          {user.role === "ADMIN" || user.role === "STAFF" ? (
            <div className="border-t border-slate-100 p-1.5 text-sm">
              <Link
                href="/quan-tri/don-hang"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium transition hover:bg-slate-100"
              >
                <ShieldCheck className="size-4 text-slate-400" />
                Quản trị đơn hàng
              </Link>
            </div>
          ) : null}

          <div className="border-t border-slate-100 p-1.5 text-sm">
            <button
              type="button"
              onClick={handleLogout}
              disabled={busy}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-sale-600 transition hover:bg-sale-500/10 disabled:opacity-60"
            >
              <LogOut className="size-4" />
              {busy ? "Đang đăng xuất..." : "Đăng xuất"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
