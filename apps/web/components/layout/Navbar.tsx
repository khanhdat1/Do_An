"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  CircuitBoard,
  Cpu,
  Gift,
  Keyboard,
  Laptop,
  Menu,
  Monitor,
  MonitorSmartphone,
  Sparkles,
  X,
} from "lucide-react";
import { mainNav } from "@/lib/data/navigation";
import { cn } from "@/lib/utils";

/** Map tên icon trong data sang component thật của lucide-react */
const navIcons = {
  Laptop,
  Monitor,
  Cpu,
  CircuitBoard,
  MonitorSmartphone,
  Keyboard,
} as const;

/**
 * Thanh navigation nằm dưới header.
 * Trên desktop hiển thị đầy đủ menu; trên mobile thu gọn thành nút "Danh mục".
 */
export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="border-t border-white/5 bg-ink-950">
      <div className="container-page flex h-12 items-center justify-between gap-3">
        {/* Nút mở menu trên mobile */}
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="flex items-center gap-2 rounded-lg bg-ink-800 px-3 py-1.5 text-xs font-bold uppercase text-white lg:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
        >
          {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          Danh mục
        </button>

        {/* Menu desktop */}
        <ul className="hidden items-center gap-1 lg:flex">
          {mainNav.map((item, index) => {
            const Icon = navIcons[item.icon as keyof typeof navIcons];
            const active =
              pathname === item.href || (index === 0 && pathname === "/");

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition",
                    active
                      ? "bg-ink-800 text-white ring-1 ring-white/15"
                      : "text-slate-300 hover:bg-white/5 hover:text-gold-400",
                  )}
                >
                  {Icon ? <Icon className="size-4 text-brand-500" /> : null}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Hai nút nhấn bên phải */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/khuyen-mai"
            className="flex items-center gap-1.5 rounded-lg border border-gold-400/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gold-400 transition hover:bg-gold-400/10"
          >
            <Gift className="size-3.5" />
            <span className="hidden sm:inline">Khuyến mãi VIP</span>
            <span className="sm:hidden">Sale</span>
          </Link>
          <Link
            href="/ai-build-pc"
            className="flex items-center gap-1.5 rounded-lg bg-gold-400 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-950 transition hover:bg-gold-300"
          >
            <Sparkles className="size-3.5" />
            AI PC Builder
          </Link>
        </div>
      </div>

      {/* Menu mobile dạng xổ xuống */}
      {mobileOpen ? (
        <div id="mobile-nav" className="border-t border-white/5 lg:hidden">
          <ul className="container-page grid gap-1 py-3">
            {mainNav.map((item) => {
              const Icon = navIcons[item.icon as keyof typeof navIcons];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5"
                  >
                    <span className="flex items-center gap-2.5">
                      {Icon ? <Icon className="size-4 text-brand-500" /> : null}
                      {item.label}
                    </span>
                    <ChevronDown className="size-4 -rotate-90 text-slate-500" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
