"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiFetch } from "@/lib/api-client";
import type { Cart } from "@/types";
import { useAuth } from "./AuthProvider";

type CartStatus = "loading" | "ready" | "error";

interface CartState {
  status: CartStatus;
  cart: Cart;
}

interface CartContextValue extends CartState {
  /** Thêm vào giỏ (cộng dồn nếu đã có). Ném `ApiError` nếu server từ chối. */
  addItem: (productId: string, quantity?: number) => Promise<void>;
  setQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clear: () => Promise<void>;
  reload: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

const EMPTY_CART: Cart = { items: [], itemCount: 0, subtotal: 0, hasBlockingIssues: false };

/**
 * Giỏ hàng dùng chung cho toàn site (biểu tượng trên header, nút "Mua ngay",
 * trang /gio-hang). Dữ liệu nằm ở server; ở đây chỉ giữ bản sao mới nhất.
 *
 * Giỏ được nạp lại mỗi khi danh tính đổi (đăng nhập, đăng xuất): lúc đăng nhập
 * server gộp giỏ khách vào giỏ tài khoản nên bản sao cũ không còn đúng.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>({ status: "loading", cart: EMPTY_CART });
  const { status: authStatus, user } = useAuth();
  const userId = user?.id;

  // Hai request giỏ hàng chạy chồng nhau (bấm + liên tiếp) có thể về sai thứ tự.
  // Đánh số từng request và chỉ nhận kết quả mới hơn cái đã nhận, để bản cũ về
  // muộn không ghi đè bản mới.
  const requested = useRef(0);
  const applied = useRef(0);

  const run = useCallback(async (request: () => Promise<Cart>) => {
    const ticket = ++requested.current;
    const cart = await request();
    if (ticket > applied.current) {
      applied.current = ticket;
      setState({ status: "ready", cart });
    }
  }, []);

  // Chờ biết danh tính rồi mới nạp giỏ, tránh nạp giỏ khách xong lại nạp thêm giỏ tài khoản
  useEffect(() => {
    if (authStatus === "loading") return;

    run(() => apiFetch<Cart>("/api/cart")).catch(() => {
      setState((current) => ({ ...current, status: "error" }));
    });
  }, [authStatus, userId, run]);

  const addItem = useCallback(
    (productId: string, quantity = 1) =>
      run(() =>
        apiFetch<Cart>("/api/cart/items", {
          method: "POST",
          body: { productId, quantity },
        }),
      ),
    [run],
  );

  const setQuantity = useCallback(
    (itemId: string, quantity: number) =>
      run(() =>
        apiFetch<Cart>(`/api/cart/items/${encodeURIComponent(itemId)}`, {
          method: "PATCH",
          body: { quantity },
        }),
      ),
    [run],
  );

  const removeItem = useCallback(
    (itemId: string) =>
      run(() =>
        apiFetch<Cart>(`/api/cart/items/${encodeURIComponent(itemId)}`, {
          method: "DELETE",
        }),
      ),
    [run],
  );

  const clear = useCallback(
    () => run(() => apiFetch<Cart>("/api/cart", { method: "DELETE" })),
    [run],
  );

  const reload = useCallback(() => run(() => apiFetch<Cart>("/api/cart")), [run]);

  const value = useMemo<CartContextValue>(
    () => ({ ...state, addItem, setQuantity, removeItem, clear, reload }),
    [state, addItem, setQuantity, removeItem, clear, reload],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart phải được dùng bên trong <CartProvider>");
  return context;
}
