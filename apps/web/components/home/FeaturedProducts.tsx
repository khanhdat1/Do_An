import { Star } from "lucide-react";
import SectionHeading from "@/components/ui/SectionHeading";
import FeaturedProductsTabs from "./FeaturedProductsTabs";
import { getFeaturedProducts } from "@/lib/api";
import { featuredTabs } from "@/lib/data/products";

/**
 * "Sản phẩm nổi bật".
 *
 * Server Component lấy dữ liệu; phần tab lọc là Client Component riêng
 * (`FeaturedProductsTabs`) vì cần useState. Tách như vậy để dữ liệu vẫn
 * render sẵn ở server, tốt cho SEO.
 */
export default async function FeaturedProducts() {
  const products = await getFeaturedProducts(12);

  if (products.length === 0) return null;

  return (
    <section className="container-page pt-8">
      <div className="surface-card p-4 sm:p-5">
        <SectionHeading
          icon={<Star className="size-5 fill-gold-400 text-gold-400" />}
          title="Sản phẩm nổi bật"
          badge={{ label: "Tuyển chọn", tone: "amber" }}
          subtitle="Các sản phẩm phần cứng & laptop AI tuyển chọn hàng đầu được cộng đồng tin dùng"
          href="/san-pham"
        />

        <FeaturedProductsTabs products={products} tabs={featuredTabs} />
      </div>
    </section>
  );
}
