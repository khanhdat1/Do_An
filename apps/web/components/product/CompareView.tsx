"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CloudOff, LoaderCircle, Scale, X } from "lucide-react";
import { useCompare } from "@/components/providers/CompareProvider";
import { getProductBySlug } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { ProductDetail } from "@/types";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; products: ProductDetail[] };

/**
 * Gộp thông số của mọi sản phẩm thành danh sách nhãn duy nhất, giữ thứ tự xuất hiện đầu tiên.
 * Bỏ nhãn "Bảo hành" nếu có trong dữ liệu thô — đã có dòng riêng dựng từ `warrantyMonths` (trường có
 * cấu trúc, luôn đáng tin), tránh lặp khi đúng sản phẩm đó cũng có dòng "Bảo hành" trong thông số thô.
 */
function unionSpecLabels(products: ProductDetail[]): string[] {
  const seen = new Set<string>(["Bảo hành"]);
  const labels: string[] = [];
  for (const product of products) {
    for (const row of product.specifications) {
      if (!seen.has(row.label)) {
        seen.add(row.label);
        labels.push(row.label);
      }
    }
  }
  return labels;
}

/** Bảng so sánh sản phẩm — trang `/so-sanh`, đọc danh sách từ `CompareProvider` (localStorage) */
export default function CompareView() {
  const { slugs, remove, clear } = useCompare();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (slugs.length === 0) return;
    let cancelled = false;

    Promise.all(slugs.map((slug) => getProductBySlug(slug)))
      .then((results) => {
        if (cancelled) return;
        const products = results.filter((item): item is ProductDetail => item !== null);
        setState({ status: "ready", products });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [slugs]);

  if (slugs.length === 0) {
    return (
      <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-slate-100 text-slate-400">
          <Scale className="size-8" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-slate-800">Chưa có sản phẩm nào để so sánh</h2>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">
          Bấm biểu tượng cân ở thẻ sản phẩm hoặc trang chi tiết để thêm vào đây (tối đa 4 sản phẩm).
        </p>
        <Link
          href="/"
          className="mt-6 rounded-xl bg-brand-500 px-6 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-600"
        >
          Tiếp tục mua sắm
        </Link>
      </div>
    );
  }

  if (slugs.length === 1) {
    return (
      <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
        <p className="text-sm text-slate-500">Cần ít nhất 2 sản phẩm mới so sánh được. Hãy thêm sản phẩm khác nữa.</p>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="surface-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <LoaderCircle className="size-4.5 animate-spin" />
        Đang tải sản phẩm...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
        <CloudOff className="size-8 text-slate-400" />
        <p className="mt-3 text-sm text-slate-500">Không tải được sản phẩm để so sánh. Vui lòng tải lại trang.</p>
      </div>
    );
  }

  const { products } = state;
  const specLabels = unionSpecLabels(products);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={clear} className="text-xs font-semibold text-slate-500 hover:underline">
          Bỏ hết so sánh
        </button>
      </div>

      <div className="surface-card overflow-x-auto p-0">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-40 border-b border-slate-100 p-3 text-left text-xs font-semibold text-slate-400">Sản phẩm</th>
              {products.map((product) => (
                <th key={product.id} className="border-b border-slate-100 p-3 text-left align-top">
                  <div className="relative w-40">
                    <button
                      type="button"
                      onClick={() => remove(product.slug)}
                      aria-label={`Bỏ ${product.name} khỏi so sánh`}
                      className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-white text-slate-400 shadow ring-1 ring-slate-200 hover:text-sale-600"
                    >
                      <X className="size-3.5" />
                    </button>
                    <Link href={`/san-pham/${product.slug}`} className="block">
                      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-50">
                        {product.image ? (
                          <Image src={product.image} alt={product.name} fill sizes="160px" className="object-contain" />
                        ) : null}
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs font-semibold text-slate-800 hover:text-brand-600">{product.name}</p>
                    </Link>
                    <p className="mt-1 font-display text-sm font-bold text-sale-600">{formatPrice(product.price)}</p>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-b border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-500">Đánh giá</td>
              {products.map((product) => (
                <td key={product.id} className="border-b border-slate-100 p-3 text-slate-700">
                  {product.reviewCount > 0 ? `${product.rating.toFixed(1)} sao (${product.reviewCount} đánh giá)` : "Chưa có đánh giá"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border-b border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-500">Bảo hành</td>
              {products.map((product) => (
                <td key={product.id} className="border-b border-slate-100 p-3 text-slate-700">
                  {product.warrantyMonths ? `${product.warrantyMonths} tháng` : "—"}
                </td>
              ))}
            </tr>
            {specLabels.map((label) => (
              <tr key={label}>
                <td className="border-b border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-500">{label}</td>
                {products.map((product) => {
                  const row = product.specifications.find((item) => item.label === label);
                  return (
                    <td key={product.id} className="border-b border-slate-100 p-3 text-slate-700">
                      {row?.value ?? "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
