import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container-page py-16">
      <div className="surface-card mx-auto flex max-w-lg flex-col items-center px-6 py-14 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-slate-100 text-slate-400">
          <Compass className="size-9" />
        </span>
        <p className="mt-5 font-display text-5xl font-extrabold text-brand-500">404</p>
        <h1 className="mt-2 text-lg font-bold text-slate-800">Không tìm thấy trang bạn cần</h1>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">
          Trang có thể đã bị xóa, đổi địa chỉ hoặc sản phẩm đã ngừng kinh doanh.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-xl bg-brand-500 px-6 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
