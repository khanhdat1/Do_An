"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "./AuthProvider";

type WishlistStatus = "loading" | "ready" | "error";

interface WishlistContextValue {
  status: WishlistStatus;
  /** id các sản phẩm đã lưu — rỗng khi chưa đăng nhập */
  productIds: Set<string>;
  isSaved: (productId: string) => boolean;
  /** Bấm trái tim: thêm nếu chưa có, xoá nếu đã có. Ném `ApiError` nếu server từ chối. */
  toggle: (productId: string) => Promise<void>;
}

const EMPTY = new Set<string>();

const WishlistContext = createContext<WishlistContextValue | null>(null);

/**
 * Sản phẩm yêu thích dùng chung cho toàn site (nút trái tim trên lưới sản phẩm, trang chi tiết, badge
 * ở header). Chỉ giữ DANH SÁCH ID — đủ để tô trạng thái nút, không tải cả object sản phẩm.
 *
 * `fetchedIds` chỉ giữ kết quả gọi API lúc ĐÃ đăng nhập; giá trị lộ ra ngoài (`productIds`/`status`)
 * được TÍNH LẠI mỗi lần render theo `authStatus` hiện tại (xem bên dưới) thay vì tự setState khi đăng
 * xuất — nhờ vậy effect chỉ còn đúng một nhánh gọi API, không có nhánh nào gọi setState đồng bộ ngay
 * trong thân effect (bị chặn bởi lint react-hooks/set-state-in-effect).
 */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { status: authStatus, user } = useAuth();
  const userId = user?.id;

  const [fetchedIds, setFetchedIds] = useState<Set<string> | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);

  useEffect(() => {
    if (authStatus !== "authenticated") return;

    let cancelled = false;
    apiFetch<{ productIds: string[] }>("/api/wishlist/ids")
      .then(({ productIds: ids }) => {
        if (!cancelled) setFetchedIds(new Set(ids));
      })
      .catch(() => {
        if (!cancelled) setFetchFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, userId]);

  const productIds = authStatus === "authenticated" ? (fetchedIds ?? EMPTY) : EMPTY;
  const status: WishlistStatus =
    authStatus === "loading"
      ? "loading"
      : authStatus === "anonymous"
        ? "ready"
        : fetchedIds
          ? "ready"
          : fetchFailed
            ? "error"
            : "loading";

  const toggle = useCallback(
    async (productId: string) => {
      const saved = productIds.has(productId);

      // Cập nhật ngay trên giao diện; gọi API xong không khớp (hiếm) thì trả lại như cũ bên dưới
      setFetchedIds((current) => {
        const next = new Set(current ?? EMPTY);
        if (saved) next.delete(productId);
        else next.add(productId);
        return next;
      });

      try {
        if (saved) await apiFetch(`/api/wishlist/${productId}`, { method: "DELETE" });
        else await apiFetch(`/api/wishlist/${productId}`, { method: "POST" });
      } catch (error) {
        setFetchedIds((current) => {
          const next = new Set(current ?? EMPTY);
          if (saved) next.add(productId);
          else next.delete(productId);
          return next;
        });
        throw error;
      }
    },
    [productIds],
  );

  const isSaved = useCallback((productId: string) => productIds.has(productId), [productIds]);

  const value = useMemo<WishlistContextValue>(
    () => ({ status, productIds, isSaved, toggle }),
    [status, productIds, isSaved, toggle],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist phải được dùng bên trong <WishlistProvider>");
  return context;
}
