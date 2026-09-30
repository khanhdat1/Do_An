import Image from "next/image";
import Link from "next/link";
import { partnerBrands } from "@/lib/data/categories";

/**
 * Logo các hãng có sản phẩm đang bán tại PCZone — bấm để xem sản phẩm của hãng. Không ghi "đối tác phân phối ủy
 * quyền": PCZone không có hợp đồng ủy quyền nào với các hãng này. Logo SVG hiển thị bằng thẻ ảnh (không nhúng thẳng
 * vào trang) nên không chạy được mã bên trong file.
 */
export default function BrandStrip() {
  return (
    <section className="container-page py-10" aria-labelledby="brand-strip-title">
      <div className="text-center">
        <h2 id="brand-strip-title" className="section-title text-xl sm:text-2xl">
          Thương hiệu có tại PCZone
        </h2>
        <p className="mt-1.5 text-xs text-slate-600 sm:text-sm">Chọn một hãng để xem các sản phẩm của hãng đó đang bán tại PCZone</p>
      </div>

      <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {partnerBrands.map((brand) => (
          <li key={brand.name}>
            <Link
              href={`/tim-kiem?q=${encodeURIComponent(brand.query)}`}
              aria-label={`Xem sản phẩm ${brand.name}`}
              className="surface-card grid h-20 place-items-center px-4 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <Image
                src={brand.logo}
                alt={brand.name}
                width={brand.width}
                height={brand.height}
                unoptimized
                // Logo gần vuông (ROG: biểu tượng + chữ nhỏ) cần cao hơn mới cân với logo chữ nằm ngang
                className={`h-auto w-auto object-contain ${brand.width / brand.height < 1.5 ? "max-h-16 max-w-full" : "max-h-12 max-w-[85%]"}`}
              />
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-center text-[11px] text-slate-600">
        Tên và logo là nhãn hiệu thuộc sở hữu của từng hãng, dùng ở đây để nhận diện sản phẩm đang bán.
      </p>
    </section>
  );
}
