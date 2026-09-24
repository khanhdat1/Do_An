"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  Heart,
  LoaderCircle,
  Lock,
  LogOut,
  Mail,
  MailWarning,
  Package,
  Pencil,
  Phone,
  Shield,
  ShoppingCart,
  Unlink,
  X,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useWishlist } from "@/components/providers/WishlistProvider";
import Avatar from "@/components/ui/Avatar";
import TextField from "@/components/ui/TextField";
import { apiFetch, errorMessage, renewSession } from "@/lib/api-client";
import type { LinkNotice } from "@/lib/auth-errors";
import { focusField } from "@/lib/forms";
import { PUBLIC_API_URL } from "@/lib/config";
import type { LinkedProvider, SocialProvider } from "@/types";
import FormError from "./FormError";
import { FacebookIcon, GoogleIcon } from "./SocialIcons";
import { useRequireAuth } from "./useRequireAuth";

const PHONE_PATTERN = /^(0|\+84)\d{9,10}$/;

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

/** Trang "Tài khoản của tôi": hồ sơ (xem/sửa), tài khoản liên kết (liên kết/huỷ liên kết), đăng xuất. */
export default function AccountView({ notice: initialNotice = null }: AccountViewProps) {
  const router = useRouter();
  const user = useRequireAuth("/tai-khoan");
  const { logout, updateProfile } = useAuth();
  const { cart } = useCart();
  const wishlist = useWishlist();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState<LinkedState>(null);
  const [linkingProvider, setLinkingProvider] = useState<SocialProvider | null>(null);
  const [unlinkPending, setUnlinkPending] = useState<SocialProvider | null>(null);
  const [unlinking, setUnlinking] = useState<SocialProvider | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileValues, setProfileValues] = useState({ fullName: "", phone: "" });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
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

  async function confirmUnlink(provider: SocialProvider) {
    setUnlinking(provider);
    try {
      await apiFetch(`/api/auth/providers/${provider}`, { method: "DELETE" });
      setLinked((current) => (Array.isArray(current) ? current.filter((item) => item.provider !== provider) : current));
      setUnlinkPending(null);
      toast.success("Đã huỷ liên kết");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUnlinking(null);
    }
  }

  function startEditProfile() {
    setProfileValues({ fullName: user!.fullName, phone: user!.phone ?? "" });
    setProfileError(null);
    setEditingProfile(true);
  }

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingProfile) return;

    const form = event.currentTarget;
    const fullName = profileValues.fullName.trim();
    const phone = profileValues.phone.replace(/[\s.-]/g, "");

    if (fullName.length < 2) {
      setProfileError("Họ tên tối thiểu 2 ký tự");
      focusField(form, "fullName");
      return;
    }
    if (phone && !PHONE_PATTERN.test(phone)) {
      setProfileError("Số điện thoại không hợp lệ");
      focusField(form, "phone");
      return;
    }

    setProfileError(null);
    setSavingProfile(true);
    try {
      await updateProfile({ fullName, phone: phone || undefined });
      toast.success("Đã lưu thông tin hồ sơ");
      setEditingProfile(false);
    } catch (error) {
      setProfileError(errorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  }

  async function resendVerification() {
    setResendingVerification(true);
    try {
      const { message } = await apiFetch<{ message: string }>("/api/auth/resend-verification", { method: "POST" });
      toast.success(message);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setResendingVerification(false);
    }
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
        <div className="flex items-start justify-between gap-3">
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

          {!editingProfile ? (
            <button
              type="button"
              onClick={startEditProfile}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-brand-300 hover:bg-brand-500/5 hover:text-brand-600"
            >
              <Pencil className="size-3.5" />
              Sửa
            </button>
          ) : null}
        </div>

        {editingProfile ? (
          <form onSubmit={submitProfile} noValidate className="mt-6 space-y-4">
            <TextField
              label="Họ và tên"
              required
              name="fullName"
              autoComplete="name"
              value={profileValues.fullName}
              onChange={(event) => setProfileValues((current) => ({ ...current, fullName: event.target.value }))}
            />
            <TextField
              label="Số điện thoại"
              type="tel"
              name="phone"
              autoComplete="tel"
              inputMode="tel"
              placeholder="0912 345 678"
              optional
              value={profileValues.phone}
              onChange={(event) => setProfileValues((current) => ({ ...current, phone: event.target.value }))}
            />

            {profileError ? <FormError message={profileError} /> : null}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-500 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {savingProfile ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {savingProfile ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
              <button
                type="button"
                onClick={() => setEditingProfile(false)}
                disabled={savingProfile}
                className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X className="size-4" />
                Huỷ
              </button>
            </div>
          </form>
        ) : (
          <dl className="mt-6 divide-y divide-slate-100 text-sm">
            <div className="flex items-center gap-3 py-3">
              <Mail className="size-4.5 shrink-0 text-slate-400" />
              <dt className="w-28 shrink-0 text-slate-500">Email</dt>
              <dd className="flex min-w-0 items-center gap-2 font-medium text-slate-800">
                <span className="truncate">{user.email}</span>
                {user.emailVerified ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                    <CircleCheck className="size-3" />
                    Đã xác minh
                  </span>
                ) : null}
              </dd>
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
        )}

        {!editingProfile && !user.emailVerified ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800 ring-1 ring-amber-600/20">
            <span className="flex items-center gap-2">
              <MailWarning className="size-4.5 shrink-0" />
              Email chưa xác minh.
            </span>
            <button
              type="button"
              onClick={resendVerification}
              disabled={resendingVerification}
              className="flex items-center gap-1.5 rounded-lg border border-amber-600/30 bg-white px-3 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-600/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendingVerification ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              {resendingVerification ? "Đang gửi..." : "Gửi lại email xác minh"}
            </button>
          </div>
        ) : null}
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
            // Đây là liên kết CUỐI CÙNG và chưa có mật khẩu thật: huỷ sẽ mất hẳn đường vào tài
            // khoản — chặn ngay ở giao diện, khớp với guard phía server (unlinkProvider)
            const isLastLoginMethod = Array.isArray(linked) && linked.length === 1 && !user.hasPassword;

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

                {account && unlinkPending === key ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => confirmUnlink(key)}
                      disabled={unlinking === key}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-sale-500 px-3 text-xs font-bold text-white transition hover:bg-sale-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {unlinking === key ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
                      {unlinking === key ? "Đang huỷ..." : "Chắc chắn huỷ?"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnlinkPending(null)}
                      disabled={unlinking === key}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                    >
                      Thôi
                    </button>
                  </div>
                ) : account ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                      <CircleCheck className="size-3.5" />
                      Đã liên kết
                    </span>
                    {isLastLoginMethod ? (
                      <span
                        title="Đây là cách duy nhất bạn đăng nhập được. Hãy đặt mật khẩu (quên mật khẩu) hoặc liên kết thêm một tài khoản khác trước."
                        className="inline-flex size-7 items-center justify-center text-slate-300"
                      >
                        <Lock className="size-3.5" />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setUnlinkPending(key)}
                        className="inline-flex size-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-sale-500/10 hover:text-sale-600"
                        aria-label={`Huỷ liên kết ${label}`}
                      >
                        <Unlink className="size-3.5" />
                      </button>
                    )}
                  </div>
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

        {Array.isArray(linked) && linked.length === 1 && !user.hasPassword ? (
          <p className="mt-3 text-xs text-slate-500">
            Bạn đang chỉ đăng nhập bằng {PROVIDERS.find((p) => p.key === linked[0].provider)?.label} —
            hãy{" "}
            <Link href="/quen-mat-khau" className="font-bold text-brand-600 hover:underline">
              đặt mật khẩu
            </Link>{" "}
            hoặc liên kết thêm một tài khoản khác nếu muốn huỷ liên kết này sau.
          </p>
        ) : null}

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
