import type { Metadata } from "next";
import CompareView from "@/components/product/CompareView";

export const metadata: Metadata = {
  title: "So sánh sản phẩm | PCZone",
  robots: { index: false, follow: false },
};

export default function ComparePage() {
  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="section-title text-2xl">So sánh sản phẩm</h1>
        <CompareView />
      </div>
    </div>
  );
}
