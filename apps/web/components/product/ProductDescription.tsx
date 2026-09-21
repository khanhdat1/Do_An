import Image from "next/image";
import { parseDescription } from "@/lib/description";
import type { ProductImage } from "@/types";

/** Cùng số với thanh trên cùng (TopBar) và chân trang (Footer) */
const HOTLINE = "1800 8888";
const SUPPORT_EMAIL = "support@pczone.vn";

interface ProductDescriptionProps {
  /** Văn bản thuần kèm quy ước nhẹ (tiêu đề, mục, gạch đầu dòng, ảnh) — xem lib/description.ts */
  text: string;
  /** Thư viện ảnh của sản phẩm; `[ảnh N]` trong mô tả lấy ảnh thứ N ở đây */
  images: ProductImage[];
  productName: string;
  categoryName?: string;
}

/**
 * Bài mô tả sản phẩm: tiêu đề, các mục có tiêu đề nhỏ, ảnh xen giữa, rồi đoạn giới
 * thiệu PCZone ở cuối. Toàn bộ dựng bằng React từ chữ thuần nên không có nguy cơ XSS.
 */
export default function ProductDescription({
  text,
  images,
  productName,
  categoryName,
}: ProductDescriptionProps) {
  const blocks = parseDescription(text);

  return (
    <div className="text-sm leading-relaxed text-slate-700">
      <div className="space-y-4">
        {blocks.map((block, position) => {
          switch (block.type) {
            case "title":
              return (
                <h3
                  key={position}
                  className="text-base font-bold leading-snug text-slate-900 sm:text-lg"
                >
                  {block.text}
                </h3>
              );

            case "heading":
              return (
                <h4
                  key={position}
                  className="flex items-center gap-2 pt-3 text-[15px] font-bold text-slate-900 before:h-4 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-500"
                >
                  {block.text}
                </h4>
              );

            case "list":
              return (
                <ul key={position} className="list-disc space-y-1.5 pl-5 marker:text-brand-500">
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              );

            case "image": {
              const image = images[block.index];
              if (!image) return null;

              return (
                <figure
                  key={position}
                  className="mx-auto max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  <div className="relative aspect-4/3 w-full">
                    <Image
                      src={image.url}
                      alt={image.alt}
                      fill
                      sizes="(max-width: 1024px) 100vw, 576px"
                      className="object-contain p-3"
                    />
                  </div>
                  <figcaption className="border-t border-slate-100 px-3 py-2 text-center text-xs text-slate-500">
                    {block.caption ?? `PCZone - ${productName}`}
                  </figcaption>
                </figure>
              );
            }

            default:
              return (
                <p key={position} className="whitespace-pre-line">
                  {block.text}
                </p>
              );
          }
        })}
      </div>

      <aside className="mt-6 rounded-xl bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-600 ring-1 ring-slate-200">
        <p>
          <strong className="font-semibold text-slate-800">PCZone</strong> là nhà cung cấp Laptop
          Gaming, PC Gaming, linh kiện máy tính, màn hình và gaming gear chính hãng với giá cả hợp
          lý, chất lượng đặt lên hàng đầu. Với phương châm luôn đặt sự hài lòng của khách hàng
          lên trên hết, chúng tôi mong muốn mang đến những trải nghiệm mua sắm tuyệt vời nhất.
          Ngoài <strong className="font-semibold text-slate-800">{productName}</strong>, PCZone còn
          có rất nhiều sản phẩm{" "}
          {categoryName ? (
            <strong className="font-semibold text-slate-800">{categoryName}</strong>
          ) : null}{" "}
          chính hãng khác. Hãy liên hệ Hotline{" "}
          <strong className="font-semibold text-slate-800">{HOTLINE}</strong> (miễn phí) hoặc email{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-semibold text-brand-600 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          để được tư vấn và chọn sản phẩm ưng ý với giá tốt nhất.
        </p>
      </aside>
    </div>
  );
}
