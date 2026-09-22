"use client";

import { Heart } from "lucide-react";
import { useWishlist } from "@/components/providers/WishlistProvider";
import IconButton from "./IconButton";

/** Biểu tượng yêu thích trên header, badge là số sản phẩm đã lưu (0 thì ẩn badge) */
export default function WishlistIconButton() {
  const { productIds } = useWishlist();
  const count = productIds.size;

  return (
    <IconButton
      href="/yeu-thich"
      label={count > 0 ? `Sản phẩm yêu thích, ${count} sản phẩm` : "Sản phẩm yêu thích"}
      count={count}
      className="hidden sm:grid"
    >
      <Heart className="size-5" />
    </IconButton>
  );
}
