import type { CatalogItem } from "../../gearvn/snapshot.js";
import { Attrs } from "../attributes.js";
import { assemble, finishSpecs, compact, type Ctx, type Draft, type SpecRow } from "./common.js";
import { cpu, mainboard, pcCase, psu, ram, ssd, vga } from "./components.js";
import { keyboard, laptopGaming, laptopOffice, monitor, mouse, pcGaming, pcWorkstation } from "./devices.js";
import { buildExtras } from "./extras.js";
import { chair, desk, headset, speaker } from "./gear.js";

const BUILDERS: Record<string, (ctx: Ctx) => Draft> = {
  cpu,
  mainboard,
  ram,
  vga,
  ssd,
  psu,
  case: pcCase,
  "laptop-gaming": laptopGaming,
  "laptop-van-phong": laptopOffice,
  "pc-gaming": pcGaming,
  "pc-workstation": pcWorkstation,
  "man-hinh": monitor,
  "ban-phim": keyboard,
  chuot: mouse,
  "tai-nghe": headset,
  loa: speaker,
  ghe: chair,
  ban: desk,
};

/** Mọi nội dung cần ghi vào bảng Product cho một sản phẩm demo */
export interface ProductContent {
  specifications: SpecRow[];
  /** 3 chip đầu hiện trên thẻ sản phẩm; toàn bộ hiện thành gạch đầu dòng ở trang chi tiết */
  shortSpecs: string[];
  /** Dòng mô tả ngắn dưới tên (giới hạn 500 ký tự của cột) */
  shortDescription: string;
  description: string;
  warrantyMonths: number;
}

export function hasBuilder(category: string): boolean {
  return category in BUILDERS;
}

export function buildContent(item: CatalogItem, name: string, brand: string | null): ProductContent {
  const build = BUILDERS[item.category];
  if (!build) throw new Error(`Chưa có mẫu nội dung cho danh mục "${item.category}"`);

  const ctx: Ctx = { item, name, brand, a: new Attrs(item.attributes), seed: item.sourceUrl };
  const draft = build(ctx);

  // Lời khuyên và hỏi đáp nằm sau các mục mô tả thông số, ngay trước "Dành cho ai?"
  const { tips, faq } = buildExtras(ctx);
  draft.sections.push(
    { heading: "Lưu ý khi chọn mua và sử dụng", bullets: tips },
    { heading: "Câu hỏi thường gặp", bullets: faq },
  );

  return {
    specifications: finishSpecs(draft),
    shortSpecs: compact(draft.chips),
    shortDescription: compact(draft.summary).join(" • ").slice(0, 480),
    description: assemble(ctx, draft),
    warrantyMonths: draft.warrantyMonths ?? 12,
  };
}
