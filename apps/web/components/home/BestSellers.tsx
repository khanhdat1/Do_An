import { BarChart3 } from "lucide-react";
import SectionHeading from "@/components/ui/SectionHeading";
import ProductCard from "@/components/product/ProductCard";
import { getBestSellers } from "@/lib/api";

/** Sản phẩm bán chạy (xếp theo tổng số lượng đã bán) kèm huy hiệu thứ hạng. */
export default async function BestSellers() {
  const products = await getBestSellers(4);

  if (products.length === 0) return null;

  return (
    <section className="container-page pt-8">
      <div className="surface-card p-4 sm:p-5">
        <SectionHeading
          icon={<BarChart3 className="size-5 text-brand-500" />}
          title="Sản phẩm bán chạy"
          subtitle="Xếp theo tổng số lượng đã bán tại PCZone"
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              variant="flash"
              rank={index + 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
