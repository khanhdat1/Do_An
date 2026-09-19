import { BarChart3, CircleCheck } from "lucide-react";
import SectionHeading from "@/components/ui/SectionHeading";
import ProductCard from "@/components/product/ProductCard";
import { getBestSellers } from "@/lib/api";

/** "Top bán chạy trong tuần" – sản phẩm kèm huy hiệu thứ hạng. */
export default async function BestSellers() {
  const products = await getBestSellers(4);

  if (products.length === 0) return null;

  return (
    <section className="container-page pt-8">
      <div className="surface-card p-4 sm:p-5">
        <SectionHeading
          icon={<BarChart3 className="size-5 text-brand-500" />}
          title="Top bán chạy trong tuần"
          badge={{ label: "Cập nhật hôm nay", tone: "green" }}
          subtitle="Top sản phẩm PC và linh kiện có lượt mua và đánh giá cao nhất tuần qua"
          aside={
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <CircleCheck className="size-4 text-emerald-500" />
              Xác thực từ hơn 1.500+ đơn hoàn tất
            </span>
          }
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
