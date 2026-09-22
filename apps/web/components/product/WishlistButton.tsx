"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useWishlist } from "@/components/providers/WishlistProvider";
import { errorMessage } from "@/lib/api-client";
import { authHref } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface WishlistButtonProps {
  productId: string;
  name: string;
  /**
   * "overlay": nút tròn nhỏ đè lên góc ảnh (ProductCard).
   * "panel": nút vuông cùng hàng với "Thêm vào giỏ" (trang chi tiết).
   */
  variant?: "overlay" | "panel";
  className?: string;
}

/** Nút trái tim thêm/xoá sản phẩm yêu thích — dùng chung ở thẻ sản phẩm và trang chi tiết */
export default function WishlistButton({ productId, name, variant = "overlay", className }: WishlistButtonProps) {
  const router = useRouter();
  const { status: authStatus } = useAuth();
  const { isSaved, toggle } = useWishlist();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const saved = isSaved(productId);

  async function handleClick(event: React.MouseEvent) {
    event.preventDefault(); // nút thường nằm trong <Link> bọc cả thẻ sản phẩm
    event.stopPropagation();

    if (authStatus !== "authenticated") {
      router.push(authHref("/dang-nhap", window.location.pathname + window.location.search));
      return;
    }

    setBusy(true);
    try {
      await toggle(productId);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const label = saved ? `Bỏ "${name}" khỏi yêu thích` : `Thêm "${name}" vào yêu thích`;

  if (variant === "panel") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-pressed={saved}
        aria-label={label}
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl border transition disabled:opacity-60",
          saved ? "border-sale-200 bg-sale-500/10 text-sale-600" : "border-slate-200 bg-white text-slate-400 hover:text-sale-500",
          className,
        )}
      >
        {busy ? <LoaderCircle className="size-5 animate-spin" /> : <Heart className={cn("size-5", saved && "fill-current")} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-pressed={saved}
      aria-label={label}
      className={cn(
        "absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full bg-white/90 text-slate-400 shadow-sm ring-1 ring-slate-900/5 backdrop-blur transition hover:text-sale-500 disabled:opacity-60",
        saved && "text-sale-600",
        className,
      )}
    >
      {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Heart className={cn("size-4", saved && "fill-current")} />}
    </button>
  );
}
