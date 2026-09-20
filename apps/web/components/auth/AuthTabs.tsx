import Link from "next/link";
import { LogIn, UserPlus } from "lucide-react";
import { authHref } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface AuthTabsProps {
  mode: "login" | "register";
  /** Giữ nguyên `?next=` khi chuyển qua lại giữa hai tab */
  next: string;
}

/**
 * Thanh chuyển "Đăng nhập | Đăng ký thành viên". Là hai liên kết tới hai trang
 * riêng (/dang-nhap, /dang-ky) chứ không phải hai panel trong cùng một trang, nên
 * mỗi tab có địa chỉ riêng, nút Back của trình duyệt vẫn đúng.
 */
export default function AuthTabs({ mode, next }: AuthTabsProps) {
  const tabs = [
    { key: "login", href: authHref("/dang-nhap", next), icon: LogIn },
    { key: "register", href: authHref("/dang-ky", next), icon: UserPlus },
  ] as const;

  return (
    <nav
      aria-label="Chọn đăng nhập hoặc đăng ký"
      // Hai tab bằng nhau như bản thiết kế; ở khoảng lg–xl cột form hẹp nên tab "Đăng ký" được rộng hơn để nhãn + huy hiệu không xuống dòng
      className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 lg:max-xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
    >
      {tabs.map(({ key, href, icon: Icon }) => {
        const active = key === mode;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2 py-2 text-[13px] font-semibold transition",
              active
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-800",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active ? "text-brand-500" : "text-slate-400")} />
            {key === "login" ? (
              "Đăng nhập"
            ) : (
              <>
                <span className="sm:hidden">Đăng ký</span>
                <span className="hidden sm:inline">Đăng ký thành viên</span>
                <span className="hidden rounded-full bg-sale-600 px-2 py-0.5 text-[9px] font-extrabold uppercase leading-none text-white sm:inline">
                  +500K Voucher
                </span>
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
