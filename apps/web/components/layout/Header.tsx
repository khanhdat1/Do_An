import Link from "next/link";
import { Bot, Heart, ShoppingCart, UserRound } from "lucide-react";
import Logo from "./Logo";
import SearchBar from "./SearchBar";
import TopBar from "./TopBar";
import Navbar from "./Navbar";

/**
 * Header tổng của site, gồm 3 tầng như bản thiết kế:
 *  1. TopBar  – hotline / showroom / đăng nhập
 *  2. Thanh chính – logo, ô tìm kiếm AI, AI Advisor, wishlist, giỏ hàng
 *  3. Navbar  – menu danh mục + nút AI PC Builder
 */
export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-ink-900 shadow-lg shadow-black/10">
      <TopBar />

      {/*
        Mobile: logo + nhóm icon trên một hàng, ô tìm kiếm xuống hàng dưới.
        Desktop (lg): cả ba nằm trên cùng một hàng cao 72px.
      */}
      <div className="container-page flex flex-wrap items-center gap-3 py-3 lg:h-[72px] lg:flex-nowrap lg:gap-4 lg:py-0">
        <Logo />

        <SearchBar className="order-last w-full lg:order-none lg:mx-auto lg:max-w-[620px]" />

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
          {/* Thẻ AI Advisor – điểm khác biệt chính của PCZone */}
          <Link
            href="/ai-advisor"
            className="hidden items-center gap-2 rounded-xl bg-ink-800 px-3 py-2 ring-1 ring-white/10 transition hover:ring-gold-400/50 xl:flex"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-brand-500/20">
              <Bot className="size-4.5 text-gold-400" />
            </span>
            <span className="leading-tight">
              <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                AI Advisor
                <span className="size-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[10px] text-slate-400">Tư vấn 24/7</span>
            </span>
          </Link>

          <IconButton
            href="/yeu-thich"
            label="Sản phẩm yêu thích"
            count={3}
            className="hidden sm:inline-flex"
          >
            <Heart className="size-5" />
          </IconButton>

          <IconButton href="/gio-hang" label="Giỏ hàng" count={2}>
            <ShoppingCart className="size-5" />
          </IconButton>

          <Link
            href="/tai-khoan"
            aria-label="Tài khoản của tôi"
            className="grid size-10 place-items-center rounded-xl bg-brand-500 text-white transition hover:bg-brand-600"
          >
            <UserRound className="size-5" />
          </Link>
        </div>
      </div>

      <Navbar />
    </header>
  );
}

/* -------------------------------------------------------------------------- */

interface IconButtonProps {
  href: string;
  label: string;
  count?: number;
  className?: string;
  children: React.ReactNode;
}

/** Nút icon tròn có badge số lượng (wishlist, giỏ hàng) */
function IconButton({ href, label, count, className, children }: IconButtonProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`relative grid size-10 place-items-center rounded-xl bg-ink-800 text-slate-200 ring-1 ring-white/10 transition hover:text-gold-400 hover:ring-gold-400/50 ${className ?? ""}`}
    >
      {children}
      {count ? (
        <span className="absolute -right-1 -top-1 grid size-4.5 place-items-center rounded-full bg-sale-600 text-[10px] font-bold text-white">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
