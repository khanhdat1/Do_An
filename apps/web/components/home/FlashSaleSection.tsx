import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import Countdown from "@/components/ui/Countdown";
import ProductCard from "@/components/product/ProductCard";
import { getFlashSaleProducts } from "@/lib/api";

/**
 * Khối Flash Sale: header tối có đếm ngược + lưới sản phẩm giảm giá.
 * Server Component — dữ liệu lấy từ API lúc render trên server.
 */
export default async function FlashSaleSection() {
  const products = await getFlashSaleProducts(5);

  if (products.length === 0) return null;

  return (
    <section className="container-page pt-8">
      <div className="surface-card p-4 sm:p-5">
        {/* Header tối của Flash Sale */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-linear-to-r from-ink-900 to-ink-850 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-gold-400">
              <Zap className="size-5 text-ink-950" strokeWidth={2.5} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-extrabold uppercase text-white sm:text-xl">
                  PCZone Flash Sale
                </h2>
                <span className="rounded bg-sale-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                  Hot deal
                </span>
              </div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Số lượng có hạn – Giá sập sàn hôm nay
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Countdown seconds={2 * 3600 + 42 * 60 + 9} />
            <Link
              href="/khuyen-mai/flash-sale"
              className="flex items-center gap-1.5 rounded-lg bg-gold-400 px-3 py-2 text-[11px] font-bold uppercase text-ink-950 transition hover:bg-gold-300"
            >
              Xem tất cả Flash Sale
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* Lưới sản phẩm */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} variant="flash" />
          ))}
        </div>
      </div>
    </section>
  );
}
