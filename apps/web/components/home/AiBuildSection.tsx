import Link from "next/link";
import { ArrowRight, Check, Gauge, Link2, ListChecks, ShieldCheck, Wrench } from "lucide-react";

const features = [
  {
    icon: ShieldCheck,
    title: "Kiểm tra tức thì",
    description: "Socket CPU – mainboard, chuẩn và số khe RAM, cỡ mainboard và chiều dài card so với vỏ case.",
    tone: "bg-gold-400/15 text-gold-600",
  },
  {
    icon: Gauge,
    title: "Ước tính công suất",
    description: "Cộng điện năng CPU và card đồ họa, gợi ý nguồn dư 30% và so với mức hãng card khuyến nghị.",
    tone: "bg-blue-50 text-blue-600",
  },
  {
    icon: Link2,
    title: "Chia sẻ & mua nhanh",
    description: "Cấu hình nằm trên đường dẫn để gửi cho bạn bè; thêm cả bộ vào giỏ hàng bằng một nút.",
    tone: "bg-emerald-50 text-emerald-600",
  },
];

/** Đúng các luật mà trang /ai-build-pc đang kiểm tra (apps/api/src/pc-build/compatibility.ts) */
const checks = [
  "Socket CPU khớp mainboard",
  "RAM đúng chuẩn DDR4 / DDR5 của mainboard",
  "Số thanh RAM không vượt số khe",
  "Mainboard vừa vỏ case",
  "Card đồ họa vừa chiều dài vỏ case",
  "Nguồn đủ công suất, dư 30%",
  "CPU không có đồ họa tích hợp thì nhắc chọn card rời",
  "CPU không kèm tản nhiệt thì nhắc mua thêm",
];

/** Section giới thiệu công cụ Build PC + danh sách những gì hệ thống kiểm tra. */
export default function AiBuildSection() {
  return (
    <section className="container-page pt-8">
      <div className="surface-card p-5 sm:p-7">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-500">
          <Wrench className="size-3.5" />
          Công cụ Build PC
        </span>

        <h2 className="section-title mt-2 text-2xl sm:text-3xl">Tự build PC, kiểm tra tương thích tự động</h2>

        {/* min-w-0 để cột phải co lại được, tránh tràn ngang trên mobile */}
        <div className="mt-5 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          {/* Cột trái: mô tả + 3 lợi ích + CTA */}
          <div>
            <p className="max-w-xl text-sm leading-relaxed text-slate-600">
              Chọn từng linh kiện đang bán tại PCZone, hệ thống tự kiểm tra độ tương thích theo thông số sản phẩm, ước tính
              công suất nguồn và tính tổng tiền. Thông số nào còn thiếu sẽ được báo rõ, không đoán.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <span className={`grid size-9 place-items-center rounded-lg ${feature.tone}`}>
                    <feature.icon className="size-4.5" />
                  </span>
                  <h3 className="mt-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-800">{feature.title}</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{feature.description}</p>
                </div>
              ))}
            </div>

            <Link
              href="/ai-build-pc"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
            >
              <Wrench className="size-4" />
              Bắt đầu Build PC
              <ArrowRight className="size-4" />
            </Link>
          </div>

          {/* Cột phải: hệ thống kiểm tra những gì */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-800">
              <ListChecks className="size-4 text-emerald-600" />
              Hệ thống kiểm tra những gì?
            </h3>

            <ul className="mt-3 grid gap-2 rounded-lg bg-white p-3 ring-1 ring-slate-200 sm:grid-cols-2">
              {checks.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-slate-700">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" strokeWidth={3} />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <p className="max-w-xs text-[11px] leading-relaxed text-slate-500">
                Thiếu thông số thì báo &quot;chưa đủ dữ liệu&quot;, không bao giờ tự coi là tương thích.
              </p>
              <Link
                href="/ai-build-pc"
                className="rounded-lg bg-ink-900 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white transition hover:bg-ink-800"
              >
                Mở Build PC
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
