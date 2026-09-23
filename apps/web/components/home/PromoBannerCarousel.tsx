import { getBanners } from "@/lib/api";
import PromoBannerCarouselClient from "./PromoBannerCarouselClient";

/**
 * Dải banner khuyến mãi trang chủ — nội dung admin tự đăng qua `/admin/banners` (Đợt 6 phần 2).
 * Tách biệt với HeroBanner (khối thương hiệu cố định phía trên, không phải nội dung quản trị được).
 * Server Component: không có banner nào (API tắt, hoặc admin chưa đăng cái nào) thì ẩn hẳn, không
 * hiện khung rỗng.
 */
export default async function PromoBannerCarousel() {
  const banners = await getBanners();
  if (banners.length === 0) return null;

  return (
    <section className="container-page pt-4">
      <PromoBannerCarouselClient banners={banners} />
    </section>
  );
}
