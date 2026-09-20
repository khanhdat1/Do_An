"use client";

import { AuthProvider } from "./AuthProvider";
import { CartProvider } from "./CartProvider";
import { ToastProvider } from "./ToastProvider";

/**
 * Gom mọi provider của site vào một chỗ để layout gốc (Server Component) chỉ
 * cần bọc một lớp. Thứ tự có ý nghĩa: giỏ hàng cần biết ai đang đăng nhập.
 */
export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>{children}</CartProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
