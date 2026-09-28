import { Bookmark, Bot, Cpu, Gift, PackageCheck, ShieldCheck, Zap } from "lucide-react";

/** Chỉ liệt kê tiện ích có thật khi có tài khoản — không hứa dịch vụ/số liệu mà hệ thống không có */
const features = [
  {
    icon: Cpu,
    title: "Linh kiện chính hãng",
    text: "Tuyển chọn từ ASUS ROG, MSI, GIGABYTE, Corsair…, giá và tồn kho cập nhật trực tiếp.",
  },
  {
    icon: Bookmark,
    title: "Lưu cấu hình Build PC",
    text: "Cấu hình tự ráp và gợi ý AI được lưu vào \"Cấu hình của tôi\", chia sẻ bằng link ngắn.",
  },
  {
    icon: Bot,
    title: "Trợ lý AI tư vấn",
    text: "Hỏi cách chọn linh kiện; AI chỉ gợi ý sản phẩm đang bán kèm giá thật.",
  },
  {
    icon: PackageCheck,
    title: "Theo dõi đơn hàng & yêu thích",
    text: "Xem lại đơn, huỷ đơn khi còn chờ xử lý, lưu sản phẩm yêu thích để mua sau.",
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
        Nền tảng mua sắm linh kiện máy tính, Workstation &amp; AI Hardware — tự ráp cấu hình có
        kiểm tra tương thích.
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
            <p className="text-[13px] font-bold text-gold-400">Mã giảm giá đang áp dụng</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-300">
              Xem các mã ở trang Khuyến mãi và nhập ngay lúc đặt hàng — hệ thống tự kiểm tra điều kiện áp dụng.
            </p>
          </div>
        </li>
      </ul>

      <div className="relative mt-auto pt-7">
        <p className="flex items-center gap-2 text-xs font-bold uppercase text-gold-400">
          <ShieldCheck className="size-4" aria-hidden />
          Đánh giá thật từ người mua
        </p>
        <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
          Chỉ khách đã nhận hàng mới viết được đánh giá, và mỗi đánh giá được kiểm duyệt trước khi hiện công khai.
        </p>
      </div>
    </aside>
  );
}
