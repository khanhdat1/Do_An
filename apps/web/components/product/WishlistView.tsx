"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CloudOff, Heart, LoaderCircle } from "lucide-react";
import { useRequireAuth } from "@/components/auth/useRequireAuth";
import ProductCard from "@/components/product/ProductCard";
import { useWishlist } from "@/components/providers/WishlistProvider";
import { apiFetch } from "@/lib/api-client";
import type { Product } from "@/types";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; items: Product[] };

/** Danh sách sản phẩm yêu thích của tài khoản — trang `/yeu-thich` */
export default function WishlistView() {
  const user = useRequireAuth("/yeu-thich");
  const wishlist = useWishlist();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    apiFetch<{ items: Product[] }>("/api/wishlist")
      .then(({ items }) => {
        if (!cancelled) setState({ status: "ready", items });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || state.status === "loading") {
    return (
      <div className="surface-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải danh sách yêu thích...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
        <CloudOff className="size-10 text-slate-400" />
        <p className="mt-3 text-sm text-slate-500">Không tải được danh sách yêu thích. Vui lòng tải lại trang.</p>
      </div>
    );
  }

  // Bấm trái tim ngay trên trang này chỉ đổi WishlistProvider (danh sách id dùng chung toàn site),
  // không tự sửa lại `state.items` đã tải — lọc theo id còn lưu để thẻ vừa bỏ tim biến mất ngay,
  // không cần tải lại trang. Chỉ lọc khi WishlistProvider đã tải xong (đang "ready"): lúc mới vào
  // trang, provider có thể chưa kịp tải xong id trong khi `state.items` (tự trang này gọi) đã có —
  // lọc quá sớm sẽ làm rỗng nhầm.
  const items = wishlist.status === "ready" ? state.items.filter((product) => wishlist.productIds.has(product.id)) : state.items;

  if (items.length === 0) {
    return (
      <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-slate-100 text-slate-400">
          <Heart className="size-8" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-slate-800">Chưa có sản phẩm yêu thích nào</h2>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">
          Bấm biểu tượng trái tim trên sản phẩm để lưu lại xem sau.
        </p>
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
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {items.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
