"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/quan-tri/don-hang", label: "Xác nhận thanh toán" },
  { href: "/quan-tri/danh-gia", label: "Đánh giá sản phẩm" },
];

/** Tab điều hướng giữa các trang quản trị — dùng chung cho mọi trang /quan-tri/* */
export default function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-2">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "rounded-lg px-3.5 py-2 text-sm font-bold transition",
            pathname === link.href ? "bg-brand-500 text-white" : "bg-white text-slate-600 hover:bg-slate-100",
          )}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
