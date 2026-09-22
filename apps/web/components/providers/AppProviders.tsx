"use client";

import { AuthProvider } from "./AuthProvider";
import { CartProvider } from "./CartProvider";
import { CompareProvider } from "./CompareProvider";
import { ToastProvider } from "./ToastProvider";
import { WishlistProvider } from "./WishlistProvider";

/**
 * Gom mọi provider của site vào một chỗ để layout gốc (Server Component) chỉ
 * cần bọc một lớp. Thứ tự có ý nghĩa: giỏ hàng / yêu thích cần biết ai đang đăng nhập.
 * So sánh (CompareProvider) không cần đăng nhập nên đứng ngoài AuthProvider.
 */
export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <CompareProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>{children}</WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </CompareProvider>
    </ToastProvider>
  );
}
