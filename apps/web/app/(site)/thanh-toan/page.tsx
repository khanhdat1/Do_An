import type { Metadata } from "next";
import CheckoutGate from "@/components/cart/CheckoutGate";

export const metadata: Metadata = {
  title: "Đặt hàng | PCZone",
};

export default function CheckoutPage() {
  return (
    <div className="container-page py-8">
      <CheckoutGate />
    </div>
  );
}
