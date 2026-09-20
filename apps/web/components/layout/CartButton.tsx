"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";
import IconButton from "./IconButton";

/** Biểu tượng giỏ hàng trên header, badge là tổng số lượng trong giỏ */
export default function CartButton() {
  const { cart } = useCart();
  const count = cart.itemCount;

  return (
    <IconButton
      href="/gio-hang"
      label={count > 0 ? `Giỏ hàng, ${count} sản phẩm` : "Giỏ hàng"}
      count={count}
    >
      <ShoppingCart className="size-5" />
    </IconButton>
  );
}
