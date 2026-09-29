import type { Metadata } from "next";
import "../globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CompareBar from "@/components/product/CompareBar";
import AppProviders from "@/components/providers/AppProviders";
import { getPublicSettings } from "@/lib/api";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  // Gốc để Next dựng link tuyệt đối cho ảnh chia sẻ mạng xã hội (Open Graph) — lib/site-url.ts
  metadataBase: new URL(siteUrl()),
  title: "PCZone – Build Your Power, Own Your Zone",
  description:
    "Hệ thống bán lẻ PC Gaming, laptop và linh kiện chính hãng tích hợp trợ lý AI tư vấn cấu hình, kiểm tra tương thích và build PC thông minh.",
  keywords: [
    "PC Gaming",
    "laptop gaming",
    "linh kiện máy tính",
    "build PC",
    "AI tư vấn cấu hình",
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Cài đặt công khai (phí vận chuyển, tính năng AI đang bật...) truyền sẵn cho client component qua
  // StoreSettingsProvider — cùng một request với TopBar/Footer (Next.js gộp fetch trùng địa chỉ)
  const settings = await getPublicSettings();

  return (
    <html lang="vi" data-scroll-behavior="smooth">
      <head>
        {/*
          Font nạp qua Google Fonts CDN:
          - Be Vietnam Pro: chữ nội dung, hỗ trợ đầy đủ dấu tiếng Việt
          - Saira: chữ tiêu đề in hoa kiểu kỹ thuật
          Nếu cần build offline, tải 2 font về /public/fonts rồi
          chuyển sang next/font/local.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Saira:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <AppProviders settings={settings}>
          <Header />
          <main className="min-h-screen pb-6">{children}</main>
          <Footer />
          <CompareBar />
        </AppProviders>
      </body>
    </html>
  );
}
