"use client";

import { Scale } from "lucide-react";
import { useCompare } from "@/components/providers/CompareProvider";
import IconButton from "./IconButton";

/** Biểu tượng so sánh trên header, badge là số sản phẩm đang chọn (0 thì ẩn badge) */
export default function CompareIconButton() {
  const { slugs } = useCompare();
  const count = slugs.length;

  return (
    <IconButton
      href="/so-sanh"
      label={count > 0 ? `So sánh sản phẩm, ${count} sản phẩm` : "So sánh sản phẩm"}
      count={count}
      className="hidden sm:grid"
    >
      <Scale className="size-5" />
    </IconButton>
  );
}
