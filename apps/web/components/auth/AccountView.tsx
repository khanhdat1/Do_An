"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  Heart,
  LoaderCircle,
  LogOut,
  Mail,
  Package,
  Phone,
  Shield,
  ShoppingCart,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useWishlist } from "@/components/providers/WishlistProvider";
import Avatar from "@/components/ui/Avatar";
import { apiFetch, errorMessage, renewSession } from "@/lib/api-client";
import type { LinkNotice } from "@/lib/auth-errors";
import { PUBLIC_API_URL } from "@/lib/config";
import type { LinkedProvider, SocialProvider } from "@/types";
import FormError from "./FormError";
import { FacebookIcon, GoogleIcon } from "./SocialIcons";
import { useRequireAuth } from "./useRequireAuth";

const ROLE_LABEL = {
  CUSTOMER: "Khách hàng",
  STAFF: "Nhân viên",
  ADMIN: "Quản trị viên",
  OWNER: "Chủ website",
  MANAGER: "Quản lý",
  ORDER_STAFF: "Nhân viên đơn hàng",
  PRODUCT_STAFF: "Nhân viên sản phẩm",
} as const;

const PROVIDERS: { key: SocialProvider; label: string; Icon: typeof GoogleIcon }[] = [
  { key: "google", label: "Google", Icon: GoogleIcon },
  { key: "facebook", label: "Facebook", Icon: FacebookIcon },
];

/** `null` = đang tải danh sách; `"error"` = không tải được */
type LinkedState = LinkedProvider[] | "error" | null;

interface AccountViewProps {
  /** Kết quả lần liên kết vừa xong (đọc từ `?linked=` / `?error=` trên URL) */
  notice?: LinkNotice | null;
}

/** Trang "Tài khoản của tôi": hồ sơ, tài khoản liên kết, đăng xuất. Chưa có API sửa hồ sơ. */
export default function AccountView({ notice: initialNotice = null }: AccountViewProps) {
  const router = useRouter();
  const user = useRequireAuth("/tai-khoan");
  const { logout } = useAuth();
  const { cart } = useCart();
  const wishlist = useWishlist();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState<LinkedState>(null);
  const [linkingProvider, setLinkingProvider] = useState<SocialProvider | null>(null);
  // Chụp lại lúc mở trang: bên dưới ta xoá `?linked=` khỏi URL, khi đó prop trở về null
  // nhưng thông báo vẫn phải nằm đó cho người dùng đọc
  const [notice] = useState(initialNotice);

  // Đã đọc xong kết quả liên kết: bỏ tham số khỏi thanh địa chỉ để tải lại trang không hiện lại
  useEffect(() => {
    if (initialNotice) router.replace("/tai-khoan", { scroll: false });
  }, [initialNotice, router]);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    apiFetch<{ providers: LinkedProvider[] }>("/api/auth/providers")
      .then(({ providers }) => {
        if (!cancelled) setLinked(providers);
      })
      .catch(() => {
        if (!cancelled) setLinked("error");
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Bấm "Quay lại" từ trang Google / Facebook có thể khôi phục trang này nguyên trạng, kể cả nút đang xoay
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) setLinkingProvider(null);
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
      toast.success("Bạn đã đăng xuất");
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  async function handleLink(provider: SocialProvider) {
    if (linkingProvider) return;
    setLinkingProvider(provider);

    // Đây là điều hướng chứ không phải fetch nên không tự refresh khi gặp 401: làm mới
    // phiên trước để API thấy access token còn hạn cả lúc bắt đầu lẫn lúc nhà cung cấp gọi về
    if (!(await renewSession())) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      setLinkingProvider(null);
      return;
    }

    const url = new URL(`/api/auth/${provider}`, PUBLIC_API_URL);
    url.searchParams.set("link", "1");
    window.location.assign(url);
  }

  if (!user) {
    return (
      <div className="surface-card mx-auto flex max-w-2xl items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải thông tin tài khoản...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar
            name={user.fullName}
            src={user.avatarUrl}
            className="size-16 rounded-2xl text-xl"
          />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-slate-900">{user.fullName}</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Thành viên từ {new Date(user.createdAt).toLocaleDateString("vi-VN")}
            </p>
          </div>
        </div>

        <dl className="mt-6 divide-y divide-slate-100 text-sm">
          <div className="flex items-center gap-3 py-3">
            <Mail className="size-4.5 shrink-0 text-slate-400" />
            <dt className="w-28 shrink-0 text-slate-500">Email</dt>
            <dd className="min-w-0 truncate font-medium text-slate-800">{user.email}</dd>
          </div>
          <div className="flex items-center gap-3 py-3">
            <Phone className="size-4.5 shrink-0 text-slate-400" />
            <dt className="w-28 shrink-0 text-slate-500">Số điện thoại</dt>
            <dd className="font-medium text-slate-800">{user.phone ?? "Chưa cập nhật"}</dd>
          </div>
          <div className="flex items-center gap-3 py-3">
            <Shield className="size-4.5 shrink-0 text-slate-400" />
            <dt className="w-28 shrink-0 text-slate-500">Loại tài khoản</dt>
            <dd className="font-medium text-slate-800">{ROLE_LABEL[user.role]}</dd>
          </div>
        </dl>
      </section>

      <section className="surface-card p-5 sm:p-6" aria-labelledby="linked-accounts-title">
        <h2 id="linked-accounts-title" className="text-base font-bold text-slate-900">
          Tài khoản liên kết
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Liên kết Google hoặc Facebook để đăng nhập nhanh vào chính tài khoản này, kể cả khi
          email của chúng khác email PCZone.
        </p>

        {notice ? (
          <div className="mt-4">
            {notice.tone === "success" ? (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-lg bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 ring-1 ring-emerald-600/20"
              >
                <CircleCheck className="mt-0.5 size-4.5 shrink-0" />
                {notice.message}
              </div>
            ) : (
              <FormError message={notice.message} />
            )}
          </div>
        ) : null}

        <ul className="mt-2 divide-y divide-slate-100">
          {PROVIDERS.map(({ key, label, Icon }) => {
            const account = Array.isArray(linked)
              ? linked.find((item) => item.provider === key)
              : undefined;

            return (
              <li key={key} className="flex items-center gap-3 py-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-slate-200">
                  <Icon className="size-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{label}</p>
                  <p className="truncate text-xs text-slate-500">
                    {linked === null
                      ? "Đang kiểm tra..."
                      : account
                        ? (account.email ?? "Đã liên kết")
                        : "Chưa liên kết"}
                  </p>
                </div>

                {account ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                    <CircleCheck className="size-3.5" />
                    Đã liên kết
                  </span>
                ) : Array.isArray(linked) ? (
                  <button
                    type="button"
                    onClick={() => handleLink(key)}
                    disabled={linkingProvider !== null}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 transition hover:border-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {linkingProvider === key ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : null}
                    {linkingProvider === key ? "Đang chuyển hướng..." : "Liên kết"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>

        {linked === "error" ? (
          <p className="mt-2 text-xs text-sale-600">
            Không tải được danh sách liên kết. Vui lòng tải lại trang.
          </p>
        ) : null}
      </section>

      <section className="surface-card flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-slate-100">
            <Package className="size-5 text-slate-500" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">Đơn hàng của bạn</p>
            <p className="text-xs text-slate-500">Xem lại các đơn đã đặt và tình trạng giao hàng</p>
          </div>
        </div>
        <Link
          href="/tai-khoan/don-hang"
          className="rounded-lg bg-brand-500 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
        >
          Xem đơn hàng
        </Link>
      </section>

      <section className="surface-card flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-slate-100">
            <Heart className="size-5 text-slate-500" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">Sản phẩm yêu thích</p>
            <p className="text-xs text-slate-500">
              {wishlist.productIds.size > 0 ? `${wishlist.productIds.size} sản phẩm đã lưu` : "Chưa có sản phẩm nào"}
            </p>
          </div>
        </div>
        <Link
          href="/yeu-thich"
          className="rounded-lg bg-brand-500 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
        >
          Xem yêu thích
        </Link>
      </section>

      <section className="surface-card flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-slate-100">
            <ShoppingCart className="size-5 text-slate-500" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">Giỏ hàng của bạn</p>
            <p className="text-xs text-slate-500">
              {cart.itemCount > 0 ? `${cart.itemCount} sản phẩm đang chờ thanh toán` : "Chưa có sản phẩm nào"}
            </p>
          </div>
        </div>
        <Link
          href="/gio-hang"
          className="rounded-lg bg-brand-500 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
        >
          Xem giỏ hàng
        </Link>
      </section>

      <button
        type="button"
        onClick={handleLogout}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-sale-600 transition hover:bg-sale-500/5 disabled:opacity-60"
      >
        {busy ? <LoaderCircle className="size-4.5 animate-spin" /> : <LogOut className="size-4.5" />}
        {busy ? "Đang đăng xuất..." : "Đăng xuất"}
      </button>
    </div>
  );
}
