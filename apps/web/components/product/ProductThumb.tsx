import type { ReactNode } from "react";
import Image from "next/image";
import {
  Box,
  Cpu,
  Gamepad2,
  HardDrive,
  Keyboard,
  Laptop,
  MemoryStick,
  Monitor,
  Mouse,
  Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductThumbProps {
  name: string;
  image?: string;
  /** Đường dẫn danh mục gốc → lá, ví dụ ["linh-kien","vga"] */
  categoryPath?: string[];
  className?: string;
  /** Gợi ý kích thước hiển thị cho next/image; mặc định hợp với ô ảnh của thẻ sản phẩm */
  sizes?: string;
}

const ICON_CLASS =
  "relative size-12 text-slate-400 transition duration-300 group-hover:scale-110 group-hover:text-brand-500";

/**
 * Icon đại diện cho từng danh mục, dựng sẵn ở cấp module.
 * Lưu thẳng phần tử JSX (không lưu component rồi gọi trong lúc render) để
 * React Compiler không hiểu nhầm là đang tạo component mới mỗi lần render.
 */
const iconBySlug: Record<string, ReactNode> = {
  chuot: <Mouse className={ICON_CLASS} strokeWidth={1.4} />,
  "ban-phim": <Keyboard className={ICON_CLASS} strokeWidth={1.4} />,
  "gaming-gear": <Keyboard className={ICON_CLASS} strokeWidth={1.4} />,
  vga: <MemoryStick className={ICON_CLASS} strokeWidth={1.4} />,
  ram: <MemoryStick className={ICON_CLASS} strokeWidth={1.4} />,
  cpu: <Cpu className={ICON_CLASS} strokeWidth={1.4} />,
  mainboard: <Cpu className={ICON_CLASS} strokeWidth={1.4} />,
  "linh-kien": <Cpu className={ICON_CLASS} strokeWidth={1.4} />,
  ssd: <HardDrive className={ICON_CLASS} strokeWidth={1.4} />,
  psu: <Plug className={ICON_CLASS} strokeWidth={1.4} />,
  case: <Box className={ICON_CLASS} strokeWidth={1.4} />,
  "man-hinh": <Monitor className={ICON_CLASS} strokeWidth={1.4} />,
  "pc-gaming": <Gamepad2 className={ICON_CLASS} strokeWidth={1.4} />,
  "pc-workstation": <Gamepad2 className={ICON_CLASS} strokeWidth={1.4} />,
  pc: <Gamepad2 className={ICON_CLASS} strokeWidth={1.4} />,
  "laptop-gaming": <Laptop className={ICON_CLASS} strokeWidth={1.4} />,
  "laptop-van-phong": <Laptop className={ICON_CLASS} strokeWidth={1.4} />,
  laptop: <Laptop className={ICON_CLASS} strokeWidth={1.4} />,
};

const fallbackIcon = <HardDrive className={ICON_CLASS} strokeWidth={1.4} />;

/**
 * Duyệt từ danh mục lá ngược lên gốc để lấy icon cụ thể nhất
 * ("chuot" được ưu tiên hơn "gaming-gear").
 */
function pickIcon(categoryPath?: string[]): ReactNode {
  if (categoryPath) {
    for (let i = categoryPath.length - 1; i >= 0; i -= 1) {
      const icon = iconBySlug[categoryPath[i]];
      if (icon) return icon;
    }
  }
  return fallbackIcon;
}

/**
 * Khung ảnh sản phẩm.
 *
 * - Có `image`: render bằng next/image.
 * - Chưa có ảnh: placeholder gradient + icon theo danh mục, để layout không
 *   vỡ trong lúc chờ crawler tải ảnh chính hãng về.
 */
export default function ProductThumb({
  name,
  image,
  categoryPath,
  className,
  sizes = "(max-width: 768px) 50vw, 20vw",
}: ProductThumbProps) {
  return (
    <div
      className={cn(
        "relative aspect-4/3 w-full overflow-hidden rounded-lg bg-slate-100",
        className,
      )}
    >
      {image ? (
        <Image
          src={image}
          alt={name}
          fill
          sizes={sizes}
          className="object-contain p-3 transition duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-linear-to-br from-slate-100 via-slate-50 to-slate-200">
          <div className="absolute size-24 rounded-full bg-brand-500/10 blur-2xl" />
          {pickIcon(categoryPath)}
        </div>
      )}
    </div>
  );
}
