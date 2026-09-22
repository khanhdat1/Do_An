import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CircleCheck,
  CircleX,
  Flame,
  Gift,
  RotateCcw,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";
import Breadcrumb from "@/components/product/Breadcrumb";
import ProductCard from "@/components/product/ProductCard";
import ProductDescription from "@/components/product/ProductDescription";
import ProductGallery from "@/components/product/ProductGallery";
import ProductPurchasePanel from "@/components/product/ProductPurchasePanel";
import ReviewList from "@/components/product/ReviewList";
import SpecTable from "@/components/product/SpecTable";
import SectionHeading from "@/components/ui/SectionHeading";
import { getProductBySlug, getRelatedProducts } from "@/lib/api";
import { discountPercent, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Tone } from "@/types";

type PageProps = { params: Promise<{ slug: string }> };

const tagTones: Record<Tone, string> = {
  amber: "bg-gold-400/20 text-gold-600 ring-gold-400/40",
  green: "bg-emerald-50 text-emerald-600 ring-emerald-200",
  blue: "bg-blue-50 text-blue-600 ring-blue-200",
  red: "bg-sale-500/10 text-sale-600 ring-sale-500/30",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) return { title: "Không tìm thấy sản phẩm | PCZone" };

  return {
    title: `${product.name} | PCZone`,
    description:
      product.summary ??
      `Mua ${product.name} chính hãng, giá tốt, bảo hành đầy đủ tại PCZone.`,
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product, 4);

  const discount = discountPercent(product.price, product.oldPrice);
  const saving = product.oldPrice ? product.oldPrice - product.price : 0;
  const hasSpecs = product.specifications.length > 0;
  const { description } = product;
  const hasDescription = Boolean(description);

  const guarantees = [
    {
      icon: ShieldCheck,
      text: product.warrantyMonths
        ? `Bảo hành chính hãng ${product.warrantyMonths} tháng`
        : "Bảo hành chính hãng",
    },
    { icon: RotateCcw, text: "1 đổi 1 trong 30 ngày" },
    { icon: Truck, text: "Giao hàng hỏa tốc 2 giờ" },
  ];

  return (
    <div className="container-page py-4">
      <Breadcrumb categories={product.breadcrumb} current={product.name} />

      {/* ------------------------------ Khối chính ------------------------------ */}
      <section className="surface-card p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10">
          <ProductGallery
            images={product.images}
            name={product.name}
            categoryPath={product.categoryPath}
          />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {product.brand ? (
                <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                  {product.brand}
                </span>
              ) : null}
              {product.sku ? <span className="text-slate-400">Mã SP: {product.sku}</span> : null}
              {product.tag ? (
                <span
                  className={cn(
                    "rounded-md px-2 py-1 font-semibold ring-1",
                    tagTones[product.tag.tone ?? "amber"],
                  )}
                >
                  {product.tag.label}
                </span>
              ) : null}
            </div>

            <h1 className="mt-3 text-2xl font-bold leading-snug text-slate-900 sm:text-[28px]">
              {product.name}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {product.reviewCount > 0 ? (
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Star className="size-4 fill-gold-400 text-gold-400" />
                  <span className="font-semibold text-slate-700">{product.rating.toFixed(1)}</span>
                  ({product.reviewCount} đánh giá)
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Star className="size-4 text-slate-300" />
                  Chưa có đánh giá
                </span>
              )}

              {product.inStock === false ? (
                <span className="flex items-center gap-1.5 font-semibold text-sale-600">
                  <CircleX className="size-4" />
                  Hết hàng
                </span>
              ) : product.stock?.urgent ? (
                <span className="flex items-center gap-1.5 font-semibold text-brand-600">
                  <Flame className="size-4" />
                  {product.stock.note}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                  <CircleCheck className="size-4" />
                  Còn hàng
                </span>
              )}
            </div>

            {/* Giá */}
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-display text-3xl font-bold text-sale-600">
                  {formatPrice(product.price)}
                </span>
                {product.oldPrice ? (
                  <>
                    <span className="text-base text-slate-400 line-through">
                      {formatPrice(product.oldPrice)}
                    </span>
                    {discount > 0 ? (
                      <span className="rounded bg-sale-700 px-2 py-0.5 text-xs font-bold text-white">
                        -{discount}%
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>
              {saving > 0 ? (
                <p className="mt-1.5 text-xs font-medium text-emerald-600">
                  Tiết kiệm {formatPrice(saving)} so với giá niêm yết
                </p>
              ) : null}
            </div>

            {product.summary ? (
              <p className="mt-4 text-sm leading-relaxed text-slate-600">{product.summary}</p>
            ) : null}

            {product.highlights.length > 0 ? (
              <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                {product.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-brand-500" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}

            {product.gift ? (
              <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
                <Gift className="size-4.5 shrink-0" />
                {product.gift}
              </p>
            ) : null}

            <ProductPurchasePanel
              productId={product.id}
              name={product.name}
              inStock={product.inStock !== false}
              maxQuantity={product.maxQuantity}
            />

            <ul className="mt-5 grid grid-cols-1 gap-2.5 border-t border-slate-100 pt-5 text-xs text-slate-600 sm:grid-cols-3">
              {guarantees.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2">
                  <Icon className="size-4.5 shrink-0 text-emerald-500" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* -------------------------- Mô tả + thông số --------------------------- */}
      {hasDescription || hasSpecs ? (
        <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {description ? (
            <section
              className={cn(
                "surface-card p-4 sm:p-6",
                hasSpecs ? "lg:col-span-2" : "lg:col-span-3",
              )}
            >
              <SectionHeading title="Mô tả sản phẩm" className="mb-4" />
              <ProductDescription
                text={description}
                images={product.images}
                productName={product.name}
                categoryName={product.categoryName}
              />
            </section>
          ) : null}

          {hasSpecs ? (
            <section
              className={cn(
                "surface-card p-4 sm:p-6",
                // Mô tả dài hơn bảng thông số nhiều: giữ bảng đứng yên trong lúc đọc mô tả (chừa chỗ cho thanh menu dính đầu trang)
                hasDescription ? "lg:sticky lg:top-44 lg:col-span-1" : "lg:col-span-3",
              )}
            >
              <SectionHeading title="Thông số kỹ thuật" className="mb-4" />
              <SpecTable rows={product.specifications} />
            </section>
          ) : null}
        </div>
      ) : (
        <section className="surface-card mt-6 p-4 text-sm text-slate-500 sm:p-6">
          Thông tin chi tiết của sản phẩm này đang được cập nhật.
        </section>
      )}

      {/* ------------------------------ Đánh giá --------------------------------- */}
      <div className="mt-6">
        <ReviewList productSlug={product.slug} />
      </div>

      {/* ---------------------------- Sản phẩm liên quan ------------------------ */}
      {related.length > 0 ? (
        <section className="mt-6">
          <SectionHeading title="Sản phẩm liên quan" className="mb-4" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
