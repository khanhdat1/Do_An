import { Box, Coins, Cpu, Gift, Star, Wrench, Zap } from "lucide-react";

const features = [
  {
    icon: Cpu,
    title: "Cấu hình AI & Gaming tối thượng",
    text: "100% chính hãng tuyển chọn từ ASUS ROG, MSI, GIGABYTE, Corsair.",
  },
  {
    icon: Coins,
    title: "PCPoints VIP hoàn tiền tới 5%",
    text: "Tích lũy điểm thưởng trực tiếp linh kiện, phụ kiện gaming đỉnh cao.",
  },
  {
    icon: Box,
    title: "Đồng bộ AI PC Builder 3D",
    text: "Lưu không giới hạn cấu hình mô phỏng 3D trên đám mây & tư vấn hiệu năng.",
  },
  {
    icon: Wrench,
    title: "Bảo hành On-site VIP 2 giờ",
    text: "Kỹ thuật viên hỗ trợ tận nơi đối với mọi dàn máy Full PC Gaming & Workstation.",
  },
];

const headlines = {
  login: ["Chào mừng trở lại", "PCZone"],
  register: ["Gia nhập cộng đồng", "PCZone"],
} as const;

/**
 * Cột thương hiệu tối bên trái của trang đăng nhập / đăng ký. Chỉ hiện từ màn hình
 * lớn trở lên — trên điện thoại người dùng cần thấy ngay biểu mẫu.
 */
export default function AuthAside({ mode }: { mode: "login" | "register" }) {
  const [line1, line2] = headlines[mode];

  return (
    <aside className="relative hidden flex-col overflow-hidden bg-linear-to-br from-[#141a26] via-ink-900 to-ink-950 p-8 text-white lg:flex xl:p-10">
      <div className="pointer-events-none absolute -bottom-24 -left-16 size-80 rounded-full bg-brand-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-gold-400/10 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-brand-500 shadow-lg shadow-brand-500/30">
          <Zap className="size-6 fill-white text-white" />
        </span>
        <div className="leading-none">
          <p className="font-display text-2xl font-extrabold tracking-tight">PCZONE</p>
          <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-brand-400">
            High-end tech ecosystem
          </p>
        </div>
      </div>

      <span className="relative mt-7 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
        <span className="size-1.5 rounded-full bg-gold-400" />
        Flagship Hardware 2026
      </span>

      <p className="relative mt-4 font-display text-[34px] font-extrabold uppercase leading-[1.1]">
        {line1}
        <br />
        {line2}
      </p>
      <p className="relative mt-3 max-w-sm text-[13px] leading-relaxed text-slate-400">
        Nền tảng mua sắm linh kiện máy tính, Workstation &amp; AI Hardware cao cấp hàng đầu Việt
        Nam.
      </p>

      <ul className="relative mt-6 space-y-2.5">
        {features.map(({ icon: Icon, title, text }) => (
          <li
            key={title}
            className="flex gap-3 rounded-xl border border-white/8 bg-white/3 p-3.5"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-400">
              <Icon className="size-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold">{title}</p>
              <p className="mt-0.5 text-xs leading-snug text-slate-400">{text}</p>
            </div>
          </li>
        ))}

        <li className="flex gap-3 rounded-xl border border-brand-500/30 bg-brand-500/10 p-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-500 text-white">
            <Gift className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-gold-400">Quà tặng hội viên mới Voucher 500.000đ</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-300">
              Áp dụng trực tiếp ngay đơn hàng linh kiện đầu tiên sau khi kích hoạt tài khoản.
            </p>
          </div>
        </li>
      </ul>

      <div className="relative mt-auto pt-7">
        <div className="flex items-center gap-2">
          <span className="flex" aria-hidden>
            {[0, 1, 2, 3, 4].map((star) => (
              <Star key={star} className="size-4 fill-gold-400 text-gold-400" />
            ))}
          </span>
          <span className="text-xs font-bold uppercase text-gold-400">4.98 / 5 đánh giá</span>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
          Được tin dùng bởi hơn <strong className="text-slate-200">150.000+</strong> game thủ,
          Streamer &amp; khách hàng công nghệ VIP.
        </p>
      </div>
    </aside>
  );
}
