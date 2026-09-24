import ProductCard from "@/components/product/ProductCard";
import type { Product } from "@/types";

/** Sản phẩm trợ lý AI thật sự nhắc tới trong câu trả lời — tái dùng ProductCard có sẵn, không dựng mới */
export default function ChatCitedProducts({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
