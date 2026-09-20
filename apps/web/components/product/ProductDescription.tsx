"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Quá ngưỡng này thì mô tả được thu gọn kèm nút "Xem thêm" */
const COLLAPSE_AFTER_CHARS = 700;

interface ProductDescriptionProps {
  /** Văn bản thuần; các đoạn cách nhau bằng dòng trống. Được render qua React nên không có nguy cơ XSS. */
  text: string;
}

export default function ProductDescription({ text }: ProductDescriptionProps) {
  const [expanded, setExpanded] = useState(false);

  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const collapsible = text.length > COLLAPSE_AFTER_CHARS;
  const collapsed = collapsible && !expanded;

  return (
    <div>
      <div className={cn("relative space-y-3 text-sm leading-relaxed text-slate-700", collapsed && "max-h-56 overflow-hidden")}>
        {paragraphs.map((paragraph, position) => (
          <p key={position} className="whitespace-pre-line">
            {paragraph}
          </p>
        ))}

        {collapsed ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-white to-transparent" />
        ) : null}
      </div>

      {collapsible ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          className="mt-3 text-sm font-semibold text-brand-600 hover:underline"
        >
          {expanded ? "Thu gọn" : "Xem thêm"}
        </button>
      ) : null}
    </div>
  );
}
