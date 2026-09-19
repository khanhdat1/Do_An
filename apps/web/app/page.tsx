import TrustStrip from "@/components/layout/TrustStrip";
import HeroBanner from "@/components/home/HeroBanner";
import CategorySection from "@/components/home/CategorySection";
import FlashSaleSection from "@/components/home/FlashSaleSection";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import BestSellers from "@/components/home/BestSellers";
import AiAdvisorSection from "@/components/home/AiAdvisorSection";
import AiBuildSection from "@/components/home/AiBuildSection";
import CommunityBar from "@/components/home/CommunityBar";
import BrandStrip from "@/components/home/BrandStrip";

/**
 * Trang chủ PCZone.
 * Thứ tự section bám theo bản thiết kế tham chiếu.
 */
export default function HomePage() {
  return (
    <>
      <TrustStrip />
      <HeroBanner />
      <CategorySection />
      <FlashSaleSection />
      <FeaturedProducts />
      <BestSellers />
      <AiAdvisorSection />
      <AiBuildSection />
      <CommunityBar />
      <BrandStrip />
    </>
  );
}
