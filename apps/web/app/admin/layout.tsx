import type { Metadata } from "next";
import "../globals.css";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { AdminAuthProvider } from "@/components/providers/AdminAuthProvider";

export const metadata: Metadata = {
  title: "Quản trị | PCZone",
  robots: { index: false, follow: false },
};

/**
 * Root layout RIÊNG cho toàn bộ /admin/* (Next.js "multiple root layouts" qua route group —
 * xem app/(site)/layout.tsx là root layout còn lại). KHÔNG dùng Header/Footer/CompareBar hay
 * AppProviders của khách hàng: khu quản trị là một "ứng dụng" tách biệt hoàn toàn về mặt giao
 * diện, không chỉ tách biệt lúc đăng nhập. Khung sidebar bảo vệ trang nằm ở
 * app/admin/(dashboard)/layout.tsx — /admin/login không cần sidebar nên tách route group riêng.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Saira:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-slate-100 antialiased">
        <ToastProvider>
          <AdminAuthProvider>{children}</AdminAuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
