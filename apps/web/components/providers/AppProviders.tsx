"use client";

import type { PublicSettings } from "@/types";
import { AuthProvider } from "./AuthProvider";
import { CartProvider } from "./CartProvider";
import { CompareProvider } from "./CompareProvider";
import { StoreSettingsProvider } from "./StoreSettingsProvider";
import { ToastProvider } from "./ToastProvider";
import { WishlistProvider } from "./WishlistProvider";

/**
 * Gom mọi provider của site vào một chỗ để layout gốc (Server Component) chỉ
 * cần bọc một lớp. Thứ tự có ý nghĩa: giỏ hàng / yêu thích cần biết ai đang đăng nhập.
 * So sánh (CompareProvider) không cần đăng nhập nên đứng ngoài AuthProvider.
 * Cài đặt cửa hàng (StoreSettingsProvider, layout truyền sẵn `settings`) không phụ thuộc đăng nhập nên cũng
 * đứng ngoài AuthProvider.
 */
export default function AppProviders({ settings, children }: { settings: PublicSettings; children: React.ReactNode }) {
  return (
    <ToastProvider>
      <StoreSettingsProvider initial={settings}>
        <CompareProvider>
          <AuthProvider>
            <CartProvider>
              <WishlistProvider>{children}</WishlistProvider>
            </CartProvider>
          </AuthProvider>
        </CompareProvider>
      </StoreSettingsProvider>
    </ToastProvider>
  );
}
