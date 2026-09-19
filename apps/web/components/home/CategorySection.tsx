import Link from "next/link";
import {
  Box,
  CircuitBoard,
  Cpu,
  Gamepad2,
  HardDrive,
  Keyboard,
  Laptop,
  MemoryStick,
  Monitor,
  MonitorSmartphone,
  Mouse,
  Plug,
  Server,
} from "lucide-react";
import SectionHeading from "@/components/ui/SectionHeading";
import { getFeaturedCategories } from "@/lib/api";

/** Map tên icon lưu trong DB (Category.icon) sang component lucide-react */
const categoryIcons = {
  Gamepad2,
  Laptop,
  Monitor,
  MonitorSmartphone,
  Server,
  Cpu,
  MemoryStick,
  CircuitBoard,
  HardDrive,
  Keyboard,
  Mouse,
  Plug,
  Box,
} as const;

/** Lưới danh mục nổi bật ngay dưới hero banner. */
export default async function CategorySection() {
  const categories = await getFeaturedCategories(6);

  if (categories.length === 0) return null;

  return (
    <section className="container-page pt-8">
      <SectionHeading
        title="Danh mục nổi bật"
        subtitle="Lựa chọn giải pháp công nghệ chuyên sâu theo từng phân khúc nhu cầu"
        href="/danh-muc"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((category) => {
          const Icon =
            categoryIcons[category.icon as keyof typeof categoryIcons] ?? Cpu;

          return (
            <Link
              key={category.slug}
              href={`/danh-muc/${category.slug}`}
              className="group surface-card flex flex-col items-center gap-2 px-3 py-5 text-center transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-brand-50 transition group-hover:bg-brand-100">
                <Icon className="size-5.5 text-brand-500" strokeWidth={1.8} />
              </span>
              <span className="text-xs font-semibold text-slate-800">
                {category.name}
              </span>
              <span className="text-[10px] text-slate-400">
                {category.caption}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
