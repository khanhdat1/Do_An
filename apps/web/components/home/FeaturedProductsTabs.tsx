"use client";

import { useMemo, useState } from "react";
import ProductCard from "@/components/product/ProductCard";
import type { Product } from "@/types";
import { cn } from "@/lib/utils";

interface FeaturedProductsTabsProps {
  products: Product[];
  tabs: { slug: string; label: string }[];
}

/**
 * Hàng tab lọc + lưới sản phẩm.
 *
 * Lọc ngay trên danh sách đã tải sẵn (không gọi API lại), dựa vào
 * `categoryPath` — nhờ vậy tab "VGA RTX 40 Series" khớp cả khi sản phẩm
 * nằm ở danh mục con của "Linh kiện".
 */
export default function FeaturedProductsTabs({
  products,
  tabs,
}: FeaturedProductsTabsProps) {
  const [activeTab, setActiveTab] = useState("all");

  // Ẩn tab không có sản phẩm nào, tránh bấm vào thấy trống
  const visibleTabs = useMemo(
    () =>
      tabs.filter(
        (tab) =>
          tab.slug === "all" ||
          products.some((product) => product.categoryPath?.includes(tab.slug)),
      ),
    [tabs, products],
  );

  const visibleProducts = useMemo(() => {
    if (activeTab === "all") return products;
    return products.filter((product) =>
      product.categoryPath?.includes(activeTab),
    );
  }, [products, activeTab]);

  return (
    <>
      <div className="scrollbar-thin -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {visibleTabs.map((tab) => (
          <button
            key={tab.slug}
            type="button"
            onClick={() => setActiveTab(tab.slug)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
              activeTab === tab.slug
                ? "bg-brand-500 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {visibleProducts.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {visibleProducts.slice(0, 10).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-slate-500">
          Chưa có sản phẩm trong nhóm này.
        </p>
      )}
    </>
  );
}
