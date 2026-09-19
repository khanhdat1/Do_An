import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Gift,
  ShieldCheck,
  Trophy,
  Wrench,
} from "lucide-react";
import { formatPrice } from "@/lib/format";

const features = [
  {
    icon: ShieldCheck,
    title: "Kiểm tra tức thì",
    description: "Socket CPU, Form Mainboard, Bus RAM chính xác 100%.",
    tone: "bg-gold-400/15 text-gold-600",
  },
  {
    icon: BarChart3,
    title: "AI Benchmark",
    description:
      "Gợi ý chi phí cân đối, chống nghẽn hiệu năng giữa CPU và GPU.",
    tone: "bg-blue-50 text-blue-600",
  },
  {
    icon: Gift,
    title: "Quà tặng Builder",
    description:
      "Miễn phí lắp đặt, đi dây gọn đẹp và stress-test nhiệt độ 24H.",
    tone: "bg-emerald-50 text-emerald-600",
  },
];

/** Cấu hình mẫu do AI đề xuất, hiển thị trong thẻ bên phải */
const sampleBuild = [
  { part: "CPU", name: "Intel Core i5-14600KF", price: 7_690_000 },
  { part: "MAIN", name: "MSI B760M Gaming Plus", price: 3_890_000 },
  { part: "VGA", name: "ASUS Dual RTX 5070 OC 12GB", price: 16_490_000 },
];

/** Section giới thiệu công cụ AI Build PC + thẻ cấu hình mẫu. */
export default function AiBuildSection() {
  const total = sampleBuild.reduce((sum, item) => sum + item.price, 0);

  return (
    <section className="container-page pt-8">
      <div className="surface-card p-5 sm:p-7">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-500">
          <Trophy className="size-3.5" />
          Công cụ tự ráp máy Hi-End số 1 Việt Nam
        </span>

        <h2 className="section-title mt-2 text-2xl sm:text-3xl">
          Build PC thông minh cùng PCZone AI
        </h2>

        {/* min-w-0 để cột phải co lại được, tránh tràn ngang trên mobile */}
        <div className="mt-5 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          {/* Cột trái: mô tả + 3 lợi ích + CTA */}
          <div>
            <p className="max-w-xl text-sm leading-relaxed text-slate-600">
              Hệ thống tự động kiểm tra độ tương thích linh kiện 100%, cân đối
              nghẽn cổ chai (Bottleneck Check), gợi ý công suất nguồn chuẩn 80
              Plus Gold và mô phỏng hiệu năng FPS thực tế trên 50+ tựa game phổ
              biến.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5"
                >
                  <span
                    className={`grid size-9 place-items-center rounded-lg ${feature.tone}`}
                  >
                    <feature.icon className="size-4.5" />
                  </span>
                  <h3 className="mt-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-800">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>

            <Link
              href="/ai-build-pc"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
            >
              <Wrench className="size-4" />
              Bắt đầu AI Build PC
              <ArrowRight className="size-4" />
            </Link>
          </div>

          {/* Cột phải: thẻ cấu hình AI đề xuất */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-800">
                <span className="size-2 rounded-full bg-emerald-500" />
                Cấu hình AI đề xuất
              </h3>
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase text-emerald-600 ring-1 ring-emerald-200">
                Tương thích 100%
              </span>
            </div>

            <ul className="mt-3 divide-y divide-slate-200 rounded-lg bg-white ring-1 ring-slate-200">
              {sampleBuild.map((item) => (
                <li
                  key={item.part}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <span className="w-11 shrink-0 text-[10px] font-bold uppercase text-slate-400">
                    {item.part}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">
                    {item.name}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-slate-800">
                    {formatPrice(item.price)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] text-slate-500">Ước tính tổng</p>
                <p className="font-display text-xl font-bold text-sale-600">
                  {formatPrice(total)}
                </p>
              </div>
              <Link
                href="/ai-build-pc"
                className="rounded-lg bg-ink-900 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white transition hover:bg-ink-800"
              >
                Tùy chỉnh
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
