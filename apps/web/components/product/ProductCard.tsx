import Link from "next/link";
import { Gift, Star, Trophy } from "lucide-react";
import BuyNowButton from "@/components/cart/BuyNowButton";
import Highlight from "@/components/search/Highlight";
import CompareButton from "@/components/product/CompareButton";
import WishlistButton from "@/components/product/WishlistButton";
import ProductThumb from "./ProductThumb";
import type { Product, Tone } from "@/types";
import { discountPercent, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  /**
   * - `default`: dùng ở "Sản phẩm nổi bật" (hiện dòng quà tặng)
   * - `flash`: dùng ở Flash Sale (hiện thanh tiến trình đã bán)
   */
  variant?: "default" | "flash";
  /** Thứ hạng cho khối "Top bán chạy" (1, 2, 3...) */
  rank?: number;
  /** Từ khoá tìm kiếm để tô sáng trong tên (chỉ trang kết quả tìm kiếm truyền) */
  highlight?: string[];
  className?: string;
}

const tagTones: Record<Tone, string> = {
  amber: "bg-gold-400/20 text-gold-600 ring-gold-400/40",
  green: "bg-emerald-50 text-emerald-600 ring-emerald-200",
  blue: "bg-blue-50 text-blue-600 ring-blue-200",
  red: "bg-sale-500/10 text-sale-600 ring-sale-500/30",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};

/**
 * Thẻ sản phẩm dùng chung cho toàn site (Flash Sale, nổi bật, bán chạy,
 * trang danh mục, kết quả tìm kiếm...).
 */
export default function ProductCard({
  product,
  variant = "default",
  rank,
  highlight,
  className,
}: ProductCardProps) {
  const discount = discountPercent(product.price, product.oldPrice);
  const soldPercent = product.stock
    ? Math.min(100, Math.round((product.stock.sold / product.stock.total) * 100))
    : 0;
  const isTopOne = rank === 1;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/8",
        isTopOne ? "border-gold-400 ring-1 ring-gold-400/40" : "border-slate-200",
        className,
      )}
    >
      {/* Badge giảm giá góc trái */}
      {discount > 0 ? (
        <span className="absolute left-0 top-0 z-10 rounded-br-lg bg-sale-700 px-2 py-1 text-[11px] font-bold text-white">
          -{discount}%
        </span>
      ) : null}

      {/* Huy hiệu thứ hạng cho khối bán chạy */}
      {rank ? (
        <span
          className={cn(
            "absolute left-2 top-2 z-10 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase ring-1",
            isTopOne
              ? "bg-gold-400 text-ink-950 ring-gold-500"
              : "bg-white text-slate-600 ring-slate-200",
          )}
        >
          <Trophy className="size-3" />
          Top {rank}
        </span>
      ) : null}

      <WishlistButton productId={product.id} name={product.name} />
      <CompareButton slug={product.slug} name={product.name} />

      <div className="p-2.5 pb-0">
        <Link href={`/san-pham/${product.slug}`} className="block">
          <ProductThumb
            name={product.name}
            image={product.image}
            categoryPath={product.categoryPath}
          />
        </Link>

        {/* Nhãn khuyến mãi đè lên ảnh */}
        {product.tag && !rank ? (
          <span
            className={cn(
              "absolute left-2 top-8 z-10 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1",
              tagTones[product.tag.tone ?? "amber"],
            )}
          >
            {product.tag.label}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3">
        {/* Chip thông số */}
        <div className="mb-2 flex flex-wrap gap-1">
          {product.specs.map((spec) => (
            <span
              key={spec}
              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
            >
              {spec}
            </span>
          ))}
        </div>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800 transition group-hover:text-brand-600">
          <Link href={`/san-pham/${product.slug}`}>
            {highlight && highlight.length > 0 ? <Highlight text={product.name} terms={highlight} /> : product.name}
          </Link>
        </h3>

        {product.summary ? (
          <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">
            {product.summary}
          </p>
        ) : null}

        {/* Đánh giá — sản phẩm chưa có lượt nào thì nói thẳng, không hiện "0.0 (0 đánh giá)" như thật */}
        <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
          {product.reviewCount > 0 ? (
            <>
              <Star className="size-3.5 fill-gold-400 text-gold-400" />
              <span className="font-semibold text-slate-700">{product.rating.toFixed(1)}</span>
              <span>({product.reviewCount} đánh giá)</span>
            </>
          ) : (
            <>
              <Star className="size-3.5 text-slate-300" />
              <span className="text-slate-400">Chưa có đánh giá</span>
            </>
          )}
        </div>

        {/* Giá */}
        <div className="mt-2">
          {product.oldPrice ? (
            <p className="text-[11px] text-slate-400 line-through">
              {formatPrice(product.oldPrice)}
            </p>
          ) : null}
          <p className="font-display text-lg font-bold text-sale-600">
            {formatPrice(product.price)}
          </p>
        </div>

        {/* Thanh tiến trình đã bán (Flash Sale / bán chạy) */}
        {variant === "flash" && product.stock ? (
          <div className="mt-2.5">
            <div className="mb-1 flex items-center justify-between text-[10px]">
              <span className="text-slate-500">
                Đã bán {product.stock.sold}
              </span>
              <span
                className={cn(
                  "font-semibold",
                  product.stock.urgent ? "text-sale-600" : "text-emerald-600",
                )}
              >
                {product.stock.note}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-linear-to-r from-brand-400 to-sale-600"
                style={{ width: `${soldPercent}%` }}
              />
            </div>
          </div>
        ) : null}

        {/* Dòng quà tặng / cam kết */}
        {variant === "default" && product.gift ? (
          <p className="mt-2.5 flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1.5 text-[10px] font-medium text-emerald-700">
            <Gift className="size-3 shrink-0" />
            <span className="line-clamp-1">{product.gift}</span>
          </p>
        ) : null}

        {/* mt-auto đẩy nút xuống đáy để các thẻ trong cùng hàng thẳng nhau */}
        <div className="mt-auto pt-3">
          <BuyNowButton productId={product.id} inStock={product.inStock !== false} />
        </div>
      </div>
    </article>
  );
}
