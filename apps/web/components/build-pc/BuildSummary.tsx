"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, CircleCheck, CircleX, Copy, Info, Link2, RotateCcw, ShoppingCart, TriangleAlert } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { errorMessage } from "@/lib/api-client";
import { formatPrice } from "@/lib/format";
import { savedBuildUrl, selectionFromResult, selectionToSearch } from "@/lib/pc-build";
import { saveBuild } from "@/lib/pc-build-client";
import { cn } from "@/lib/utils";
import type { BuildCheckResult, BuildStatus } from "@/types";

const STATUS_META: Record<BuildStatus, { label: string; className: string; icon: typeof Info }> = {
  COMPATIBLE: { label: "Tương thích", className: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: CircleCheck },
  NEEDS_REVIEW: { label: "Cần kiểm tra thêm", className: "bg-amber-50 text-amber-700 ring-amber-200", icon: TriangleAlert },
  INCOMPLETE: { label: "Chưa đủ linh kiện", className: "bg-slate-100 text-slate-600 ring-slate-200", icon: Info },
  INCOMPATIBLE: { label: "Có lỗi tương thích", className: "bg-red-50 text-red-700 ring-red-200", icon: CircleX },
};

function StatusBadge({ status }: { status: BuildStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold ring-1", meta.className)}>
      <meta.icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

/** Tóm tắt gọn ở đầu trang trên mobile — bản đầy đủ nằm cuối trang, không dùng thanh cố định đáy (đè lên CompareBar) */
export function BuildStatusBar({ result, className }: { result: BuildCheckResult | null; className?: string }) {
  if (!result || result.items.length === 0) return null;
  return (
    <div className={cn("surface-card flex items-center justify-between gap-3 px-4 py-3", className)}>
      <StatusBadge status={result.status} />
      <a href="#build-summary" className="text-right">
        <span className="block text-[11px] text-slate-500">Tổng cộng · xem chi tiết</span>
        <span className="font-display text-lg font-bold text-sale-600">{formatPrice(result.totalPrice)}</span>
      </a>
    </div>
  );
}

function PowerRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", strong && "border-t border-slate-200 pt-1.5 font-semibold text-slate-800")}>
      <dt>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function PowerBreakdown({ result }: { result: BuildCheckResult }) {
  const { power } = result;
  if (!result.items.some((item) => item.slot === "CPU")) {
    return <p className="text-xs text-slate-500">Chọn CPU để ước tính công suất cần thiết.</p>;
  }

  const hasVga = result.items.some((item) => item.slot === "VGA");
  const watts = (value: number | null) => (value === null ? "Chưa có dữ liệu" : `${value} W`);
  const gpu = hasVga ? watts(power.gpuW) : result.missingSlots.includes("VGA") ? "Chưa chọn" : "Không dùng card rời";

  return (
    <>
      <dl className="space-y-1 text-xs text-slate-600">
        <PowerRow label="CPU" value={watts(power.cpuW)} />
        <PowerRow label="Card đồ họa" value={gpu} />
        <PowerRow label="Mainboard, RAM, ổ cứng, quạt" value={`${power.baseW} W`} />
        <PowerRow label="Tổng ước tính" value={power.estimatedW === null ? "Chưa đủ dữ liệu" : `${power.estimatedW} W`} strong />
        <PowerRow label="Nên dùng nguồn từ" value={power.recommendedPsuW === null ? "—" : `${power.recommendedPsuW} W`} strong />
      </dl>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        CPU tính theo mức tối đa hãng công bố (nếu có), không thì theo TDP; {power.baseW} W là ước tính chung cho phần còn
        lại. Nguồn nên dư 30% so với tổng ước tính.
      </p>
    </>
  );
}

function defaultBuildName(): string {
  const now = new Date();
  return `Cấu hình ${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Cấu hình đang hiện trùng y nguyên một bản đã lưu. `isMine` null = chưa biết (đang hỏi API) */
export interface SavedRef {
  code: string;
  isMine: boolean | null;
}

/**
 * Lưu bản chụp cấu hình để có link ngắn. Cấu hình đang hiện đã là bản đã lưu (còn y nguyên) thì hiện link của nó;
 * bản đó do người khác lưu thì cho lưu một bản vào tài khoản mình.
 */
function SaveBuildControl({ result, disabled, saved }: { result: BuildCheckResult | null; disabled: boolean; saved: SavedRef | null }) {
  const { status: authStatus } = useAuth();
  const toast = useToast();
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNow, setSavedNow] = useState<{ code: string; isMine: boolean; forKey: string } | null>(null);

  const currentKey = result ? selectionToSearch(selectionFromResult(result)) : "";
  // Bản vừa lưu ở đây (vd. lưu vào tài khoản mình từ link người khác) được ưu tiên hơn bản đang mở
  const shown: SavedRef | null = savedNow?.forKey === currentKey ? savedNow : saved;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!result || name === null) return;
    setSaving(true);
    try {
      const build = await saveBuild(name.trim() || defaultBuildName(), selectionFromResult(result));
      setSavedNow({ code: build.code, isMine: build.isMine, forKey: currentKey });
      setName(null);
      toast.success("Đã lưu cấu hình — sao chép link ngắn để chia sẻ");
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Đã sao chép link cấu hình");
    } catch {
      toast.error("Trình duyệt không cho sao chép tự động — hãy sao chép địa chỉ trên thanh trình duyệt.");
    }
  }

  // Đang gõ tên để lưu (kể cả lưu một bản từ link người khác) thì hiện ô tên bên dưới thay cho khung này
  if (shown && name === null) {
    return (
      <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 ring-1 ring-emerald-200">
        <p className="font-semibold">Cấu hình này đã được lưu</p>
        <div className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-[11px] text-slate-700 ring-1 ring-emerald-200">
            /ai-build-pc?build={shown.code}
          </code>
          <button
            type="button"
            onClick={() => copy(savedBuildUrl(shown.code))}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 font-bold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
          >
            <Copy className="size-3.5" aria-hidden />
            Sao chép
          </button>
        </div>
        {authStatus === "anonymous" ? (
          <p className="mt-2 text-emerald-700">Bạn chưa đăng nhập nên cấu hình chỉ giữ được bằng link này.</p>
        ) : shown.isMine === true ? (
          <Link href="/tai-khoan/cau-hinh" className="mt-2 inline-block font-semibold underline underline-offset-2">
            Xem trong Cấu hình của tôi
          </Link>
        ) : shown.isMine === false && authStatus === "authenticated" ? (
          <div className="mt-2">
            <p className="text-emerald-700">Bản này chưa có trong Cấu hình của tôi (link được chia sẻ, hoặc lưu lúc chưa đăng nhập).</p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setName(defaultBuildName())}
              className="mt-1 font-semibold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Lưu một bản vào tài khoản của tôi
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (name !== null) {
    return (
      <form onSubmit={save} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <label htmlFor="build-name" className="text-xs font-semibold text-slate-700">
          Tên cấu hình
        </label>
        <input
          id="build-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <div className="mt-2 flex gap-2">
          <button
            type="submit"
            disabled={saving || disabled}
            className="flex-1 rounded-lg bg-ink-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
          <button
            type="button"
            onClick={() => setName(null)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300"
          >
            Huỷ
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setName(defaultBuildName())}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:border-brand-400 hover:text-brand-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-slate-200"
    >
      <Bookmark className="size-4" aria-hidden />
      Lưu cấu hình (tạo link ngắn)
    </button>
  );
}

interface BuildSummaryProps {
  result: BuildCheckResult | null;
  pending: boolean;
  error: string | null;
  /** Cấu hình đã lưu mà lựa chọn hiện tại trùng y nguyên */
  saved: SavedRef | null;
  onRetry: () => void;
  onReset: () => void;
}

export default function BuildSummary({ result, pending, error, saved, onRetry, onReset }: BuildSummaryProps) {
  const { addItem } = useCart();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const itemCount = result?.items.length ?? 0;

  async function addAllToCart() {
    if (!result || itemCount === 0) return;
    if (result.status === "INCOMPATIBLE" && !window.confirm("Cấu hình đang có lỗi tương thích (xem mục Kiểm tra tương thích). Vẫn thêm tất cả vào giỏ hàng?")) {
      return;
    }

    setAdding(true);
    const failures: string[] = [];
    // Tuần tự từng món: khách chưa có giỏ mà gọi song song thì mỗi request tự tạo một giỏ riêng
    for (const item of result.items) {
      try {
        await addItem(item.product.id, item.quantity);
      } catch (reason) {
        failures.push(`${item.product.name} (${errorMessage(reason)})`);
      }
    }
    setAdding(false);

    const added = itemCount - failures.length;
    if (added > 0) toast.success(`Đã thêm ${added} linh kiện vào giỏ hàng`, { label: "Xem giỏ hàng", href: "/gio-hang" });
    if (failures.length > 0) toast.error(`Chưa thêm được: ${failures.join("; ")}`);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Đã sao chép liên kết cấu hình");
    } catch {
      toast.error("Trình duyệt không cho sao chép tự động — hãy sao chép địa chỉ trên thanh trình duyệt.");
    }
  }

  function reset() {
    if (window.confirm("Bỏ tất cả linh kiện đã chọn?")) onReset();
  }

  return (
    <section className="surface-card p-4 sm:p-5" aria-labelledby="build-summary-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="build-summary-title" className="section-title text-base">
          Tóm tắt cấu hình
        </h2>
        {result && itemCount > 0 ? <StatusBadge status={result.status} /> : null}
      </div>

      {error ? (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <p>Không kiểm tra được cấu hình: {error}</p>
          <button type="button" onClick={onRetry} className="mt-2 text-xs font-bold underline underline-offset-2">
            Thử lại
          </button>
        </div>
      ) : null}

      <div className={cn("transition-opacity", pending && "opacity-60")} aria-busy={pending}>
        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="text-sm text-slate-500">{itemCount > 0 ? `${itemCount} linh kiện` : "Chưa chọn linh kiện nào"}</p>
          <p className="font-display text-2xl font-bold text-sale-600">{formatPrice(result?.totalPrice ?? 0)}</p>
        </div>

        {result ? (
          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Công suất ước tính</h3>
            <PowerBreakdown result={result} />
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={addAllToCart}
          disabled={itemCount === 0 || pending || adding}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <ShoppingCart className="size-4" aria-hidden />
          {adding ? "Đang thêm vào giỏ…" : "Thêm cả bộ vào giỏ hàng"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={copyLink}
            disabled={itemCount === 0}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:border-brand-400 hover:text-brand-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-slate-200"
          >
            <Link2 className="size-4" aria-hidden />
            Sao chép liên kết
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={itemCount === 0}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-slate-200"
          >
            <RotateCcw className="size-4" aria-hidden />
            Làm lại
          </button>
        </div>
        <SaveBuildControl result={result} disabled={itemCount === 0 || pending} saved={saved} />
      </div>
    </section>
  );
}
