import { partnerBrands } from "@/lib/data/categories";

/** Dải logo các hãng phân phối chính hãng. */
export default function BrandStrip() {
  return (
    <section className="container-page py-10">
      <div className="text-center">
        <h2 className="section-title text-xl sm:text-2xl">
          Thương hiệu đồng hành chính hãng
        </h2>
        <p className="mt-1.5 text-xs text-slate-500 sm:text-sm">
          PCZone là đối tác phân phối ủy quyền, cam kết cung cấp các tập đoàn
          công nghệ hàng đầu thế giới
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {partnerBrands.map((brand) => (
          <div
            key={brand.name}
            className="surface-card grid h-20 place-items-center px-3 transition hover:-translate-y-0.5 hover:shadow-md"
            title={brand.name}
          >
            <span
              className="font-display text-sm font-extrabold uppercase tracking-tight"
              style={{ color: brand.color }}
            >
              {brand.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
