import type { Metadata } from "next";
import WishlistView from "@/components/product/WishlistView";

export const metadata: Metadata = {
  title: "Sản phẩm yêu thích | PCZone",
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return (
    <div className="container-page py-8">
      <h1 className="section-title mb-4 text-2xl">Sản phẩm yêu thích</h1>
      <WishlistView />
    </div>
  );
}
