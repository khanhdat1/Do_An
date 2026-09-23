import type { Metadata } from "next";
import CartView from "@/components/cart/CartView";

export const metadata: Metadata = {
  title: "Giỏ hàng | PCZone",
};

export default function CartPage() {
  return (
    <div className="container-page py-6">
      <h1 className="section-title mb-5 text-2xl">Giỏ hàng của bạn</h1>
      <CartView />
    </div>
  );
}
