"use client";

import { useEffect, useState } from "react";
import { Bot, CloudOff, CreditCard, LoaderCircle, RotateCcw, ShieldAlert, Store, Truck } from "lucide-react";
import AdminBadge from "@/components/admin/AdminBadge";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ApiError, adminApiFetch, errorMessage } from "@/lib/admin-api-client";
import { formatPrice } from "@/lib/format";
import type { AdminSettings, AiToggleSettings, PaymentToggleSettings, SystemSettings, Tone } from "@/types";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; data: AdminSettings };

/** Ô tiền giữ dạng chuỗi trong lúc gõ (cho phép xoá trắng để gõ lại), chỉ đổi sang số lúc lưu */
interface FormState {
  hotline: string;
  supportEmail: string;
  showroomAddress: string;
  flatFee: string;
  freeThreshold: string;
  payments: PaymentToggleSettings;
  ai: AiToggleSettings;
}

function formFromSettings(settings: SystemSettings): FormState {
  return {
    hotline: settings.store.hotline,
    supportEmail: settings.store.supportEmail,
    showroomAddress: settings.store.showroomAddress,
    flatFee: String(settings.shipping.flatFee),
    freeThreshold: String(settings.shipping.freeThreshold),
    payments: { ...settings.payments },
    ai: { ...settings.ai },
  };
}

function settingsFromForm(form: FormState): SystemSettings {
  return {
    store: { hotline: form.hotline.trim(), supportEmail: form.supportEmail.trim(), showroomAddress: form.showroomAddress.trim() },
    shipping: { flatFee: Number(form.flatFee), freeThreshold: Number(form.freeThreshold) },
    payments: { ...form.payments },
    ai: { ...form.ai },
  };
}

/** So từng trường (không dựa vào thứ tự khoá như JSON.stringify) — dùng để bật/tắt nút Lưu */
function sameSettings(a: SystemSettings, b: SystemSettings): boolean {
  return (Object.keys(a) as (keyof SystemSettings)[]).every((group) =>
    Object.entries(a[group]).every(([field, value]) => (b[group] as unknown as Record<string, unknown>)[field] === value),
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Câu tóm tắt quy tắc phí đang nhập, để chủ website đọc lại đúng ý mình trước khi lưu */
function shippingSummary(flatFee: string, freeThreshold: string): string | null {
  if (flatFee.trim() === "" || freeThreshold.trim() === "") return null;
  const fee = Number(flatFee);
  const threshold = Number(freeThreshold);
  if (!Number.isFinite(fee) || !Number.isFinite(threshold)) return null;
  if (fee === 0) return "Không thu phí vận chuyển với mọi đơn hàng.";
  if (threshold === 0) return "Mọi đơn hàng đều được miễn phí vận chuyển.";
  return `Đơn có tạm tính dưới ${formatPrice(threshold)} trả phí ${formatPrice(fee)}; từ ${formatPrice(threshold)} trở lên miễn phí vận chuyển.`;
}

const PAYMENT_ROWS: { key: keyof PaymentToggleSettings; label: string; note: string }[] = [
  { key: "cod", label: "Thanh toán khi nhận hàng (COD)", note: "Không cần cấu hình gì thêm." },
  { key: "bankTransfer", label: "Chuyển khoản ngân hàng", note: "Cần BANK_ID, BANK_ACCOUNT_NUMBER, BANK_ACCOUNT_NAME, BANK_NAME trong .env." },
  { key: "momo", label: "Ví MoMo", note: "Cần MOMO_PHONE, MOMO_DISPLAY_NAME trong .env." },
  { key: "vnpay", label: "VNPay", note: "Cần VNPAY_TMN_CODE, VNPAY_HASH_SECRET trong .env." },
];

const AI_ROWS: { key: keyof AiToggleSettings; label: string; note: string }[] = [
  {
    key: "search",
    label: "Tìm kiếm bằng AI",
    note: "Nút “AI Search” ở ô tìm kiếm. Tắt thì khách vẫn tìm được — tự chuyển sang tìm kiếm từ khoá, không hiện lỗi.",
  },
  {
    key: "chat",
    label: "Trợ lý AI",
    note: "Trang /tro-ly-ai. Tắt thì trang hiện thông báo tạm tắt kèm hotline, máy chủ từ chối tin nhắn mới.",
  },
  {
    key: "build",
    label: "AI gợi ý cấu hình",
    note: "Khối “Nhờ AI gợi ý cả bộ” ở /ai-build-pc. Tắt thì khách vẫn tự chọn linh kiện, kiểm tra tương thích như bình thường.",
  },
];

/** Trạng thái THẬT với khách sau khi lưu: tắt / bật nhưng thiếu cấu hình (.env) / dùng được */
function availability(enabled: boolean, configured: boolean, missingLabel: string): { tone: Tone; label: string } {
  if (!enabled) return { tone: "slate", label: "Đang tắt" };
  if (!configured) return { tone: "amber", label: missingLabel };
  return { tone: "green", label: "Khách dùng được" };
}

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-500";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-sale-600">{message}</p>;
}

function SettingsCard({
  icon: Icon,
  title,
  description,
  aside,
  children,
}: {
  icon: typeof Store;
  title: string;
  description: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-600">
            <Icon className="size-4.5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
          </div>
        </div>
        {aside}
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function ToggleRow({
  id,
  label,
  note,
  checked,
  onChange,
  badge,
}: {
  id: string;
  label: string;
  note: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  badge: { tone: Tone; label: string };
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-slate-300">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-brand-500 focus:ring-brand-500/30"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{label}</span>
          <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">{note}</span>
      </span>
    </label>
  );
}

/**
 * `/admin/settings` — chỉ OWNER (quyền `settings:write`, cả xem lẫn sửa). Một form cho cả 4 nhóm, lưu một lần
 * bằng `PUT /api/admin/settings`; máy chủ kiểm lại toàn bộ (giới hạn phí, định dạng email, phải còn ít nhất một
 * phương thức thanh toán dùng được) và ghi nhật ký trước/sau của đúng các trường đã đổi.
 */
export default function AdminSettingsView() {
  const { user } = useAdminAuth();
  const toast = useToast();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const allowed = user ? user.permissions.includes("settings:write") : null;

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;

    adminApiFetch<AdminSettings>("/api/admin/settings")
      .then((data) => {
        if (cancelled) return;
        setState({ status: "ready", data });
        setForm(formFromSettings(data.settings));
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [allowed]);

  // Cổng quyền là chuỗi return riêng, KHÔNG gộp với trạng thái tải dữ liệu (xem bài học ở AdminOrderPrintView:
  // gộp hai điều kiện "đang tải" làm nhánh "không có quyền" không bao giờ hiện)
  if (!user || allowed === null) {
    return (
      <div className="admin-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải...
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-sale-500/10 text-sale-600">
          <ShieldAlert className="size-8" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">Cài đặt hệ thống chỉ dành cho chủ website.</p>
      </div>
    );
  }

  if (state.status === "loading" || (state.status === "ready" && !form)) {
    return (
      <div className="admin-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải cài đặt...
      </div>
    );
  }

  if (state.status === "error" || !form) {
    return (
      <div className="admin-card flex flex-col items-center px-6 py-14 text-center">
        <CloudOff className="size-8 text-slate-500" />
        <p className="mt-3 text-sm text-slate-500">Không tải được cài đặt hệ thống. Vui lòng tải lại trang.</p>
      </div>
    );
  }

  const { data } = state;
  const current = form;
  const dirty = !sameSettings(settingsFromForm(current), data.settings);
  const summary = shippingSummary(current.flatFee, current.freeThreshold);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function reset() {
    setForm(formFromSettings(data.settings));
    setFieldErrors({});
    setFormError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const saved = await adminApiFetch<AdminSettings>("/api/admin/settings", { method: "PUT", body: settingsFromForm(current) });
      setState({ status: "ready", data: saved });
      setForm(formFromSettings(saved.settings));
      toast.success("Đã lưu cài đặt hệ thống");
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) setFieldErrors(error.fieldErrors);
      else setFormError(errorMessage(error));
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-slate-500">
        {data.updatedAt
          ? `Cập nhật lần cuối ${formatDateTime(data.updatedAt)}${data.updatedByName ? ` bởi ${data.updatedByName}` : ""}.`
          : "Chưa ai thay đổi — hệ thống đang dùng toàn bộ giá trị mặc định."}{" "}
        Thay đổi áp dụng ngay cho đơn hàng mới, trang đặt hàng và tính năng AI; hotline/địa chỉ ở đầu và chân trang bán hàng cập
        nhật trong khoảng 1 phút (bộ nhớ đệm của trang).
      </p>

      <SettingsCard
        icon={Store}
        title="Thông tin cửa hàng"
        description="Hiện ở thanh trên cùng, chân trang, cuối bài mô tả sản phẩm, trang trợ lý AI khi tạm tắt và phiếu in đơn hàng."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="settings-hotline" className="mb-1 block text-xs font-semibold text-slate-600">
              Hotline
            </label>
            <input
              id="settings-hotline"
              value={current.hotline}
              onChange={(event) => update("hotline", event.target.value)}
              required
              maxLength={30}
              placeholder="VD: 1800 8888"
              className={inputClass}
            />
            <FieldError message={fieldErrors["store.hotline"]} />
          </div>
          <div>
            <label htmlFor="settings-email" className="mb-1 block text-xs font-semibold text-slate-600">
              Email hỗ trợ
            </label>
            <input
              id="settings-email"
              type="email"
              value={current.supportEmail}
              onChange={(event) => update("supportEmail", event.target.value)}
              required
              maxLength={150}
              placeholder="VD: support@pczone.vn"
              className={inputClass}
            />
            <FieldError message={fieldErrors["store.supportEmail"]} />
          </div>
        </div>
        <div>
          <label htmlFor="settings-address" className="mb-1 block text-xs font-semibold text-slate-600">
            Địa chỉ showroom <span className="font-normal text-slate-500">(không bắt buộc)</span>
          </label>
          <textarea
            id="settings-address"
            value={current.showroomAddress}
            onChange={(event) => update("showroomAddress", event.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-500">Để trống thì chân trang và phiếu in tự ẩn dòng địa chỉ.</p>
          <FieldError message={fieldErrors["store.showroomAddress"]} />
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Truck}
        title="Phí vận chuyển"
        description="Máy chủ luôn tính lại phí theo đúng hai số này lúc tạo đơn; giỏ hàng và trang đặt hàng xem trước bằng cùng công thức."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="settings-fee" className="mb-1 block text-xs font-semibold text-slate-600">
              Phí cố định (đ, 0 – 1.000.000)
            </label>
            <input
              id="settings-fee"
              type="number"
              inputMode="numeric"
              min={0}
              max={1_000_000}
              step={1}
              value={current.flatFee}
              onChange={(event) => update("flatFee", event.target.value)}
              required
              className={inputClass}
            />
            <FieldError message={fieldErrors["shipping.flatFee"]} />
          </div>
          <div>
            <label htmlFor="settings-threshold" className="mb-1 block text-xs font-semibold text-slate-600">
              Miễn phí từ tạm tính (đ, 0 – 100.000.000)
            </label>
            <input
              id="settings-threshold"
              type="number"
              inputMode="numeric"
              min={0}
              max={100_000_000}
              step={1}
              value={current.freeThreshold}
              onChange={(event) => update("freeThreshold", event.target.value)}
              required
              className={inputClass}
            />
            <FieldError message={fieldErrors["shipping.freeThreshold"]} />
          </div>
        </div>
        {summary ? <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{summary}</p> : null}
      </SettingsCard>

      <SettingsCard
        icon={CreditCard}
        title="Phương thức thanh toán"
        description="Khách chỉ chọn được phương thức vừa BẬT ở đây vừa đã có khoá/số tài khoản trong .env (những thông tin đó không bao giờ lưu vào cơ sở dữ liệu). Tắt một phương thức thì trang đặt hàng ẩn lựa chọn đó và máy chủ từ chối đơn mới dùng nó; đơn đã đặt trước đó không bị ảnh hưởng."
      >
        {PAYMENT_ROWS.map((row) => (
          <ToggleRow
            key={row.key}
            id={`settings-payment-${row.key}`}
            label={row.label}
            note={row.note}
            checked={current.payments[row.key]}
            onChange={(checked) => update("payments", { ...current.payments, [row.key]: checked })}
            badge={availability(current.payments[row.key], data.configured.payments[row.key], "Bật nhưng chưa cấu hình .env")}
          />
        ))}
        <p className="text-xs text-slate-500">Phải còn ít nhất một phương thức khách dùng được, nếu không máy chủ sẽ không cho lưu.</p>
      </SettingsCard>

      <SettingsCard
        icon={Bot}
        title="Tính năng AI"
        description="Tạm tắt khi dịch vụ AI đang lỗi hoặc muốn ngừng tốn lượt gọi AI. Build PC tự chọn linh kiện không dùng AI nên không bị ảnh hưởng."
        aside={
          data.configured.ai ? (
            <AdminBadge tone="green">Đã cấu hình khoá AI</AdminBadge>
          ) : (
            <AdminBadge tone="amber">Chưa cấu hình khoá AI (OPENAI_API_KEY)</AdminBadge>
          )
        }
      >
        {AI_ROWS.map((row) => (
          <ToggleRow
            key={row.key}
            id={`settings-ai-${row.key}`}
            label={row.label}
            note={row.note}
            checked={current.ai[row.key]}
            onChange={(checked) => update("ai", { ...current.ai, [row.key]: checked })}
            badge={availability(current.ai[row.key], data.configured.ai, "Bật nhưng chưa có khoá AI")}
          />
        ))}
      </SettingsCard>

      <div className="admin-card sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 p-3 sm:px-5">
        <div className="min-w-0 text-xs">
          {formError ? (
            <p className="font-medium text-sale-600">{formError}</p>
          ) : dirty ? (
            <p className="font-medium text-amber-700">Có thay đổi chưa lưu.</p>
          ) : (
            <p className="text-slate-500">Không có thay đổi nào.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="size-4" />
            Hoàn tác
          </button>
          <button
            type="submit"
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {saving ? "Đang lưu..." : "Lưu cài đặt"}
          </button>
        </div>
      </div>
    </form>
  );
}
