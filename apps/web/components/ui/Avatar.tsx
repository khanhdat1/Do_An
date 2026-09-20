"use client";

import { useState } from "react";
import { getInitials } from "@/lib/user";
import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  /** Ảnh đại diện (thường từ Google / Facebook); trống hoặc tải lỗi thì hiện chữ cái đầu */
  src?: string;
  className?: string;
}

/**
 * Ảnh đại diện tròn / bo góc; ô vuông nền cam với chữ cái đầu khi không có ảnh.
 * Kích thước và bo góc do nơi dùng truyền qua `className`.
 */
export default function Avatar({ name, src, className }: AvatarProps) {
  // Nhớ URL bị lỗi thay vì cờ true/false: đổi sang ảnh khác thì tự thử lại
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (src && src !== failedSrc) {
    return (
      // Ảnh của Google / Facebook: nhỏ, tên miền CDN thay đổi theo từng người, không cần next/image tối ưu.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailedSrc(src)}
        className={cn("shrink-0 object-cover", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center bg-brand-500 font-display font-bold text-white",
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
