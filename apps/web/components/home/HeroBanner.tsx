import Image from "next/image";
import Link from "next/link";
import {
  Bot,
  Check,
  MessageSquareText,
  Monitor,
  Sparkles,
  Zap,
} from "lucide-react";

const highlights = [
  "Tối ưu Bottleneck bằng AI",
  "100% Linh kiện chính hãng",
  "Lắp ráp & Stress-test 24H",
];

/** Các nhãn thông số nổi trên ảnh máy ở cột phải */
const specPills = [
  { label: "Intel Core i9-14900KS", position: "left-4 top-4" },
  { label: "Custom Watercooling", position: "right-4 top-1/2 -translate-y-1/2" },
  { label: "RTX 4090 OC 24GB", position: "bottom-4 left-4" },
];

/** Banner chính của trang chủ: thông điệp thương hiệu + CTA build PC. */
export default function HeroBanner() {
  return (
    <section className="container-page pt-4">
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-ink-900 via-ink-850 to-ink-950 p-6 sm:p-8 lg:p-10">
        {/* Hiệu ứng ánh sáng cam phía dưới */}
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-80 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-gold-400/10 blur-3xl" />

        <div className="relative grid items-center gap-8 lg:grid-cols-2">
          {/* Cột nội dung */}
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gold-400 ring-1 ring-gold-400/30">
              <Zap className="size-3.5" />
              Thế hệ phần cứng 2026 – Sẵn sàng AI
            </span>

            <h1 className="mt-4 font-display text-4xl font-extrabold uppercase leading-[1.05] text-white sm:text-5xl">
              Build your <span className="text-gold-400">dream pc</span>
            </h1>

            <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-300">
              Hiệu năng đồ họa đỉnh cao – Kiểm tra tương thích 100% bằng AI – Cam
              kết linh kiện chính hãng kèm bảo hành On-site VIP tại nhà độc quyền
              từ PCZone.
            </p>

            <ul className="mt-5 grid gap-2 text-xs text-slate-200 sm:grid-cols-2">
              {highlights.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="grid size-4 shrink-0 place-items-center rounded-full bg-gold-400/20">
                    <Check className="size-2.5 text-gold-400" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/ai-build-pc"
                className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
              >
                <Sparkles className="size-4" />
                Build PC ngay
              </Link>
              <Link
                href="/san-pham"
                className="flex items-center gap-2 rounded-xl bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-wide text-white ring-1 ring-white/15 transition hover:bg-white/10"
              >
                <Monitor className="size-4" />
                Khám phá sản phẩm
              </Link>
            </div>

            {/* Gợi ý hỏi AI */}
            <div className="mt-6 flex items-center justify-between gap-3 rounded-xl bg-black/25 p-2.5 ring-1 ring-white/10">
              <p className="flex min-w-0 flex-1 items-center gap-2 px-1.5 text-xs text-slate-300">
                <MessageSquareText className="size-4 shrink-0 text-gold-400" />
                <span className="line-clamp-1">
                  Cần tìm PC đồ họa &amp; AI Render 25tr? Thử hỏi PCZone
                  Copilot...
                </span>
              </p>
              <Link
                href="/ai-advisor"
                className="flex shrink-0 items-center gap-2 rounded-lg bg-ink-850 px-3 py-2 ring-1 ring-white/10 transition hover:ring-gold-400/40"
              >
                <span className="grid size-7 place-items-center rounded-md bg-brand-500/20">
                  <Bot className="size-4 text-gold-400" />
                </span>
                <span className="leading-tight">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-white">
                    AI Advisor
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Tư vấn cấu hình
                  </span>
                </span>
              </Link>
            </div>
          </div>

          {/*
            Cột ảnh + nhãn thông số. Ảnh chụp thật (không phải ảnh AI) từ Unsplash, dùng
            theo giấy phép Unsplash: https://unsplash.com/photos/gaming-computer-setup-in-purple-light-2rQoMZLVXHc
          */}
          <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-ink-950 ring-1 ring-white/10">
            <Image
              src="/images/hero/gaming-setup.webp"
              alt="Bộ PC gaming tản nhiệt nước, đèn RGB, màn hình và bàn phím cơ"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            {/* Lớp tối nhẹ ở đáy để nhãn thông số luôn đọc được */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-ink-950/60 to-transparent" />

            {specPills.map((pill) => (
              <span
                key={pill.label}
                className={`absolute ${pill.position} flex items-center gap-1.5 rounded-full bg-ink-950/85 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm`}
              >
                <span className="size-1.5 rounded-full bg-gold-400" />
                {pill.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
