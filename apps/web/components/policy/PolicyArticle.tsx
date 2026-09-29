import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { POLICY_PAGES, POLICY_UPDATED_AT } from "@/lib/data/policies";

interface PolicyArticleProps {
  icon: LucideIcon;
  title: string;
  /** Đường dẫn của chính trang này — để mục "Chính sách khác" không liệt kê lại nó */
  href: (typeof POLICY_PAGES)[number]["href"];
  intro: React.ReactNode;
  children: React.ReactNode;
}

/** Khung chung của 4 trang chính sách: tiêu đề, ngày cập nhật, nội dung, liên kết sang các chính sách còn lại */
export default function PolicyArticle({ icon: Icon, title, href, intro, children }: PolicyArticleProps) {
  return (
    <div className="container-page py-8">
      <article className="surface-card mx-auto max-w-3xl p-5 sm:p-8">
        <header className="border-b border-slate-100 pb-5">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-500/10">
            <Icon className="size-6 text-brand-600" strokeWidth={1.8} />
          </span>
          <h1 className="section-title mt-3 text-2xl sm:text-3xl">{title}</h1>
          <p className="mt-1 text-xs text-slate-500">Cập nhật ngày {POLICY_UPDATED_AT}</p>
          <div className="mt-3 text-sm leading-relaxed text-slate-600">{intro}</div>
        </header>

        <div className="mt-6 space-y-7 text-sm leading-relaxed text-slate-700">{children}</div>

        <nav aria-label="Chính sách khác" className="mt-8 border-t border-slate-100 pt-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Chính sách khác</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {POLICY_PAGES.filter((page) => page.href !== href).map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  className="inline-block rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
                >
                  {page.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </div>
  );
}

/** Một mục có tiêu đề trong trang chính sách; `id` để trỏ thẳng tới mục (vd link hướng dẫn xoá dữ liệu cho Facebook) */
export function PolicySection({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="scroll-mt-40">
      <h2 id={id ? `${id}-title` : undefined} className="text-base font-bold text-slate-900">
        {title}
      </h2>
      <div className="mt-2 space-y-2.5">{children}</div>
    </section>
  );
}

/** Danh sách gạch đầu dòng dùng trong trang chính sách */
export function PolicyList({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-brand-500">{children}</ul>;
}

/** Link trong nội dung chính sách — brand-700: brand-600 trên nền trắng chỉ đạt 3.6:1, dưới chuẩn tương phản 4.5:1 */
export function PolicyLink({ href, children }: { href: string; children: React.ReactNode }) {
  const className = "font-semibold text-brand-700 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-700";
  return href.startsWith("/") ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
